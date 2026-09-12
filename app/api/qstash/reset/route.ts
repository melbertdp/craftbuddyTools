import { Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";

export async function POST(request: Request) {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return new Response("QStash reset is not configured.", { status: 503 });
  }
  const signature = request.headers.get("Upstash-Signature");
  if (!signature) return new Response("Missing QStash signature.", { status: 401 });
  const body = await request.text();
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  if (!(await receiver.verify({ signature, body }))) {
    return new Response("Invalid QStash signature.", { status: 401 });
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  await Redis.fromEnv().del(`craftbuddy:ai-assist:${date}`);
  return Response.json({ reset: true, date });
}
