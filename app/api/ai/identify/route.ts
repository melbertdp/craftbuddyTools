import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { z } from "zod";

const DAILY_LIMIT = 500;
function getOpenRouterModels() {
  return [
    process.env.PRINT_CLASSIFIER_FREE_MODEL || "openrouter/free",
    process.env.PRINT_CLASSIFIER_PRIMARY_MODEL || "qwen/qwen3.7-flash",
    process.env.PRINT_CLASSIFIER_SECONDARY_MODEL || "deepseek/deepseek-v4-flash-latest",
    process.env.PRINT_CLASSIFIER_FINAL_MODEL || "openai/gpt-5.6-luna",
  ].filter((model, index, models) => models.indexOf(model) === index);
}

const classificationSchema = z.object({
  contentType: z.enum(["text_only", "text_with_image", "image_only", "photo", "photo_set", "unknown"]),
  colorClass: z.enum(["black_white", "partial_color", "full_color"]),
  confidence: z.number().min(0).max(1),
}).strict();
const classificationPrompt = `Classify this printable page for a print-price estimator. Return only JSON with this exact shape: {"contentType":"text_only|text_with_image|image_only|photo|photo_set|unknown","colorClass":"black_white|partial_color|full_color","confidence":0.95}.

text_only means primarily text, tables, forms, or normal document structure. Small logos, signatures, QR codes, borders, and branding remain text_only.
text_with_image means substantial text plus a meaningful photograph, screenshot, chart, illustration, or graphic.
image_only means primarily non-photographic illustrations, graphics, diagrams, posters, or coloring-book content.
photo means one photographic image dominates the page. photo_set means multiple photographs are intentionally arranged on one page.
Use black_white for grayscale pages, partial_color when meaningful color exists but neutral areas occupy a substantial portion, and full_color only when color substantially covers or dominates the total page. Be conservative.`;

function todayInManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("AI usage tracking is not configured.");
  }
  return Redis.fromEnv();
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const log = (message: string, details: Record<string, unknown> = {}) =>
    console.info(`[ai-identify:${requestId}] ${message}`, {
      ...details,
      elapsedMs: Date.now() - startedAt,
    });

  log("request started");
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      log("missing OpenRouter API key");
      return NextResponse.json({ error: "OpenRouter is not configured." }, { status: 503 });
    }
    const body = (await request.json()) as { fileName?: string; imageDataUrl?: string };
    log("request parsed", {
      fileName: body.fileName || "unknown",
      hasImage: Boolean(body.imageDataUrl),
      imageBytes: body.imageDataUrl?.length || 0,
    });
    if (!body.imageDataUrl?.startsWith("data:image/")) {
      log("invalid image payload");
      return NextResponse.json(
        { error: "AI Assist could not render this file as an image." },
        { status: 400 },
      );
    }

    const redis = getRedis();
    const key = `craftbuddy:ai-assist:${todayInManila()}`;
    const count = await redis.incr(key);
    log("usage counted", { count, limit: DAILY_LIMIT });
    if (count === 1) await redis.expire(key, 60 * 60 * 30);
    if (count > DAILY_LIMIT) {
      log("daily limit reached", { count });
      return NextResponse.json(
        { error: "The global AI Assist limit of 500 requests for today has been reached." },
        { status: 429, headers: { "Retry-After": "86400" } },
      );
    }

    let lastError = "OpenRouter request failed.";
    for (const model of getOpenRouterModels()) {
      try {
        log("trying model", { model });
        const request = (structured: boolean) => fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://craftbuddy.tools",
            "X-Title": "CraftBuddy Tools",
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 300,
            ...(structured ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "print_classification",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      contentType: { type: "string", enum: ["text_only", "text_with_image", "image_only", "photo", "photo_set", "unknown"] },
                      colorClass: { type: "string", enum: ["black_white", "partial_color", "full_color"] },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                    required: ["contentType", "colorClass", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
            } : {}),
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `${classificationPrompt} File name: ${body.fileName || "unknown"}.` },
                { type: "image_url", image_url: { url: body.imageDataUrl } },
              ],
            }],
          }),
        });
        let response = await request(true);
        log("model response", { model, structured: true, status: response.status });
        if (!response.ok && (response.status === 400 || response.status === 422)) {
          log("retrying without structured output", { model, status: response.status });
          response = await request(false);
          log("fallback model response", { model, structured: false, status: response.status });
        }
        const responseText = await response.text();
        let data: {
          model?: string;
          choices?: { message?: { content?: unknown } }[];
          error?: { message?: string } | string;
        } = {};
        try {
          data = JSON.parse(responseText);
        } catch {
          log("provider returned non-JSON response", {
            model,
            status: response.status,
            body: responseText.slice(0, 500),
          });
        }
        if (!response.ok) {
          const providerError =
            typeof data.error === "string" ? data.error : data.error?.message;
          lastError = providerError || `${model} returned HTTP ${response.status}.`;
          log("model failed", {
            model,
            status: response.status,
            error: lastError,
            body: responseText.slice(0, 500),
          });
          continue;
        }
        const content = data.choices?.[0]?.message?.content;
        const rawContent = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
                .filter((part): part is { text: string } =>
                  typeof part === "object" &&
                  part !== null &&
                  "text" in part &&
                  typeof part.text === "string",
                )
                .map((part) => part.text)
                .join("")
            : "";
        const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        if (!cleaned) {
          lastError = `${model} returned an empty completion.`;
          log("model returned empty completion", { model });
          continue;
        }
        const classification = classificationSchema.parse(JSON.parse(cleaned));
        const label = classification.contentType.replaceAll("_", " ");
        log("request succeeded", { model: data.model || model });
        return NextResponse.json({
          result: `Content: ${label}. Color: ${classification.colorClass.replaceAll("_", " ")}. Confidence: ${Math.round(classification.confidence * 100)}%.`,
          classification,
          model: data.model || model,
        });
      } catch (error) {
        lastError = error instanceof Error ? `${model}: ${error.message}` : `${model} failed.`;
        console.error(`[ai-identify:${requestId}] model exception`, {
          model,
          error,
          elapsedMs: Date.now() - startedAt,
        });
      }
    }
    log("all models failed", { error: lastError });
    return NextResponse.json(
      { error: lastError, requestId },
      { status: 502 },
    );
  } catch (error) {
    console.error(`[ai-identify:${requestId}] request failed`, {
      error,
      elapsedMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI analysis failed." },
      { status: 500 },
    );
  }
}
