import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { apiFetch } from "./api";
import { dismissedRecently, evaluateRelease } from "./app-version-policy";
import { colors, shadow } from "./theme";

type MobileRelease = {
  platform: "android" | "ios";
  enabled: boolean;
  latestVersion: string;
  latestBuild: number;
  minimumBuild: number;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string | null;
};
type AvailableRelease = MobileRelease & { installedBuild: number; installedVersion: string; required: boolean };
const runningInExpoGo = Constants.appOwnership === "expo";
const reminderDelay = 24 * 60 * 60 * 1000;
const checkInterval = 6 * 60 * 60 * 1000;

export function AppUpdateCoordinator() {
  const [release, setRelease] = useState<AvailableRelease | null>(null);
  const checking = useRef(false), lastCheckedAt = useRef(0), otaPrompted = useRef(false);

  useEffect(() => {
    if (runningInExpoGo || Platform.OS === "web" || (Platform.OS !== "android" && Platform.OS !== "ios")) return;
    let active = true;
    const check = async (force = false) => {
      if (checking.current || (!force && Date.now() - lastCheckedAt.current < checkInterval)) return;
      checking.current = true; lastCheckedAt.current = Date.now();
      if (!otaPrompted.current) {
        otaPrompted.current = true;
        await checkForOtaUpdate();
      }
      try {
        const result = await apiFetch<MobileRelease>(`/api/mobile/version?platform=${Platform.OS}`);
        const installedBuild = Math.max(0, Number.parseInt(Application.nativeBuildVersion || "0", 10) || 0);
        const policy = evaluateRelease(installedBuild, result);
        if (!active || !policy.available) return;
        const required = policy.required;
        if (!required && await recentlyDismissed(result.latestBuild)) return;
        if (active) setRelease({
          ...result,
          installedBuild,
          installedVersion: Application.nativeApplicationVersion || "desenvolvimento",
          required,
        });
      } catch {
        // Falhas de rede não impedem o uso da versão já instalada.
      } finally {
        checking.current = false;
      }
    };
    void check(true);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void check(); });
    return () => { active = false; subscription.remove(); };
  }, []);

  async function dismiss() {
    if (!release || release.required) return;
    await AsyncStorage.setItem(dismissalKey(release.latestBuild), JSON.stringify({ dismissedAt: Date.now() }));
    setRelease(null);
  }

  if (!release) return null;
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={release.required ? () => undefined : dismiss}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.card}><View style={styles.icon}><Text style={styles.iconText}>↑</Text></View><Text accessibilityRole="header" style={styles.title}>{release.required ? "Atualização necessária" : "Nova versão disponível"}</Text>
      <Text style={styles.version}>Versão {release.latestVersion} · build {release.latestBuild}</Text>
      <Text style={styles.description}>{release.required ? "Esta versão não é mais compatível com o servidor. Atualize para continuar usando o aplicativo." : "Instale a versão mais recente para receber melhorias e novas funcionalidades."}</Text>
      {release.releaseNotes ? <View style={styles.notes}><Text style={styles.notesTitle}>O que há de novo</Text><Text style={styles.notesText}>{release.releaseNotes}</Text></View> : null}
      <Text style={styles.current}>Instalada: {release.installedVersion} · build {release.installedBuild}</Text>
      <Pressable accessibilityRole="button" style={styles.primary} onPress={() => Linking.openURL(release.downloadUrl)}><Text style={styles.primaryText}>Atualizar agora</Text></Pressable>
      {!release.required ? <Pressable accessibilityRole="button" style={styles.secondary} onPress={dismiss}><Text style={styles.secondaryText}>Agora não</Text></Pressable> : null}
    </View></View>
  </Modal>;
}

async function recentlyDismissed(build: number) {
  try {
    const raw = await AsyncStorage.getItem(dismissalKey(build));
    const value = raw ? JSON.parse(raw) : null;
    return dismissedRecently(Number(value?.dismissedAt || 0), Date.now(), reminderDelay);
  } catch { return false; }
}

function dismissalKey(build: number) {
  return `ppm.mobile-release-dismissed.${Platform.OS}.${build}`;
}

async function checkForOtaUpdate() {
  try {
    const Updates = await import("expo-updates");
    if (!Updates.isEnabled) return;
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    const { Alert } = await import("react-native");
    Alert.alert(
      "Atualização rápida pronta",
      "As melhorias foram baixadas. Reinicie o aplicativo para aplicá-las.",
      [
        { text: "Depois", style: "cancel" },
        { text: "Reiniciar agora", onPress: () => { void Updates.reloadAsync(); } },
      ],
    );
  } catch {
    // Builds antigas, Expo Go e indisponibilidade do serviço continuam funcionais.
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(5,26,20,.72)" },
  card: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cream, padding: 22, alignItems: "stretch", ...shadow },
  icon: { width: 58, height: 58, alignSelf: "center", borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  iconText: { color: "#fff", fontSize: 32, fontWeight: "900" },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900", textAlign: "center", marginTop: 16 },
  version: { color: colors.green, fontWeight: "900", textAlign: "center", marginTop: 5 },
  description: { color: colors.muted, lineHeight: 21, textAlign: "center", marginTop: 13 },
  notes: { borderRadius: 13, backgroundColor: "#EAF2ED", padding: 13, marginTop: 15 },
  notesTitle: { color: colors.green, fontWeight: "900", marginBottom: 5 },
  notesText: { color: colors.text, lineHeight: 20 },
  current: { color: colors.muted, fontSize: 11, textAlign: "center", marginVertical: 14 },
  primary: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondary: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 5 },
  secondaryText: { color: colors.green, fontWeight: "800" },
});
