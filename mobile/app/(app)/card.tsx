import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_BASE_URL } from "@/api";
import { EmptyState, ErrorState, Header, Screen, UpdatedAt } from "@/components";
import {
  playerAttributes,
  playerCardTier,
  playerCardTierLabel,
  playerOverall,
  type PlayerCardTier,
} from "@/player-card";
import { colors } from "@/theme";
import type { ProfilePayload } from "@/types";

const palettes = {
  default: {
    gradient: ["#0F5A43", "#0B3D2E", "#072C22"],
    border: "#176B4D", text: "#FFFFFF", muted: "#D7EEE5",
    badge: "rgba(255,255,255,0.12)", badgeBorder: "rgba(255,255,255,0.24)",
    panel: "rgba(255,255,255,0.10)", panelBorder: "rgba(255,255,255,0.08)",
    stats: "#F6F4EC", statsBorder: "#DDE4DF", statsText: "#17221D",
    photo: "#DDE4DF", photoBorder: "#BFE3D4", shine: "rgba(255,255,255,0.04)",
  },
  bronze: {
    gradient: ["#E8B487", "#BD7448", "#824328"],
    border: "#9A5836", text: "#321F17", muted: "#5D3826",
    badge: "#F3D1B8", badgeBorder: "#A96642",
    panel: "rgba(255,242,223,0.25)", panelBorder: "rgba(89,53,34,0.16)",
    stats: "rgba(255,244,232,0.90)", statsBorder: "rgba(89,53,34,0.22)", statsText: "#321F17",
    photo: "#D9A47E", photoBorder: "#F3D1B8", shine: "rgba(255,242,223,0.12)",
  },
  silver: {
    gradient: ["#F0F3F4", "#C5CDD1", "#919CA3"],
    border: "#A4AFB5", text: "#263238", muted: "#4D5B62",
    badge: "#F7F9FA", badgeBorder: "#89969C",
    panel: "rgba(255,255,255,0.30)", panelBorder: "rgba(69,84,91,0.16)",
    stats: "rgba(250,252,253,0.90)", statsBorder: "rgba(69,84,91,0.20)", statsText: "#263238",
    photo: "#D7DDE0", photoBorder: "#F7F9FA", shine: "rgba(255,255,255,0.20)",
  },
  gold: {
    gradient: ["#F5E2A5", "#D7BB68", "#B38E37"],
    border: "#CFB057", text: "#2C281C", muted: "#5B4817",
    badge: "#FFF1B8", badgeBorder: "#A98A35",
    panel: "rgba(255,248,214,0.28)", panelBorder: "rgba(91,72,23,0.16)",
    stats: "rgba(255,250,231,0.90)", statsBorder: "rgba(91,72,23,0.20)", statsText: "#2C281C",
    photo: "#EADB9F", photoBorder: "#FFF1B8", shine: "rgba(255,244,182,0.18)",
  },
  legendary: {
    gradient: ["#17295C", "#331C58", "#090E25"],
    border: "#7E58CB", text: "#FFFFFF", muted: "#E8D992",
    badge: "#65D8E5", badgeBorder: "#EFD679",
    panel: "rgba(7,17,43,0.38)", panelBorder: "rgba(243,216,117,0.45)",
    stats: "rgba(7,17,43,0.58)", statsBorder: "rgba(243,216,117,0.45)", statsText: "#FFFFFF",
    photo: "#283665", photoBorder: "#9FEAFA", shine: "rgba(69,217,240,0.13)",
  },
} as const;

type StatTone = "default" | "positive" | "negative" | "special";
type PhotoAction = "choose" | "remove";
type PhotoResult = { cancelled: true } | { cancelled: false; photoUrl: string | null };
const MAX_PHOTO_SIZE = 5_000_000;

export default function MyCard() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<ProfilePayload>("/api/member-profile"),
    refetchOnMount: true,
  });
  const photoMutation = useMutation({
    mutationFn: async (action: PhotoAction): Promise<PhotoResult> => {
      const current = query.data?.player;
      if (!current) throw new Error("O jogador associado não foi encontrado.");

      let photoUrl: string | null = null;
      if (action === "choose") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("Permita o acesso às fotos para escolher uma imagem para o card.");
        const selection = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        });
        if (selection.canceled) return { cancelled: true };

        const optimized = await ImageManipulator.manipulateAsync(
          selection.assets[0].uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
        );
        const localResponse = await fetch(optimized.uri);
        const blob = await localResponse.blob();
        if (!blob.size || blob.size > MAX_PHOTO_SIZE) throw new Error("A foto deve ter no máximo 5 MB.");
        const uploaded = await apiFetch<{ url: string }>("/api/upload", {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: blob,
        });
        photoUrl = uploaded.url;
      }

      await apiFetch("/api/member-profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: current.fullName || current.displayName,
          nickname: current.nickname || "",
          primaryPosition: current.primaryPosition,
          notes: current.notes || "",
          photoUrl,
        }),
      });
      return { cancelled: false, photoUrl };
    },
    onSuccess: result => {
      if (result.cancelled) return;
      queryClient.setQueryData<ProfilePayload>(["profile"], current => current?.player
        ? { ...current, player: { ...current.player, photoUrl: result.photoUrl } }
        : current);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      Alert.alert("Foto atualizada", result.photoUrl ? "A nova foto já está disponível no seu card." : "A foto foi removida do seu card.");
    },
    onError: (error: Error) => Alert.alert("Não foi possível atualizar a foto", error.message),
  });

  if (query.isError && !query.data) {
    return <Screen><Header title="Meu card"/><ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/></Screen>;
  }
  if (query.data && !query.data.player) {
    return <Screen><Header title="Meu card"/><EmptyState title="Conta sem jogador associado" message="A associação deve ser concluída na aplicação web ou por um administrador. O aplicativo não permite escolher outro jogador."/></Screen>;
  }

  const player = query.data?.player;
  const config = query.data?.config;
  if (!player) return <Screen><Header eyebrow="SEU DESEMPENHO" title="Meu card"/></Screen>;

  const overall = playerOverall(player, config);
  const tier = playerCardTier(overall, config);
  const palette = palettes[tier];
  const career = player.careerStats;
  const openPhotoMenu = () => Alert.alert("Foto do jogador", "Escolha como deseja atualizar a foto exibida no card.", [
    { text: "Escolher da galeria", onPress: () => photoMutation.mutate("choose") },
    ...(player.photoUrl ? [{ text: "Remover foto", style: "destructive" as const, onPress: () => photoMutation.mutate("remove") }] : []),
    { text: "Cancelar", style: "cancel" },
  ]);
  const stats: Array<{ label: string; value: number; tone: StatTone }> = [
    { label: "Jogos", value: career?.games ?? 0, tone: "default" },
    { label: "Vitórias", value: career?.wins ?? 0, tone: "positive" },
    { label: "Derrotas", value: career?.losses ?? 0, tone: "negative" },
    ...(config?.showContributions
      ? [
          { label: "Gols", value: career?.goals ?? 0, tone: "special" as const },
          { label: "Assist.", value: career?.assists ?? 0, tone: "special" as const },
        ]
      : []),
  ];

  return <Screen>
    <Header eyebrow="SEU DESEMPENHO" title="Meu card"/>
    <UpdatedAt value={query.dataUpdatedAt}/>
    <ScrollView contentContainerStyle={styles.content}>
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.playerCard, { borderColor: palette.border }]}
      >
        <View pointerEvents="none" style={[styles.shine, { backgroundColor: palette.shine }]}/>
        {tier === "legendary" ? <>
          <View pointerEvents="none" style={[styles.glow, styles.glowCyan]}/>
          <View pointerEvents="none" style={[styles.glow, styles.glowPurple]}/>
        </> : null}

        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={player.photoUrl ? "Alterar foto do jogador" : "Adicionar foto do jogador"}
            disabled={photoMutation.isPending}
            onPress={openPhotoMenu}
            style={({ pressed }) => [styles.photoButton, pressed && styles.photoPressed]}
          >
            {player.photoUrl
              ? <Image
                  alt={`Foto de ${player.displayName}`}
                  source={{ uri: player.photoUrl.startsWith("http") ? player.photoUrl : `${API_BASE_URL}${player.photoUrl}` }}
                  style={[styles.photo, { backgroundColor: palette.photo, borderColor: palette.photoBorder }]}
                />
              : <View style={[styles.photo, styles.photoFallback, { backgroundColor: palette.photo, borderColor: palette.photoBorder }]}><Text style={styles.ball}>⚽</Text></View>}
            <View style={[styles.cameraBadge, { backgroundColor: palette.badge, borderColor: palette.badgeBorder }]}>
              <Ionicons name="camera" size={14} color={palette.text}/>
            </View>
            {photoMutation.isPending ? <View style={styles.photoLoading}><ActivityIndicator color="#FFFFFF"/></View> : null}
          </Pressable>
          <View style={styles.identity}>
            <Text style={[styles.tierBadge, { backgroundColor: palette.badge, borderColor: palette.badgeBorder, color: palette.text }]}>{playerCardTierLabel(tier)}</Text>
            <Text numberOfLines={2} style={[styles.name, { color: palette.text }]}>{player.displayName}</Text>
            <Text style={[styles.role, { color: palette.muted }]}>{player.primaryPosition} · {typeLabel(player.type)}</Text>
          </View>
          <View style={styles.overall}>
            <Text style={[styles.overallValue, { color: palette.text }]}>{overall.toFixed(1)}</Text>
            <Text style={[styles.overallLabel, { color: palette.muted }]}>OVERALL</Text>
          </View>
        </View>

        <View style={styles.attributes}>
          {playerAttributes(player).map(([label, value]) => <View key={label} style={[styles.attribute, { backgroundColor: palette.panel, borderColor: palette.panelBorder }]}>
            <Text style={[styles.attributeLabel, { color: palette.muted }]}>{label}</Text>
            <Text style={[styles.attributeValue, { color: palette.text }]}>{value > 0 && label === "Momentum" ? "+" : ""}{Number(value).toFixed(1)}</Text>
          </View>)}
        </View>

        <View style={[styles.careerStats, { backgroundColor: palette.stats, borderColor: palette.statsBorder }]}>
          {stats.map(item => <View key={item.label} style={styles.careerStat}>
            <Text style={[styles.careerValue, { color: statColor(tier, item.tone, palette.statsText) }]}>{item.value}</Text>
            <Text numberOfLines={1} style={[styles.careerLabel, { color: tier === "legendary" ? palette.muted : palette.muted }]}>{item.label}</Text>
          </View>)}
        </View>
      </LinearGradient>
    </ScrollView>
  </Screen>;
}

function statColor(tier: PlayerCardTier, tone: StatTone, fallback: string) {
  if (tier !== "legendary") return fallback;
  if (tone === "positive") return "#75F0B0";
  if (tone === "negative") return "#FF8F82";
  if (tone === "special") return "#7EE9FF";
  return fallback;
}

const typeLabel = (value: string) => value === "goalkeeper" ? "Goleiro" : value === "monthly" ? "Mensalista" : "Convidado";

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  playerCard: { borderWidth: 5, borderRadius: 28, overflow: "hidden", padding: 18, gap: 18 },
  shine: { position: "absolute", width: 500, height: 70, top: 105, left: -115, transform: [{ rotate: "-24deg" }] },
  glow: { position: "absolute", width: 180, height: 180, borderRadius: 90 },
  glowCyan: { top: -90, right: -45, backgroundColor: "rgba(69,217,240,0.20)" },
  glowPurple: { top: 150, left: -95, backgroundColor: "rgba(169,82,255,0.18)" },
  top: { flexDirection: "row", gap: 13, alignItems: "center" },
  photoButton: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },
  photoPressed: { opacity: 0.78 },
  photo: { width: 84, height: 84, borderRadius: 42, borderWidth: 3 },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  ball: { fontSize: 34 },
  cameraBadge: { position: "absolute", right: -1, bottom: -1, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  photoLoading: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, margin: 2, borderRadius: 42, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  identity: { flex: 1, alignItems: "flex-start", gap: 4 },
  tierBadge: { overflow: "hidden", borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, lineHeight: 12, fontWeight: "900", letterSpacing: 1 },
  name: { fontSize: 24, lineHeight: 28, fontWeight: "900" },
  role: { fontSize: 14, fontWeight: "600" },
  overall: { alignItems: "center", minWidth: 54 },
  overallValue: { fontSize: 34, lineHeight: 38, fontWeight: "900" },
  overallLabel: { marginTop: 2, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  attributes: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  attribute: { flexGrow: 1, flexBasis: "46%", borderWidth: 1, borderRadius: 14, padding: 14 },
  attributeLabel: { fontSize: 12, fontWeight: "800" },
  attributeValue: { marginTop: 5, fontSize: 24, fontWeight: "900" },
  careerStats: { flexDirection: "row", borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 6 },
  careerStat: { flex: 1, minWidth: 0, alignItems: "center" },
  careerValue: { fontSize: 21, fontWeight: "900" },
  careerLabel: { marginTop: 3, fontSize: 10, fontWeight: "600" },
});
