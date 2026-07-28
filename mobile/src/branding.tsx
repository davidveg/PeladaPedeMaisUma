import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { API_BASE_URL } from "./api";
import { colors as defaults } from "./theme";

export type MobileInstanceConfiguration = {
  appName: string;
  appTagline: string;
  appPrimaryColor: string;
  appSecondaryColor: string;
  appBackgroundColor: string;
  appTextColor: string;
  logoUrl?: string | null;
  defaultMatchTitle: string;
  defaultMatchWeekday: number;
  defaultMatchTime: string;
  confirmationLeadMinutes: number;
  timezone: string;
};

const defaultConfiguration: MobileInstanceConfiguration = {
  appName: "Pelada Pede Mais Uma",
  appTagline: "Entre para a partida",
  appPrimaryColor: defaults.green,
  appSecondaryColor: "#D9F36B",
  appBackgroundColor: defaults.cream,
  appTextColor: defaults.text,
  logoUrl: null,
  defaultMatchTitle: "Pelada",
  defaultMatchWeekday: 0,
  defaultMatchTime: "09:00",
  confirmationLeadMinutes: 60,
  timezone: "America/Sao_Paulo",
};

type MobileBrandingValue = {
  config: MobileInstanceConfiguration;
  palette: typeof defaults;
  loading: boolean;
  refresh(): Promise<void>;
};

const MobileBrandingContext = createContext<MobileBrandingValue>({
  config: defaultConfiguration,
  palette: defaults,
  loading: false,
  async refresh() {},
});

export function MobileBrandingProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState(defaultConfiguration);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!API_BASE_URL) { setLoading(false); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/public-config`, { headers: { accept: "application/json" } });
      const payload = await response.json();
      if (response.ok && payload.instance) setConfig({ ...defaultConfiguration, ...payload.instance });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [refresh]);
  const palette = useMemo(() => ({
    ...defaults,
    green: config.appPrimaryColor,
    greenLight: config.appPrimaryColor,
    cream: config.appBackgroundColor,
    text: config.appTextColor,
    yellow: config.appSecondaryColor,
  }), [config]);
  const value = useMemo(() => ({ config, palette, loading, refresh }), [config, palette, loading, refresh]);
  return <MobileBrandingContext.Provider value={value}>{children}</MobileBrandingContext.Provider>;
}

export function useMobileBranding() {
  return useContext(MobileBrandingContext);
}
