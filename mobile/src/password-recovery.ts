import type { Role } from "./types";

export function passwordResetEndpoint(role: Role) {
  return role === "admin" ? "/api/password-reset" : "/api/member-password-reset";
}
