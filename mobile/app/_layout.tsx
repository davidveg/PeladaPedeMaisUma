import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth";
import { QueryProvider } from "@/query-provider";
import { NotificationCoordinator } from "@/notifications";
import { colors } from "@/theme";

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><QueryProvider><AuthProvider><NotificationCoordinator/><StatusBar style="light"/><Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: "#fff", headerTitleStyle: { fontWeight: "700" } }}><Stack.Screen name="index" options={{ headerShown: false }}/><Stack.Screen name="login" options={{ headerShown: false }}/><Stack.Screen name="(app)" options={{ headerShown: false }}/></Stack></AuthProvider></QueryProvider></SafeAreaProvider></GestureHandlerRootView>;
}
