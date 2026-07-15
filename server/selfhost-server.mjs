import { join, resolve } from "node:path";
import { startProdServer } from "vinext/server/prod-server";
import { createSelfhostBindings } from "./selfhost-runtime.mjs";
import { createSmtpMailer } from "./selfhost-mailer.mjs";
import { logEvent } from "./selfhost-logger.mjs";

const dataDirectory = resolve(process.env.DATA_DIR ?? "/data");
const bindings = await createSelfhostBindings(dataDirectory);
bindings.MAILER = createSmtpMailer(process.env);
bindings.APP_BASE_URL = process.env.APP_BASE_URL?.trim();

globalThis.__PELADA_RUNTIME_BINDINGS__ = bindings;
globalThis.__PELADA_LOG_LEVEL__ = process.env.LOG_LEVEL ?? "info";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

logEvent("info", "application_starting", { host, port, dataDirectory, smtpConfigured: bindings.MAILER.configured, nodeVersion: process.version });

startProdServer({
  port,
  host,
  outDir: join(import.meta.dirname, "dist"),
}).catch((error) => {
  logEvent("error", "application_start_failed", { error });
  bindings.DB.close();
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logEvent("error", "uncaught_exception", { error });
  bindings.DB.close();
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logEvent("error", "unhandled_rejection", { error: reason });
});
