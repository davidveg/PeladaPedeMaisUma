import type { MatchHubWeather } from "../../lib/match-hub";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function MatchCardWeather({ weather }: { weather?: MatchHubWeather | null }) {
  if (!weather) return <div className="match-hub-weather-empty">
    <span aria-hidden="true">☁️</span><span>Não há previsão do tempo registrada para esta partida.</span>
  </div>;

  const { temperatureMin: min, temperatureMax: max } = weather;
  const temperature = min !== null && max !== null && min !== max
    ? `${number.format(min)}–${number.format(max)} °C`
    : min !== null || max !== null ? `${number.format((min ?? max)!)} °C` : "Não informada";
  const metrics = [
    { label: "Tempo", icon: weather.icon || "☁️", value: weather.description || "Não informado" },
    { label: "Temperatura", icon: "🌡️", value: temperature },
    { label: "Vento", icon: "💨", value: weather.windSpeed !== null ? `${number.format(weather.windSpeed)} km/h` : "Não informado" },
  ];
  return <div className="match-hub-weather">
    <span className="match-hub-weather-heading">Previsão registrada</span>
    <dl className="match-hub-weather-grid">{metrics.map(metric => <div key={metric.label}>
      <dt>{metric.label}</dt>
      <dd><span className="match-hub-weather-icon" aria-hidden="true">{metric.icon}</span><strong>{metric.value}</strong></dd>
    </div>)}</dl>
    {weather.usedDefaultLocation && <span className="match-hub-weather-note">Previsão para o local padrão da pelada.</span>}
  </div>;
}
