/* eslint-disable @typescript-eslint/no-explicit-any */
import { playerAccountRequired, staffRequired } from "../../../lib/database";
import { isFinanceEnabled } from "../../../lib/finance-feature";
import {
  cancelCharge, cancelExpense, closeMonth, createCharge, createExpense, createRecurringExpense,
  FinanceError, generateMonthlyFees, generateRecurringExpenses, loadFinance, payExpense,
  registerPayment, reopenMonth, reverseExpensePayment, reversePayment, saveSettings, toggleChargeExemption,
} from "../../../lib/finance-service";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!(await isFinanceEnabled())) return disabled();
  const viewer: any = await playerAccountRequired(request);
  if (!viewer) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const parameters = new URL(request.url).searchParams;
  const selfOnly = parameters.get("view") === "self";
  const manager: any = selfOnly ? null : await staffRequired(request, "FINANCE_MANAGE");
  try { return Response.json(await loadFinance(parameters.get("competence"), manager || viewer, selfOnly, Boolean(manager)), { headers: noStore }); }
  catch (error: any) { return failure(error); }
}

export async function POST(request: Request) {
  if (!(await isFinanceEnabled())) return disabled();
  const admin: any = await staffRequired(request, "FINANCE_MANAGE");
  if (!admin) return Response.json({ error: "Sem permissão para administrar o financeiro." }, { status: 403, headers: noStore });
  const payload = await request.json().catch(() => ({})) as any;
  try {
    const actions: Record<string, (body: any, account: any) => Promise<any>> = {
      "save-settings": saveSettings, "generate-monthly": generateMonthlyFees, "create-charge": createCharge,
      "register-payment": registerPayment, "reverse-payment": reversePayment, "cancel-charge": cancelCharge,
      "toggle-charge-exemption": toggleChargeExemption,
      "create-expense": createExpense, "pay-expense": payExpense, "cancel-expense": cancelExpense,
      "reverse-expense-payment": reverseExpensePayment,
      "create-recurring-expense": createRecurringExpense, "generate-recurring-expenses": generateRecurringExpenses,
      "close-month": closeMonth, "reopen-month": reopenMonth,
    };
    const handler = actions[String(payload.action || "")];
    if (!handler) throw new FinanceError("Ação financeira inválida.");
    return Response.json(await handler(payload, admin), { headers: noStore });
  } catch (error: any) { return failure(error); }
}

function failure(error: any) {
  const status = error instanceof FinanceError ? error.status : 500;
  return Response.json({ error: status === 500 ? "Não foi possível concluir a operação financeira." : error.message }, { status, headers: noStore });
}

function disabled() {
  return Response.json({ error: "O módulo financeiro está desativado." }, { status: 404, headers: noStore });
}
