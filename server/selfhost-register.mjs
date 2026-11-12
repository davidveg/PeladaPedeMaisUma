import { register } from "node:module";

// Vinext's Cloudflare build imports its optional tracing integration through
// the cloudflare: protocol. The standalone Node server has local equivalents
// for every application binding, so only this module-resolution bridge is
// needed when the same build runs outside workerd.
register("./selfhost-cloudflare-loader.mjs", import.meta.url);
