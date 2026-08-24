"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";

const labels: Record<string, string> = { PAID: "Pago", PENDING: "Pendente", OVERDUE: "Atrasado", EXEMPT: "Isento", CANCELLED: "Cancelado" };

export function PlayerFinancialHistory() {
  const [data, setData] = useState<any>(), [error, setError] = useState("");
  useEffect(() => { fetch("/api/finance?view=self", { cache: "no-store" }).then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setData(payload); }).catch(cause => setError(cause.message)); }, []);
  return <section className="player-financial-history"><div className="finance-card-head"><div><div className="eyebrow">FINANCEIRO</div><h2>Meu histórico financeiro</h2><p>Somente você e os administradores podem visualizar estes valores.</p></div>{data && <strong>Total pendente: {money(data.totalPendingCents)}</strong>}</div>
    {error ? <div className="alert error">{error}</div> : !data ? <div className="finance-empty">Carregando histórico…</div> : !data.charges.length ? <div className="finance-empty">Nenhuma cobrança registrada para você.</div> : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Competência</th><th>Descrição</th><th>Cobrado</th><th>Pago</th><th>Restante</th><th>Situação</th></tr></thead><tbody>{data.charges.map((charge: any) => <tr key={charge.id}><td>{month(charge.competence)}</td><td>{charge.description}</td><td>{money(charge.amountCents)}</td><td>{money(charge.paidCents)}</td><td>{money(charge.remainingCents)}</td><td><span className={`finance-status status-${charge.status.toLowerCase()}`}><i aria-hidden="true"/>{labels[charge.status] || charge.status}</span></td></tr>)}</tbody></table></div>}
    <a className="finance-history-link" href="/financeiro">Abrir visão financeira completa →</a>
  </section>;
}

function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100); }
function month(value: string) { const [year, number] = value.split("-").map(Number); return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, number - 1, 1))); }
