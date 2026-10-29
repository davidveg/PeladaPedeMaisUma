"use client";

import { useEffect } from "react";
import type { Config, Player } from "../../lib/football";
import { playerRatingBreakdown } from "../../lib/player-rating-breakdown";

const decimal = (value: number, digits = 2) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${decimal(value, digits)}`;

export function MomentumImpactTrigger({ player, config, onOpen }: { player: Player; config: Config; onOpen: () => void }) {
  const breakdown = playerRatingBreakdown(player, config);
  const tone = Math.abs(breakdown.accumulatedMomentum) < 0.0001 ? "neutral" : breakdown.momentumImpact > 0 ? "positive" : breakdown.momentumImpact < 0 ? "negative" : "neutral";
  return <button type="button" className={`momentum-impact-trigger ${tone}`} onClick={onOpen} aria-haspopup="dialog" aria-label={`Ver composição do Overall. Impacto do Momentum: ${signed(breakdown.momentumImpact, 2)}`}>
    {signed(breakdown.momentumImpact, 2)} no OVR
  </button>;
}

export function OverallBreakdown({ player, config, onClose, className = "" }: { player: Player; config: Config; onClose: () => void; className?: string }) {
  const value = playerRatingBreakdown(player, config);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const note = value.limited
    ? `O cálculo chegou a ${decimal(value.calculatedOverall)}, mas o Overall exibido respeita o limite de ${value.calculatedOverall > 5 ? "5,0" : "1,0"}.`
    : value.rounded
      ? `O cálculo chegou a ${decimal(value.limitedOverall)}, e o Overall é exibido com uma casa decimal.`
      : `O Momentum acumulado é ${signed(value.accumulatedMomentum, 1)}, mas o impacto aplicado ao OVR é ${signed(value.momentumImpact, 2)}.`;
  return <section className={`overall-breakdown ${className}`} role="dialog" aria-modal="true" aria-labelledby={`overall-breakdown-title-${player.id}`}>
    <div className="overall-breakdown-handle" aria-hidden="true"/>
    <header><div><small>TRANSPARÊNCIA DO CARD</small><h3 id={`overall-breakdown-title-${player.id}`}>Como chegamos ao OVR</h3></div><button type="button" autoFocus onClick={onClose} aria-label="Fechar composição do Overall">×</button></header>
    <p>O Overall combina os atributos, a evolução permanente e os saldos temporários de Momentum com seus respectivos pesos.</p>
    <dl>
      <div><dt>OVR-base pelos atributos</dt><dd>{decimal(value.base)}</dd></div>
      <div><dt>Evolução permanente</dt><dd className={value.evolution > 0 ? "positive" : value.evolution < 0 ? "negative" : ""}>{signed(value.evolution)}</dd></div>
      <div className="momentum-source"><dt><b>Resultados</b><span>{signed(value.resultMomentum, 1)} × {decimal(value.resultMultiplier, 1)}</span><em>{decimal(value.resultMultiplier, 1)}×</em></dt><dd className={value.resultImpact > 0 ? "positive" : value.resultImpact < 0 ? "negative" : ""}>{signed(value.resultImpact)}</dd></div>
      <div className="momentum-source"><dt><b>Votações</b><span>{signed(value.votingMomentum, 1)} × {decimal(value.votingMultiplier, 1)}</span><em>{decimal(value.votingMultiplier, 1)}×</em></dt><dd className={value.votingImpact > 0 ? "positive" : value.votingImpact < 0 ? "negative" : ""}>{signed(value.votingImpact)}</dd></div>
      <div className="calculated"><dt>Overall calculado</dt><dd>{decimal(value.calculatedOverall)}</dd></div>
      <div className="displayed"><dt>OVERALL EXIBIDO</dt><dd>{decimal(value.displayedOverall, 1)}</dd></div>
    </dl>
    <aside><span aria-hidden="true">i</span><p>{note}</p></aside>
  </section>;
}
