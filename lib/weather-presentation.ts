export type MatchWeatherStatus = "AVAILABLE" | "OUT_OF_RANGE" | "LOCATION_NOT_FOUND" | "UNAVAILABLE";

export type MatchWeather = {
  status: MatchWeatherStatus; fetchedAt: string; requestedAddress: string;
  geocodedAddress?: string; resolvedAddress?: string; latitude?: number; longitude?: number;
  usedDefaultLocation?: boolean; forecastStart?: string; forecastEnd?: string;
  temperatureMin?: number; temperatureMax?: number; apparentTemperature?: number;
  precipitationProbability?: number; precipitation?: number; windSpeed?: number;
  weatherCode?: number; description?: string; icon?: string; message?: string; source?: string;
};

export function weatherFromRow(row: { weather_snapshot?: unknown } | null | undefined): MatchWeather | null {
  if (!row?.weather_snapshot) return null;
  try {
    const parsed = JSON.parse(String(row.weather_snapshot));
    return parsed && typeof parsed === "object" ? parsed as MatchWeather : null;
  } catch { return null; }
}

/** Only the saved forecast's display fields; never refresh historical weather here. */
export function weatherSummaryFromRow(row: { weather_snapshot?: unknown } | null | undefined) {
  const weather = weatherFromRow(row);
  if (weather?.status !== "AVAILABLE") return null;
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const description = text(weather.description);
  const temperatureMin = number(weather.temperatureMin), temperatureMax = number(weather.temperatureMax);
  const wind = number(weather.windSpeed), windSpeed = wind !== null && wind >= 0 ? wind : null;
  if (!description && temperatureMin === null && temperatureMax === null && windSpeed === null) return null;
  return { description, icon: text(weather.icon), temperatureMin, temperatureMax, windSpeed,
    usedDefaultLocation: weather.usedDefaultLocation === true };
}

export function describeWeatherSymbol(symbol: string) {
  if (symbol.includes("thunder")) return { description: "Trovoadas", icon: "⛈️" };
  if (symbol.includes("snow")) return { description: "Neve", icon: "🌨️" };
  if (symbol.includes("sleet")) return { description: "Chuva congelada", icon: "🌨️" };
  if (symbol.includes("rain")) return { description: symbol.includes("heavy") ? "Chuva forte" : "Chuva", icon: "🌧️" };
  if (symbol.includes("fog")) return { description: "Neblina", icon: "🌫️" };
  if (symbol.includes("partlycloudy")) return { description: "Parcialmente nublado", icon: "⛅" };
  if (symbol.includes("cloudy")) return { description: "Nublado", icon: "☁️" };
  return { description: "Céu limpo", icon: "☀️" };
}

export function summarizeMetForecast(payload: unknown, start: Date, end: Date) {
  const source = payload as { properties?: { timeseries?: Array<Record<string, unknown>> } };
  const periods = (Array.isArray(source?.properties?.timeseries) ? source.properties.timeseries : []).filter(entry => {
    const time = Date.parse(String(entry?.time || ""));
    return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
  }) as Array<{ data?: { instant?: { details?: Record<string, unknown> }; next_1_hours?: { details?: Record<string, unknown>; summary?: Record<string, unknown> } } }>;
  const values = (read: (entry: typeof periods[number]) => unknown) => periods.map(entry => Number(read(entry))).filter(Number.isFinite);
  const temperatures = values(entry => entry.data?.instant?.details?.air_temperature);
  if (!temperatures.length) return null;
  const probability = values(entry => entry.data?.next_1_hours?.details?.probability_of_precipitation);
  const precipitation = values(entry => entry.data?.next_1_hours?.details?.precipitation_amount);
  const wind = values(entry => Number(entry.data?.instant?.details?.wind_speed) * 3.6);
  const symbols = periods.map(entry => String(entry.data?.next_1_hours?.summary?.symbol_code || "")).filter(Boolean);
  const symbol = symbols.sort((a, b) => symbolSeverity(b) - symbolSeverity(a))[0] || "partlycloudy_day";
  return {
    temperatureMin: round(Math.min(...temperatures)), temperatureMax: round(Math.max(...temperatures)),
    apparentTemperature: round(average(temperatures)), precipitationProbability: Math.round(Math.max(0, ...probability)),
    precipitation: round(precipitation.reduce((sum, value) => sum + value, 0)), windSpeed: round(Math.max(0, ...wind)),
    ...describeWeatherSymbol(symbol),
  };
}

export function summarizeOpenMeteoForecast(payload: unknown, start: Date, end: Date) {
  const source = payload as { hourly?: Record<string, unknown> };
  const hourly = source?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const indexes = times.map((value, index) => ({
    index,
    time: Date.parse(`${String(value).replace(/Z$/, "")}Z`),
  })).filter(entry => Number.isFinite(entry.time) && entry.time >= start.getTime() && entry.time <= end.getTime());
  const values = (key: string) => {
    const entries = Array.isArray(hourly[key]) ? hourly[key] as unknown[] : [];
    return indexes.map(entry => Number(entries[entry.index])).filter(Number.isFinite);
  };
  const temperatures = values("temperature_2m");
  if (!temperatures.length) return null;
  const apparent = values("apparent_temperature");
  const probability = values("precipitation_probability");
  const precipitation = values("precipitation");
  const wind = values("wind_speed_10m");
  const weatherCodes = values("weather_code");
  const presentation = describeWmoWeatherCode(weatherCodes.sort((a, b) => wmoSeverity(b) - wmoSeverity(a))[0] ?? 2);
  return {
    temperatureMin: round(Math.min(...temperatures)), temperatureMax: round(Math.max(...temperatures)),
    apparentTemperature: round(average(apparent.length ? apparent : temperatures)),
    precipitationProbability: Math.round(Math.max(0, ...probability)),
    precipitation: round(precipitation.reduce((sum, value) => sum + value, 0)),
    windSpeed: round(Math.max(0, ...wind)), ...presentation,
  };
}

export function describeWmoWeatherCode(code: number) {
  if ([95, 96, 99].includes(code)) return { description: "Trovoadas", icon: "⛈️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { description: "Neve", icon: "🌨️" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { description: code === 65 || code === 82 ? "Chuva forte" : "Chuva", icon: "🌧️" };
  if ([45, 48].includes(code)) return { description: "Neblina", icon: "🌫️" };
  if (code === 3) return { description: "Nublado", icon: "☁️" };
  if ([1, 2].includes(code)) return { description: "Parcialmente nublado", icon: "⛅" };
  return { description: "Céu limpo", icon: "☀️" };
}

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function round(value: number) { return Math.round(value * 10) / 10; }
function symbolSeverity(symbol: string) {
  if (symbol.includes("thunder")) return 7; if (symbol.includes("heavyrain")) return 6;
  if (symbol.includes("rain")) return 5; if (symbol.includes("sleet") || symbol.includes("snow")) return 4;
  if (symbol.includes("fog")) return 3; if (symbol.includes("cloudy")) return 2; if (symbol.includes("partly")) return 1; return 0;
}
function wmoSeverity(code: number) {
  if ([95, 96, 99].includes(code)) return 7; if ([65, 82].includes(code)) return 6;
  if ([51, 53, 55, 56, 57, 61, 63, 66, 67, 80, 81].includes(code)) return 5;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 4; if ([45, 48].includes(code)) return 3;
  if (code === 3) return 2; if ([1, 2].includes(code)) return 1; return 0;
}
