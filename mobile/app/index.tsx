import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/auth";
import { colors } from "@/theme";

export default function Index() { const { account, loading } = useAuth(); return loading ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}><ActivityIndicator size="large" color={colors.green}/></View> : <Redirect href={account ? "/separations" : "/login"}/>; }
