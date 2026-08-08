type Weather = {
  status: string; fetchedAt: string; description?: string; icon?: string;
  temperatureMin?: number; temperatureMax?: number; apparentTemperature?: number;
  precipitationProbability?: number; precipitation?: number; windSpeed?: number;
  resolvedAddress?: string; usedDefaultLocation?: boolean; message?: string;
  source?: string;
};

export function WeatherPreview({ weather, compact = false }: { weather?: Weather | null; compact?: boolean }) {
  if (!weather) return <div className="weather-preview pending"><span>🌤️</span><div><b>Previsão do tempo</b><small>Aguardando a primeira atualização do servidor.</small></div></div>;
  if (weather.status !== "AVAILABLE") return <div className={`weather-preview ${compact ? "compact" : ""} unavailable`}><span>🌤️</span><div><b>Previsão do tempo</b><small>{weather.message || "Previsão indisponível no momento."}</small></div></div>;
  const temperature = weather.temperatureMin === weather.temperatureMax ? `${weather.temperatureMin} °C` : `${weather.temperatureMin}–${weather.temperatureMax} °C`;
  return <div className={`weather-preview ${compact ? "compact" : ""}`}>
    <span className="weather-icon">{weather.icon || "🌤️"}</span>
    <div className="weather-summary"><b>{weather.description || "Previsão do tempo"}</b><strong>{temperature}</strong><small>Período estimado de 2 horas</small></div>
    <div className="weather-metrics"><span><b>{weather.precipitationProbability ?? 0}%</b>chance de chuva</span><span><b>{weather.windSpeed ?? 0} km/h</b>vento máximo</span><span><b>{weather.precipitation ?? 0} mm</b>precipitação</span></div>
    <div className="weather-source">{weather.usedDefaultLocation ? <em>Local não encontrado; previsão pelo endereço padrão.</em> : null}<small>{weather.resolvedAddress}</small><small>Atualizado {new Date(weather.fetchedAt).toLocaleString("pt-BR")} · {weather.source || "Serviço meteorológico"}</small></div>
  </div>;
}
