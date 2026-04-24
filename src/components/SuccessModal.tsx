type Props = {
  open: boolean;
  title: string;
  sub?: string;
  idLabel?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export default function SuccessModal({ open, title, sub, idLabel, ctaLabel = "Tamam", onCta }: Props) {
  if (!open) return null;
  return (
    <div className="success-modal">
      <div className="success-card">
        <div className="success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="text-[20px] font-bold tracking-tight mb-1.5">{title}</div>
        {sub && <div className="text-[14px] text-text-2 mb-3.5 leading-snug">{sub}</div>}
        {idLabel && (
          <div className="text-[13px] py-2 px-3 bg-bg-2 rounded-lg text-text-2 font-semibold mb-4 inline-block">
            {idLabel}
          </div>
        )}
        <button className="btn-primary w-full" onClick={onCta}>{ctaLabel}</button>
      </div>
    </div>
  );
}
