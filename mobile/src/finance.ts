import type { Account } from "./types";

export type FinanceCharge = {
  id: string;
  playerName?: string | null;
  type: string;
  description: string;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  competence: string;
  dueDate: string;
  status: string;
  storedStatus: string;
  lastPaidAt?: string | null;
};

export type FinanceSummary = {
  currentBalanceCents: number;
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  receivableCents: number;
  payableCents: number;
  players: { current: number; pending: number; overdue: number };
};

export type FinancePayload = {
  viewer: { canManage?: boolean; playerId?: string | null };
  competence: string;
  charges: FinanceCharge[];
  payments?: { id: string; chargeId: string; amountCents: number; paidAt: string; method: string; status: string }[];
  totalPendingCents?: number;
  settings?: { defaultMonthlyFeeCents: number; pixKey?: string | null };
  summary?: FinanceSummary;
};

export const financeStatusLabels: Record<string, string> = {
  PAID: "Pago", PENDING: "Pendente", OVERDUE: "Atrasado", EXEMPT: "Isento", CANCELLED: "Cancelado",
};

export function financeEntryVisible(account: Account | null | undefined, enabled: boolean) {
  if (!enabled || !account) return false;
  return Boolean(account.playerId || account.role === "admin" || (account.role === "moderator" && account.permissions?.includes("FINANCE_MANAGE")));
}

export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0) / 100).replace(/\u00a0/g, " ");
}

export function competenceLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

export function moveCompetence(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthlyPaymentsMessage(data: FinancePayload) {
  const charges = data.charges
    .filter(charge => charge.type === "MONTHLY_FEE" && charge.playerName)
    .sort((left, right) => String(left.playerName).localeCompare(String(right.playerName), "pt-BR", { sensitivity: "base" }));
  const lines = charges.map((charge, index) => `${index + 1} - ${charge.playerName}: ${paymentMarker(charge)}`.trimEnd());
  const activeAmounts = new Set(charges.filter(charge => charge.storedStatus !== "CANCELLED").map(charge => charge.amountCents));
  const standard = data.settings?.defaultMonthlyFeeCents || 0;
  const amount = activeAmounts.size === 1
    ? `Valor: ${money([...activeAmounts][0] ?? standard)}`
    : `Valor padrão: ${money(standard)}\n_Alguns mensalistas possuem valor personalizado._`;
  const pix = String(data.settings?.pixKey || "").trim();
  const month = competenceLabel(data.competence).toLocaleLowerCase("pt-BR").replace(" de ", " ");
  return `*Pagamento ${month}:*\n\n${lines.join("\n")}${pix ? `\n\n*ATENÇÃO: PIX para pagamento:* ${pix}` : ""}\n\n${amount}`;
}

function paymentMarker(charge: FinanceCharge) {
  if (charge.storedStatus === "PAID") return `✅${charge.lastPaidAt?.slice(0, 7) && charge.lastPaidAt.slice(0, 7) < charge.competence ? " (antecipou)" : ""}`;
  if (charge.storedStatus === "EXEMPT") return "ISENTO";
  if (charge.storedStatus === "CANCELLED") return "CANCELADO";
  if (charge.paidCents > 0) return `🟡 parcial: ${money(charge.paidCents)} de ${money(charge.amountCents)}`;
  return "";
}
