import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth";
import { colors } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ focused, color, active, inactive }: { focused: boolean; color: ColorValue; active: IconName; inactive: IconName }) {
  return <View style={[styles.iconPill, focused && styles.iconPillActive]}>
    <Ionicons name={focused ? active : inactive} size={22} color={color}/>
  </View>;
}

export default function AppLayout() {
  const { account, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.green}/></View>;
  if (!account) return <Redirect href="/login"/>;
  const admin = account.role === "admin";

  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.green },
    headerTintColor: "#fff",
    tabBarActiveTintColor: colors.green,
    tabBarInactiveTintColor: "#7A847F",
    tabBarHideOnKeyboard: true,
    tabBarLabelStyle: styles.tabLabel,
    tabBarItemStyle: styles.tabItem,
    tabBarStyle: {
      height: 76 + insets.bottom,
      paddingBottom: 6 + insets.bottom,
      paddingTop: 6,
      borderTopColor: colors.border,
      backgroundColor: "#FFFFFF",
    },
  }}>
    <Tabs.Screen name="index" options={{ href: null }}/>
    <Tabs.Screen name="separations/index" options={{
      title: "Separações",
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="people" inactive="people-outline"/>,
    }}/>
    <Tabs.Screen name="separations/[id]" options={{ href: null, title: "Detalhes" }}/>
    <Tabs.Screen name="card" options={{
      title: "Meu card",
      href: account.playerId ? undefined : null,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="id-card" inactive="id-card-outline"/>,
    }}/>
    <Tabs.Screen name="new-separation" options={{
      title: "Nova",
      href: admin ? undefined : null,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="add-circle" inactive="add-circle-outline"/>,
    }}/>
    <Tabs.Screen name="config" options={{
      title: "Pesos",
      href: admin ? undefined : null,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="options" inactive="options-outline"/>,
    }}/>
    <Tabs.Screen name="account" options={{
      title: "Conta",
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="person-circle" inactive="person-circle-outline"/>,
    }}/>
  </Tabs>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center" },
  tabItem: { paddingTop: 2 },
  tabLabel: { marginTop: 2, fontWeight: "800", fontSize: 10 },
  iconPill: { width: 42, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  iconPillActive: { backgroundColor: "#E5F0E9" },
});
