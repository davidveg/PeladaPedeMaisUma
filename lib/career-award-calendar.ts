export function isLastRegularMatchOfMonth(matchDate: string, regularWeekday: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate) || !Number.isInteger(regularWeekday) || regularWeekday < 0 || regularWeekday > 6) return false;
  const date = new Date(`${matchDate}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return false;
  const daysUntilNextRegularGame = ((regularWeekday - date.getUTCDay() + 7) % 7) || 7;
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + daysUntilNextRegularGame);
  return next.toISOString().slice(0, 7) !== matchDate.slice(0, 7);
}
