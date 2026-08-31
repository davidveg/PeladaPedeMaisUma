import assert from "node:assert/strict";
import test from "node:test";
import { describeWeatherSymbol, describeWmoWeatherCode, summarizeMetForecast, summarizeOpenMeteoForecast, weatherFromRow, weatherSummaryFromRow } from "../lib/weather-presentation.ts";

test("resumo usa apenas a previsão salva, preserva zero e não expõe o snapshot completo", () => {
  const weather = { status: "AVAILABLE", fetchedAt: "2020-01-01T00:00:00Z", requestedAddress: "Endereço", latitude: 12,
    temperatureMin: -2, temperatureMax: 0, windSpeed: 0, description: "Nublado", icon: "☁️", usedDefaultLocation: true };
  assert.deepEqual(weatherSummaryFromRow({ weather_snapshot: JSON.stringify(weather) }), {
    description: "Nublado", icon: "☁️", temperatureMin: -2, temperatureMax: 0, windSpeed: 0, usedDefaultLocation: true,
  });
});

test("resumo diferencia dados ausentes de valores zero e tolera registros inválidos", () => {
  for (const value of [null, "{", "null", "[]", '"texto"', JSON.stringify({ status: "AVAILABLE" }),
    ...["UNAVAILABLE", "OUT_OF_RANGE", "LOCATION_NOT_FOUND"].map(status => JSON.stringify({ status, temperatureMin: 22 }))]) {
    assert.equal(weatherSummaryFromRow({ weather_snapshot: value }), null);
  }
  assert.deepEqual(weatherSummaryFromRow({ weather_snapshot: JSON.stringify({ status: "AVAILABLE", description: "Chuva", temperatureMin: "20", temperatureMax: null, windSpeed: -1, icon: {} }) }), {
    description: "Chuva", icon: null, temperatureMin: null, temperatureMax: null, windSpeed: null, usedDefaultLocation: false,
  });
});

test("traduz os símbolos do MET Norway para a apresentação da partida", () => {
  assert.deepEqual(describeWeatherSymbol("clearsky_day"), { description: "Céu limpo", icon: "☀️" });
  assert.deepEqual(describeWeatherSymbol("partlycloudy_night"), { description: "Parcialmente nublado", icon: "⛅" });
  assert.deepEqual(describeWeatherSymbol("heavyrainandthunder"), { description: "Trovoadas", icon: "⛈️" });
});

test("lê o snapshot persistido e ignora JSON corrompido", () => {
  const weather = { status: "AVAILABLE", fetchedAt: "2026-08-08T12:00:00.000Z", temperatureMin: 22 };
  assert.deepEqual(weatherFromRow({ weather_snapshot: JSON.stringify(weather) }), weather);
  assert.equal(weatherFromRow({ weather_snapshot: "{" }), null);
  assert.equal(weatherFromRow({}), null);
});

test("resume as três horas da partida e converte vento para km/h", () => {
  const start = new Date("2026-08-09T12:00:00.000Z"), end = new Date("2026-08-09T14:00:00.000Z");
  const entry = (time, temperature, wind, rain, probability, symbol) => ({ time, data: { instant: { details: { air_temperature: temperature, wind_speed: wind } }, next_1_hours: { details: { precipitation_amount: rain, probability_of_precipitation: probability }, summary: { symbol_code: symbol } } } });
  const result = summarizeMetForecast({ properties: { timeseries: [
    entry("2026-08-09T11:00:00Z", 30, 1, 0, 0, "clearsky_day"),
    entry("2026-08-09T12:00:00Z", 26, 2, .2, 30, "partlycloudy_day"),
    entry("2026-08-09T13:00:00Z", 24, 3, 1.1, 70, "rain"),
    entry("2026-08-09T14:00:00Z", 23, 4, .4, 50, "cloudy"),
  ] } }, start, end);
  assert.deepEqual(result, { temperatureMin: 23, temperatureMax: 26, apparentTemperature: 24.3, precipitationProbability: 70, precipitation: 1.7, windSpeed: 14.4, description: "Chuva", icon: "🌧️" });
});

test("resume a previsão secundária do Open-Meteo no mesmo formato", () => {
  const start = new Date("2026-08-09T12:00:00.000Z"), end = new Date("2026-08-09T14:00:00.000Z");
  const result = summarizeOpenMeteoForecast({ hourly: {
    time: ["2026-08-09T11:00", "2026-08-09T12:00", "2026-08-09T13:00", "2026-08-09T14:00"],
    temperature_2m: [30, 26, 24, 23], apparent_temperature: [32, 27, 25, 24],
    precipitation_probability: [0, 30, 70, 50], precipitation: [0, .2, 1.1, .4],
    weather_code: [0, 2, 61, 3], wind_speed_10m: [3, 7, 12, 15],
  } }, start, end);
  assert.deepEqual(result, { temperatureMin: 23, temperatureMax: 26, apparentTemperature: 25.3, precipitationProbability: 70, precipitation: 1.7, windSpeed: 15, description: "Chuva", icon: "🌧️" });
  assert.deepEqual(describeWmoWeatherCode(95), { description: "Trovoadas", icon: "⛈️" });
});
