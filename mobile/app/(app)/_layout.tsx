import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { useAuth } from "@/auth";
import { colors } from "@/theme";
import { useMobileBranding } from "@/branding";
import { financeEntryVisible } from "@/finance";
import { hasPermission, MODERATOR_PERMISSIONS } from "@/moderator-permissions";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ focused, color, active, inactive }: { focused: boolean; color: ColorValue; active: IconName; inactive: IconName }) {
  return <View style={[styles.iconPill, focused && styles.iconPillActive]}>
    <Ionicons name={focused ? active : inactive} size={22} color={color}/>
  </View>;
}

export default function AppLayout() {
  const { palette, config: instanceConfig, loading: brandingLoading } = useMobileBranding();
  const { account, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const badgesQuery = useQuery({
    queryKey: ["match-hub", "badges", account?.id],
    queryFn: () => apiFetch<{ attendance: number; votes: number }>("/api/match-hub/badges"),
    enabled: Boolean(account),
    refetchInterval: 30_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ unread: number }>("/api/notifications"),
    enabled: Boolean(account),
  });
  if (loading || brandingLoading) return <View style={styles.loading}><ActivityIndicator color={palette.green}/></View>;
  if (!account) return <Redirect href="/login"/>;
  const canConfigureWeights = hasPermission(account, MODERATOR_PERMISSIONS.BALANCE_CONFIG_MANAGE);
  const financeVisible = financeEntryVisible(account, instanceConfig.financeEnabled);
  const pendingVotes = badgesQuery.data?.votes || 0;
  const pendingMatches = badgesQuery.data?.attendance || 0;
  const unreadNotifications = notificationsQuery.data?.unread || 0;

  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: palette.green },
    headerTintColor: "#fff",
    tabBarActiveTintColor: palette.green,
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
      title: "Partidas",
      href: null,
      tabBarBadge: pendingVotes || undefined,
      tabBarBadgeStyle: styles.badge,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="people" inactive="people-outline"/>,
    }}/>
    <Tabs.Screen name="separations/[id]" options={{ href: null, title: "Detalhes" }}/>
    <Tabs.Screen name="matches/index" options={{
      title: "Partidas",
      tabBarBadge: (pendingVotes + pendingMatches) || undefined,
      tabBarBadgeStyle: styles.badge,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="calendar" inactive="calendar-outline"/>,
    }}/>
    <Tabs.Screen name="matches/[id]" options={{ href: null, title: "Partida" }}/>
    <Tabs.Screen name="matches/manage" options={{ href: null, title: "Configurar partida" }}/>
    <Tabs.Screen name="notifications" options={{
      title: "Avisos",
      tabBarBadge: unreadNotifications || undefined,
      tabBarBadgeStyle: styles.badge,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="notifications" inactive="notifications-outline"/>,
    }}/>
    <Tabs.Screen name="card" options={{
      title: "Meu card",
      href: account.playerId ? undefined : null,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="id-card" inactive="id-card-outline"/>,
    }}/>
    <Tabs.Screen name="advanced-statistics" options={{ href: null, title: "Estatísticas avançadas" }}/>
    <Tabs.Screen name="statistics" options={{ href: null, title: "Estatísticas" }}/>
    <Tabs.Screen name="finance" options={{
      title: "Financeiro",
      href: financeVisible ? undefined : null,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="wallet" inactive="wallet-outline"/>,
    }}/>
    <Tabs.Screen name="new-separation" options={{
      title: "Montar times",
      href: null,
      tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} active="add-circle" inactive="add-circle-outline"/>,
    }}/>
    <Tabs.Screen name="config" options={{
      title: "Pesos",
      href: canConfigureWeights ? undefined : null,
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
  badge: { backgroundColor: colors.danger, color: "#fff", fontWeight: "900" },
});
