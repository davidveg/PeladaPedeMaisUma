type Props = {
  blueScore: number | null;
  yellowScore: number | null;
  blueName: string;
  yellowName: string;
};

/** List-card presentation only; never invent a result for an unplayed match. */
export function MatchCardScore({ blueScore, yellowScore, blueName, yellowName }: Props) {
  if (blueScore == null || yellowScore == null || !Number.isFinite(blueScore) || !Number.isFinite(yellowScore)) return null;
  return <div className="match-hub-final-score" role="group" aria-label={`Placar final: ${blueName} ${blueScore} a ${yellowScore} ${yellowName}`}>
    <span className="match-hub-final-score-label">Placar final</span>
    <div className="match-hub-final-score-board" aria-hidden="true">
      <div className="match-hub-final-score-team blue">
        <span className="match-hub-final-score-name">{blueName}</span>
        <strong>{blueScore}</strong>
      </div>
      <span className="match-hub-final-score-divider">×</span>
      <div className="match-hub-final-score-team yellow">
        <span className="match-hub-final-score-name">{yellowName}</span>
        <strong>{yellowScore}</strong>
      </div>
    </div>
  </div>;
}
