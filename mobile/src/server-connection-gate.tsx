import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { API_BASE_URL } from "./api";
import { checkServerConnection } from "./server-connection";
import { colors } from "./theme";

type ConnectionState = "checking" | "connected" | "unavailable";

export function ServerConnectionGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<ConnectionState>("checking");
  const verify = useCallback(async () => {
    setState("checking");
    setState(await checkServerConnection(API_BASE_URL) ? "connected" : "unavailable");
  }, []);
  useEffect(() => {
    let active = true;
    checkServerConnection(API_BASE_URL).then(connected => { if (active) setState(connected ? "connected" : "unavailable"); });
    return () => { active = false; };
  }, []);

  if (state === "connected") return children;
  return <SafeAreaView style={styles.screen}>
    <StatusBar style="dark"/>
    <View style={styles.content}>
      <View style={styles.icon}><FontAwesome name="server" size={34} color={colors.green}/></View>
      <Text accessibilityRole="header" style={styles.title}>{state === "checking" ? "Conectando ao servidor" : "Servidor indisponível"}</Text>
      <Text accessibilityRole={state === "unavailable" ? "alert" : undefined} style={styles.message}>{state === "checking"
        ? "Aguarde enquanto verificamos a conexão."
        : "Não foi possível conectar ao servidor. Tente novamente mais tarde."}</Text>
      {state === "checking"
        ? <ActivityIndicator size="large" color={colors.green}/>
        : <Pressable accessibilityRole="button" onPress={() => void verify()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>Tentar novamente</Text></Pressable>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  icon: { width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F1E9" },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900", textAlign: "center" },
  message: { maxWidth: 330, color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  button: { minWidth: 210, minHeight: 50, marginTop: 4, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.green },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: .8 },
});
