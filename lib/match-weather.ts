/* Weather is persisted per match. Provider calls are best-effort and never block match lifecycle errors. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./database";
import { logEvent } from "./logger";
import { getRuntimeBindings } from "./runtime-bindings";
import { summarizeMetForecast, summarizeOpenMeteoForecast, type MatchWeather, weatherFromRow } from "./weather-presentation";
export { weatherFromRow } from "./weather-presentation";
export type { MatchWeather, MatchWeatherStatus } from "./weather-presentation";

const CACHE_MS = 60 * 60 * 1000;
const FAILURE_CACHE_MS = 5 * 60 * 1000;
const FORECAST_HORIZON_MS = 9 * 24 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<MatchWeather>>();
let geocodingQueue: Promise<unknown> = Promise.resolve();
let lastGeocodingRequestAt = 0;

export async function refreshMatchWeather(row: any, defaultLocation: string, force = false): Promise<MatchWeather> {
  const id = String(row.id);
  const previous = weatherFromRow(row);
  const updatedAt = Date.parse(String(row.weather_updated_at || previous?.fetchedAt || ""));
  const cacheDuration = previous?.status === "UNAVAILABLE" ? FAILURE_CACHE_MS : CACHE_MS;
  if (!force && previous && Number.isFinite(updatedAt) && Date.now() - updatedAt < cacheDuration) return previous;
  const pending = inFlight.get(id);
  if (pending) return pending;
  const operation = fetchAndPersist(row, defaultLocation, previous).finally(() => inFlight.delete(id));
  inFlight.set(id, operation);
  return operation;
}

async function fetchAndPersist(row: any, defaultLocation: string, previous: MatchWeather | null) {
  const now = new Date(), fetchedAt = now.toISOString(), matchAt = new Date(String(row.match_at));
  const enteredAddress = String(row.location || "").trim();
  const requestedAddress = enteredAddress || String(defaultLocation || "Rio de Janeiro, Brasil").trim();
  let snapshot: MatchWeather;

  if (!Number.isFinite(matchAt.getTime()) || matchAt.getTime() < now.getTime() - 60 * 60 * 1000 || matchAt.getTime() > now.getTime() + FORECAST_HORIZON_MS) {
    snapshot = {
      status: "OUT_OF_RANGE", fetchedAt, requestedAddress,
      message: matchAt.getTime() < now.getTime() ? "A partida já ocorreu." : "A previsão ficará disponível até 9 dias antes da partida.",
      source: "MET Norway / OpenStreetMap",
    };
    return persist(idOf(row), snapshot);
  }

  try {
    let location = previous?.geocodedAddress === requestedAddress && finiteCoordinates(previous)
      ? { latitude: previous.latitude!, longitude: previous.longitude!, displayName: previous.resolvedAddress || requestedAddress, geocodedAddress: requestedAddress, usedDefault: Boolean(previous.usedDefaultLocation) }
      : await safeGeocode(requestedAddress, false);
    const fallback = String(defaultLocation || "Rio de Janeiro, Brasil").trim();
    if (!location && fallback && fallback.toLocaleLowerCase("pt-BR") !== requestedAddress.toLocaleLowerCase("pt-BR")) {
      location = await safeGeocode(fallback, true);
    }
    if (!location && isRioDefault(fallback)) location = rioFallback(fallback);
    if (!location) {
      snapshot = { status: "LOCATION_NOT_FOUND", fetchedAt, requestedAddress, message: "Não foi possível localizar o endereço da partida nem o endereço padrão.", source: "OpenStreetMap" };
      return persist(idOf(row), snapshot);
    }

    const forecast = await fetchForecast(location.latitude, location.longitude, matchAt);
    snapshot = {
      status: "AVAILABLE", fetchedAt, requestedAddress,
      geocodedAddress: location.geocodedAddress, resolvedAddress: location.displayName,
      latitude: location.latitude, longitude: location.longitude, usedDefaultLocation: location.usedDefault,
      ...forecast,
    };
  } catch (error) {
    logEvent("warn", "match_weather_refresh_failed", { matchId: idOf(row), requestedAddress, error });
    snapshot = {
      status: "UNAVAILABLE", fetchedAt, requestedAddress,
      geocodedAddress: previous?.geocodedAddress, resolvedAddress: previous?.resolvedAddress,
      latitude: previous?.latitude, longitude: previous?.longitude, usedDefaultLocation: previous?.usedDefaultLocation,
      message: "A previsão está temporariamente indisponível. O servidor tentará novamente após uma hora.",
      source: "MET Norway / OpenStreetMap",
    };
  }
  return persist(idOf(row), snapshot);
}

async function safeGeocode(address: string, usedDefault: boolean) {
  try { return await geocode(address, usedDefault); }
  catch (error) {
    logEvent("warn", "weather_geocoding_failed", { address, usedDefault, error });
    return null;
  }
}

function isRioDefault(address: string) {
  const normalized = address.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("rio de janeiro") && (normalized.includes("brasil") || normalized.includes("brazil"));
}

function rioFallback(address: string) {
  return { latitude: -22.9068, longitude: -43.1729, displayName: "Rio de Janeiro, RJ, Brasil", geocodedAddress: address, usedDefault: true };
}

async function persist(matchId: string, snapshot: MatchWeather) {
  await db().prepare(`UPDATE scheduled_matches SET weather_snapshot=?,weather_updated_at=? WHERE id=?`)
    .bind(JSON.stringify(snapshot), snapshot.fetchedAt, matchId).run();
  return snapshot;
}

function idOf(row: any) { return String(row.id); }
function finiteCoordinates(value: MatchWeather) { return Number.isFinite(value.latitude) && Number.isFinite(value.longitude); }

async function geocode(address: string, usedDefault: boolean) {
  const bindings = getRuntimeBindings();
  const base = bindings.WEATHER_GEOCODING_URL || "https://nominatim.openstreetmap.org/search";
  const url = new URL(base);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");
  if (bindings.WEATHER_CONTACT_EMAIL) url.searchParams.set("email", bindings.WEATHER_CONTACT_EMAIL);
  const response = await queuedGeocodingFetch(url, { "User-Agent": `PeladaWeather/1.0 (${bindings.APP_BASE_URL || "self-hosted"})` });
  const result = await response.json() as any[];
  const first = Array.isArray(result) ? result[0] : null;
  const latitude = Number(first?.lat), longitude = Number(first?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, displayName: String(first.display_name || address), geocodedAddress: address, usedDefault };
}

async function fetchForecast(latitude: number, longitude: number, matchAt: Date) {
  try { return await fetchMetForecast(latitude, longitude, matchAt); }
  catch (error) {
    logEvent("warn", "weather_primary_provider_failed", { provider: "MET Norway", latitude, longitude, error });
    return fetchOpenMeteoForecast(latitude, longitude, matchAt);
  }
}

async function fetchMetForecast(latitude: number, longitude: number, matchAt: Date) {
  const bindings = getRuntimeBindings();
  const url = new URL(bindings.WEATHER_FORECAST_URL || "https://api.met.no/weatherapi/locationforecast/2.0/compact");
  const start = new Date(matchAt); start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  url.searchParams.set("lat", latitude.toFixed(4));
  url.searchParams.set("lon", longitude.toFixed(4));
  const contact = bindings.WEATHER_CONTACT_EMAIL || bindings.APP_BASE_URL || "self-hosted";
  const response = await providerFetch(url, { "User-Agent": `PeladaWeather/1.0 ${contact}` });
  const payload = await response.json() as any;
  const summary = summarizeMetForecast(payload, start, end);
  if (!summary) throw new Error("Forecast without hourly values");
  return { forecastStart: start.toISOString(), forecastEnd: end.toISOString(), ...summary, source: "MET Norway / OpenStreetMap" };
}

async function fetchOpenMeteoForecast(latitude: number, longitude: number, matchAt: Date) {
  const bindings = getRuntimeBindings();
  const url = new URL(bindings.WEATHER_FALLBACK_FORECAST_URL || "https://api.open-meteo.com/v1/forecast");
  const start = new Date(matchAt); start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "16");
  url.searchParams.set("wind_speed_unit", "kmh");
  const response = await providerFetch(url);
  const payload = await response.json() as any;
  const summary = summarizeOpenMeteoForecast(payload, start, end);
  if (!summary) throw new Error("Fallback forecast without hourly values");
  return { forecastStart: start.toISOString(), forecastEnd: end.toISOString(), ...summary, source: "Open-Meteo / OpenStreetMap" };
}

async function providerFetch(url: URL, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    return response;
  } finally { clearTimeout(timeout); }
}

function queuedGeocodingFetch(url: URL, headers: Record<string, string>) {
  const operation = geocodingQueue.then(async () => {
    const wait = Math.max(0, 1_000 - (Date.now() - lastGeocodingRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastGeocodingRequestAt = Date.now();
    return providerFetch(url, headers);
  });
  geocodingQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
