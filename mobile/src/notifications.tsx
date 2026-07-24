import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { apiFetch, jsonMutation } from "./api";
import { useAuth } from "./auth";

type NotificationsModule = typeof import("expo-notifications");
type NotificationResponse = import("expo-notifications").NotificationResponse;
const runningInExpoGo = Constants.appOwnership === "expo";

export function NotificationCoordinator() {
  const { account } = useAuth();
  const router = useRouter();
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    if (!account || runningInExpoGo || Platform.OS === "web") return;
    let active = true;
    let subscription: { remove(): void } | undefined;
    const open = (response: NotificationResponse | null | undefined) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      if (handledResponse.current === identifier) return;
      const data = response.notification.request.content.data;
      if (data?.type !== "career_vote_open" || typeof data.separationId !== "string") return;
      handledResponse.current = identifier;
      router.push({ pathname: "/separations/[id]", params: { id: data.separationId } });
    };
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        if (!active) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        subscription = Notifications.addNotificationResponseReceivedListener(open);
        open(await Notifications.getLastNotificationResponseAsync());
        await registerPushNotifications(Notifications);
      } catch {
        // A integração nativa é opcional. O alerta interno do aplicativo
        // continua disponível quando push não está presente.
      }
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [account, router]);

  return null;
}

async function registerPushNotifications(Notifications: NotificationsModule) {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("career-votes", {
        name: "Votações da pelada",
        description: "Avisos de votações abertas após a confirmação dos resultados.",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: "#0B3D2E",
        sound: "default",
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) return;
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await apiFetch("/api/mobile/notifications", jsonMutation("POST", {
      expoPushToken,
      platform: Platform.OS,
      deviceName: `${Application.applicationName || "Pelada"} ${Application.nativeApplicationVersion || "dev"}`,
    }));
  } catch {
    // Permissões negadas, emuladores sem push e indisponibilidade temporária
    // não devem impedir o uso normal do aplicativo.
  }
}
