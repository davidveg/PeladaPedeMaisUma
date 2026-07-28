import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth";
import { QueryProvider } from "@/query-provider";
import { NotificationCoordinator } from "@/notifications";
import { AppUpdateCoordinator } from "@/app-updates";
import { MobileBrandingProvider, useMobileBranding } from "@/branding";

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><MobileBrandingProvider><QueryProvider><AuthProvider><AppUpdateCoordinator/><NotificationCoordinator/><BrandedStack/></AuthProvider></QueryProvider></MobileBrandingProvider></SafeAreaProvider></GestureHandlerRootView>;
}

function BrandedStack() {
  const { palette } = useMobileBranding();
  return <><StatusBar style="light"/><Stack screenOptions={{ headerStyle: { backgroundColor: palette.green }, headerTintColor: "#fff", headerTitleStyle: { fontWeight: "700" } }}><Stack.Screen name="index" options={{ headerShown: false }}/><Stack.Screen name="login" options={{ headerShown: false }}/><Stack.Screen name="(app)" options={{ headerShown: false }}/></Stack></>;
}
