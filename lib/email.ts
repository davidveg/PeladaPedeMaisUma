export const MAX_EMAIL_LENGTH = 254;

const MAX_LOCAL_PART_LENGTH = 64;
const MAX_DOMAIN_LABEL_LENGTH = 63;
const whitespacePattern = /\s/u;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_EMAIL_LENGTH) return null;

  const email = value.trim().toLowerCase();
  if (!email || whitespacePattern.test(email)) return null;

  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@") || at > MAX_LOCAL_PART_LENGTH) return null;

  const localPart = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !domain ||
    domain.length > 253 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) return null;

  const labels = domain.split(".");
  if (labels.length < 2) return null;
  if (labels.some(label => !label || label.length > MAX_DOMAIN_LABEL_LENGTH || label.startsWith("-") || label.endsWith("-"))) return null;

  return email;
}
