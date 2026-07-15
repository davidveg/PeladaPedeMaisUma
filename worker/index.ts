/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { setRuntimeBindings } from "../lib/runtime-bindings";
import { logEvent } from "../lib/logger";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  UPLOADS: R2Bucket;
  APP_BASE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    setRuntimeBindings(env);
    const url = new URL(request.url);
    const startedAt = performance.now();
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

    try {
      let response: Response;
      if (url.pathname === "/_vinext/image" && env?.ASSETS && env?.IMAGES) {
        const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        response = await handleImageOptimization(request, {
          fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          },
        }, allowedWidths);
      } else {
        response = await handler.fetch(request, env, ctx);
      }

      const level = url.pathname === "/api/health" ? "debug" : response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info";
      logEvent(level, "http_request", { requestId, method: request.method, path: url.pathname, status: response.status, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 });
      return response;
    } catch (error) {
      logEvent("error", "http_request_failed", { requestId, method: request.method, path: url.pathname, durationMs: Math.round((performance.now() - startedAt) * 100) / 100, error });
      throw error;
    }
  },
};

export default worker;
