export interface PeladaRuntimeBindings {
  DB: D1Database;
  UPLOADS: R2Bucket;
  MAILER?: {
    configured: boolean;
    sendPasswordReset(message: { to: string; token: string }): Promise<{ messageId?: string }>;
  };
}

const runtimeGlobal = globalThis as typeof globalThis & {
  __PELADA_RUNTIME_BINDINGS__?: PeladaRuntimeBindings;
};

export function setRuntimeBindings(bindings: PeladaRuntimeBindings | undefined) {
  // O servidor Node do Vinext chama o Worker com env=undefined. Nesse caso,
  // preservamos os bindings locais instalados antes da inicialização.
  if (bindings?.DB && bindings?.UPLOADS) {
    runtimeGlobal.__PELADA_RUNTIME_BINDINGS__ = bindings;
  }
}

export function getRuntimeBindings(): PeladaRuntimeBindings {
  const bindings = runtimeGlobal.__PELADA_RUNTIME_BINDINGS__;
  if (!bindings) {
    throw new Error("Os bindings de armazenamento ainda não foram inicializados.");
  }
  return bindings;
}
