export type LogLevel = "debug" | "info" | "warn" | "error";

const priorities: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const logGlobal = globalThis as typeof globalThis & { __PELADA_LOG_LEVEL__?: string };

function configuredLevel(): LogLevel {
  const level = logGlobal.__PELADA_LOG_LEVEL__?.toLowerCase() as LogLevel | undefined;
  return level && level in priorities ? level : "info";
}

function normalize(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function logEvent(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
  if (priorities[level] < priorities[configuredLevel()]) return;
  const entry = { timestamp: new Date().toISOString(), level, service: "pelada-pede-mais-uma", event, ...Object.fromEntries(Object.entries(context).map(([key, value]) => [key, normalize(value)])) };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}
