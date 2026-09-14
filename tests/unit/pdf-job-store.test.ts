import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelAllJobs,
  cancelJob,
  runJob,
  useJobStore,
} from "@/pdf/stores/job-store";
import { PdfError } from "@/pdf/config/errors";

beforeEach(() => {
  useJobStore.setState({ jobs: [] });
  cancelAllJobs();
});

describe("job store state", () => {
  it("adds, patches, removes and clears finished jobs", () => {
    const s = useJobStore.getState();
    const now = Date.now();
    s.add({ id: "a", label: "A", status: "queued", progress: 0, startedAt: now });
    s.add({ id: "b", label: "B", status: "completed", progress: 100, startedAt: now });
    s.add({ id: "c", label: "C", status: "failed", progress: 10, startedAt: now });
    s.add({ id: "d", label: "D", status: "processing", progress: 10, startedAt: now });
    s.patch("a", { progress: 50 });
    expect(useJobStore.getState().jobs.find((j) => j.id === "a")!.progress).toBe(50);
    s.patch("missing", { progress: 10 }); // no-op
    s.clearFinished();
    expect(useJobStore.getState().jobs.map((j) => j.id).sort()).toEqual(["a", "d"]);
    s.remove("a");
    expect(useJobStore.getState().jobs.map((j) => j.id)).toEqual(["d"]);
    s.remove("missing"); // no-op
  });
});

describe("runJob", () => {
  it("completes successfully with progress clamping", async () => {
    const seen: number[] = [];
    const result = await runJob({
      label: "work",
      task: async ({ onProgress, onDetail, signal }) => {
        expect(signal.aborted).toBe(false);
        onProgress(-10, "start");
        onProgress(150, "almost");
        onDetail("detail-only");
        seen.push(useJobStore.getState().jobs.at(-1)!.progress);
        return "done";
      },
    });
    expect(result).toBe("done");
    const job = useJobStore.getState().jobs.at(-1)!;
    expect(job.status).toBe("completed");
    expect(job.progress).toBe(100);
    expect(job.finishedAt).toBeDefined();
    expect(job.detail).toBe("detail-only");
  });

  it("marks ordinary errors as failed with user message and rethrows", async () => {
    const failure = new Error("kaput");
    await expect(
      runJob({
        label: "fail",
        task: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    const job = useJobStore.getState().jobs.at(-1)!;
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/went wrong|kaput/i);
    expect(job.finishedAt).toBeDefined();
  });

  it("marks OPERATION_CANCELLED as cancelled without error text", async () => {
    await expect(
      runJob({
        label: "cancel",
        task: async () => {
          throw new PdfError("OPERATION_CANCELLED");
        },
      }),
    ).rejects.toBeInstanceOf(PdfError);
    const job = useJobStore.getState().jobs.at(-1)!;
    expect(job.status).toBe("cancelled");
    expect(job.error).toBeUndefined();
  });

  it("supports abort via cancelJob", async () => {
    let jobId = "";
    const pending = runJob({
      label: "abortable",
      task: async ({ signal }) => {
        // capture id of the job just created
        jobId = useJobStore.getState().jobs.at(-1)!.id;
        await new Promise<void>((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new PdfError("OPERATION_CANCELLED")));
        });
      },
    });
    await vi.waitFor(() => expect(jobId).not.toBe(""));
    cancelJob(jobId);
    cancelJob("unknown-id"); // no-op
    await expect(pending).rejects.toBeInstanceOf(PdfError);
    expect(useJobStore.getState().jobs.at(-1)!.status).toBe("cancelled");
  });
});
