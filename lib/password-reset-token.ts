export function createPasswordResetToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPasswordResetToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validPasswordResetToken(token: string) {
  return /^[a-f0-9]{64}$/.test(token);
}

export function validNewPassword(password: string) {
  return password.length >= 8 && password.toLowerCase() !== "admin";
}
