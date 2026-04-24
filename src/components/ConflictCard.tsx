type Props = {
  manual: string;     // Kılavuzda yazan
  field: string;      // Sahada gördüğümüz
  winner?: string;    // Hangisi kazandı / hangisini izle
};

/** Kılavuz vs Saha çelişki kartı (sarı). */
export default function ConflictCard({ manual, field, winner }: Props) {
  return (
    <div className="conflict-card">
      <div className="conflict-row"><span className="k">Kılavuz:</span><span>{manual}</span></div>
      <div className="conflict-row"><span className="k">Saha:</span><span>{field}</span></div>
      {winner && <div className="conflict-win">→ {winner}</div>}
    </div>
  );
}
