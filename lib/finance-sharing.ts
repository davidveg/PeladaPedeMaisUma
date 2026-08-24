export type MonthlyPaymentShareItem = {
  playerName?: string | null;
  amountCents: number;
  paidCents: number;
  competence: string;
  storedStatus: string;
  lastPaidAt?: string | null;
};

export function buildMonthlyPaymentsWhatsAppMessage({
  competence,
  charges,
  pixKey,
  defaultMonthlyFeeCents,
}: {
  competence: string;
  charges: MonthlyPaymentShareItem[];
  pixKey?: string | null;
  defaultMonthlyFeeCents: number;
}) {
  const month = competenceLabel(competence);
  const monthly = charges
    .filter(charge => charge.playerName)
    .sort((left, right) => String(left.playerName).localeCompare(String(right.playerName), "pt-BR", { sensitivity: "base" }));
  const lines = monthly.map((charge, index) => `${index + 1} - ${charge.playerName}: ${paymentMarker(charge, competence)}`.trimEnd());
  const activeAmounts = new Set(monthly.filter(charge => charge.storedStatus !== "CANCELLED").map(charge => charge.amountCents));
  const amountLabel = activeAmounts.size === 1
    ? `Valor: ${money([...activeAmounts][0] ?? defaultMonthlyFeeCents)}`
    : `Valor padrão: ${money(defaultMonthlyFeeCents)}\n_Alguns mensalistas possuem valor personalizado._`;
  const paymentInstructions = String(pixKey || "").trim()
    ? `\n\n*ATENÇÃO: PIX para pagamento:* ${String(pixKey).trim()}\n\n${amountLabel}`
    : `\n\n${amountLabel}`;
  return `*Pagamento ${month}:*\n\n${lines.join("\n")}${paymentInstructions}`;
}

function paymentMarker(charge: MonthlyPaymentShareItem, competence: string) {
  if (charge.storedStatus === "PAID") {
    const anticipated = Boolean(charge.lastPaidAt && charge.lastPaidAt.slice(0, 7) < competence);
    return `✅${anticipated ? " (antecipou)" : ""}`;
  }
  if (charge.storedStatus === "EXEMPT") return "ISENTO";
  if (charge.storedStatus === "CANCELLED") return "CANCELADO";
  if (charge.paidCents > 0) return `🟡 parcial: ${money(charge.paidCents)} de ${money(charge.amountCents)}`;
  return "";
}

function competenceLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${monthName} ${year}`;
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0) / 100).replace(/\u00a0/g, " ");
}
