import { create } from "zustand";
import { PdfError, toUserMessage } from "@/pdf/config/errors";

export type JobStatus = "queued" | "processing" | "completed" | "cancelled" | "failed";

export interface Job {
  id: string;
  label: string;
  status: JobStatus;
  progress: number;
  detail?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

interface JobStoreState {
  jobs: Job[];
  add(job: Job): void;
  patch(id: string, patch: Partial<Job>): void;
  remove(id: string): void;
  clearFinished(): void;
}

let jobCounter = 0;
const controllers = new Map<string, AbortController>();

export const useJobStore = create<JobStoreState>((set) => ({
  jobs: [],
  add: (job) => set((state) => ({ jobs: [...state.jobs, job] })),
  patch: (id, patch) =>
    set((state) => ({ jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)) })),
  remove: (id) => {
    controllers.delete(id);
    set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) }));
  },
  clearFinished: () =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.status === "queued" || job.status === "processing"),
    })),
}));

export interface JobContext {
  signal: AbortSignal;
  onProgress: (progress: number, detail?: string) => void;
  onDetail: (detail: string) => void;
}

export interface RunJobOptions<T> {
  label: string;
  task: (context: JobContext) => Promise<T>;
}

export async function runJob<T>(options: RunJobOptions<T>): Promise<T> {
  jobCounter += 1;
  const id = `job-${Date.now().toString(36)}-${jobCounter.toString(36)}`;
  const controller = new AbortController();
  controllers.set(id, controller);

  const state = useJobStore.getState();
  state.add({
    id,
    label: options.label,
    status: "processing",
    progress: 0,
    startedAt: Date.now(),
  });

  const context: JobContext = {
    signal: controller.signal,
    onProgress: (progress, detail) =>
      useJobStore.getState().patch(id, {
        progress: Math.max(0, Math.min(100, progress)),
        ...(detail ? { detail } : {}),
      }),
    onDetail: (detail) => useJobStore.getState().patch(id, { detail }),
  };

  try {
    const result = await options.task(context);
    useJobStore.getState().patch(id, {
      status: "completed",
      progress: 100,
      finishedAt: Date.now(),
    });
    return result;
  } catch (error) {
    const cancelled = error instanceof PdfError && error.code === "OPERATION_CANCELLED";
    useJobStore.getState().patch(id, {
      status: cancelled ? "cancelled" : "failed",
      error: cancelled ? undefined : toUserMessage(error),
      finishedAt: Date.now(),
    });
    throw error;
  } finally {
    controllers.delete(id);
  }
}

export function cancelJob(id: string): void {
  controllers.get(id)?.abort();
}

export function cancelAllJobs(): void {
  for (const controller of controllers.values()) controller.abort();
}
