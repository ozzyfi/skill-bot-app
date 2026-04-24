type Props = {
  num: number;
  text: string;
  ref_?: string;
  expected?: string;
  done: boolean;
  onToggle: () => void;
};

/** Adım adım checklist kartı. Tıklayınca done olur (üstü çizilir). */
export default function StepCard({ num, text, ref_, expected, done, onToggle }: Props) {
  return (
    <button type="button" onClick={onToggle} className={`step ${done ? "done" : ""}`}>
      <div className="step-num">
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          num
        )}
      </div>
      <div className="step-body">
        <div className="step-text">{text}</div>
        {ref_ && <div className="step-ref">{ref_}</div>}
        {expected && <div className="step-expected">Beklenen: {expected}</div>}
      </div>
    </button>
  );
}
