const cloudflareWorkersModule = `
  export const tracing = undefined;

  const bindings = new Proxy({}, {
    get(_target, property) {
      return globalThis.__PELADA_RUNTIME_BINDINGS__?.[property];
    },
    has(_target, property) {
      return property in (globalThis.__PELADA_RUNTIME_BINDINGS__ || {});
    },
  });

  export const env = bindings;
  export const exports = bindings;
  export const cache = undefined;
`;

const cloudflareWorkersUrl = `data:text/javascript,${encodeURIComponent(cloudflareWorkersModule)}`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { shortCircuit: true, url: cloudflareWorkersUrl };
  }
  return nextResolve(specifier, context);
}
