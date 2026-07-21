import * as SecureStore from "expo-secure-store";
import type { Session } from "./types";

const key = "ppm.mobile.session.v1";
export const sessionStore = {
  async get(): Promise<Session | null> { try { const value = await SecureStore.getItemAsync(key); return value ? JSON.parse(value) : null; } catch { return null; } },
  async set(session: Session) { await SecureStore.setItemAsync(key, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  async clear() { await SecureStore.deleteItemAsync(key); },
};
