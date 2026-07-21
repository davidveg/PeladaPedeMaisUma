import { useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";
import { focusManager, QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

onlineManager.setEventListener(setOnline => NetInfo.addEventListener(state => setOnline(Boolean(state.isConnected))));
if (Platform.OS !== "web") {
  focusManager.setEventListener(setFocused => {
    const subscription = AppState.addEventListener("change", state => setFocused(state === "active"));
    return () => subscription.remove();
  });
}
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "ppm.query-cache.v1", throttleTime: 1000 });

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 7 * 24 * 60 * 60_000, retry: 1, networkMode: "offlineFirst" }, mutations: { retry: 0, networkMode: "online" } } }));
  return <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60_000, dehydrateOptions: { shouldDehydrateQuery: query => ["separations", "profile", "public-config"].includes(String(query.queryKey[0])) } }}>{children}</PersistQueryClientProvider>;
}
