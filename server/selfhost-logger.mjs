const priorities = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel() {
  const level = String(process.env.LOG_LEVEL ?? "info").toLowerCase();
  return level in priorities ? level : "info";
}

function normalize(value) {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function logEvent(level, event, context = {}) {
  if (priorities[level] < priorities[configuredLevel()]) return;
  const output = JSON.stringify({ timestamp: new Date().toISOString(), level, service: "pelada-pede-mais-uma", event, ...Object.fromEntries(Object.entries(context).map(([key, value]) => [key, normalize(value)])) });
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}
