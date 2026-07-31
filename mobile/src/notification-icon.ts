export function notificationIcon(type: string, title = "") {
  if (type === "ATTENDANCE_CHANGED") return title === "Ausência informada" ? "❌" : "✅";
  return type === "APP_RELEASED" ? "⬆️" : type === "MATCH_CREATED" ? "📅" : type === "MATCH_CANCELLED" ? "🚫" : "📣";
}
