const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export function brazilianDateTimeParts(value?: string | null) {
  if (!value) return { date: "", time: "" };
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || "";
  return { date: `${part("day")}/${part("month")}/${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}

export function brazilianDateTimeIso(dateValue: string, timeValue: string) {
  const date = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/), time = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!date || !time) return "";
  const day = Number(date[1]), month = Number(date[2]), year = Number(date[3]), hour = Number(time[1]), minute = Number(time[2]);
  if (year < 2020 || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate() || hour > 23 || minute > 59) return "";
  return new Date(`${date[3]}-${date[2]}-${date[1]}T${time[1]}:${time[2]}:00-03:00`).toISOString();
}

export function brazilianDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

export function brazilianDateOnly(value?: string | null) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function brazilianTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean).join(":");
}
