import type { ConfigContext, ExpoConfig } from "expo/config";

function number(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const createExpoConfig = ({ config }: ConfigContext): ExpoConfig => {
  const primaryColor = process.env.EXPO_PRIMARY_COLOR || "#0B3D2E";
  const appName = process.env.EXPO_APP_NAME || config.name || "Pelada Pede Mais Uma";
  const projectId = process.env.EXPO_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    name: appName,
    slug: process.env.EXPO_APP_SLUG || config.slug || "pelada-pede-mais-uma",
    scheme: process.env.EXPO_APP_SCHEME || String(config.scheme || "peladapedemaisuma"),
    icon: process.env.EXPO_APP_ICON || config.icon || "./assets/icon-football-beer.png",
    owner: process.env.EXPO_OWNER || config.owner,
    updates: {
      ...config.updates,
      url: process.env.EXPO_UPDATES_URL || config.updates?.url,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER || config.ios?.bundleIdentifier || "br.com.peladapedemaisuma.app",
      buildNumber: process.env.EXPO_IOS_BUILD_NUMBER || config.ios?.buildNumber || "1",
    },
    android: {
      ...config.android,
      package: process.env.EXPO_ANDROID_PACKAGE || config.android?.package || "br.com.peladapedemaisuma.app",
      versionCode: number(process.env.EXPO_ANDROID_VERSION_CODE, config.android?.versionCode || 1),
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: process.env.EXPO_ADAPTIVE_ICON || config.android?.adaptiveIcon?.foregroundImage || "./assets/adaptive-icon-football-beer.png",
        backgroundColor: primaryColor,
      },
    },
    plugins: (config.plugins || []).map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== "expo-notifications") return plugin;
      return [plugin[0], { ...(plugin[1] as Record<string, unknown>), color: primaryColor }];
    }),
    extra: {
      ...config.extra,
      eas: { ...config.extra?.eas, projectId },
    },
  };
};

export default createExpoConfig;
