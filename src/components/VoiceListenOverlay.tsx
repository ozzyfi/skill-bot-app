type Props = {
  open: boolean;
  transcript: string;
  parsing?: boolean;
  onStop: () => void;
  onCancel: () => void;
};

/** Sesli kayıt alt-sheet. Mevcut Web Speech API mantığı CloseWO içinde kalır;
 *  bu sadece görseli temsil eder (waveform + canlı transcript + Bitir/İptal). */
export default function VoiceListenOverlay({ open, transcript, parsing, onStop, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="listen-overlay" onClick={onCancel}>
      <div className="listen-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="listen-label">
          <span className="listen-rec" />
          {parsing ? "AI işliyor" : "Dinleniyor"}
        </div>
        <div className="listen-hint">
          {parsing ? "Anlatılanlar alanlara yerleştiriliyor…" : "Türkçe konuş — bittiğinde Bitir'e bas"}
        </div>
        <div className="waveform">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="wave-bar" />
          ))}
        </div>
        <div className={`transcript ${transcript ? "" : ""}`}>
          {transcript ? (
            <span className="cursor-blink">{transcript}</span>
          ) : (
            <span className="ph">Konuşmaya başla…</span>
          )}
        </div>
        <div className="flex gap-2.5">
          <button className="btn-secondary flex-1" onClick={onCancel} disabled={parsing}>İptal</button>
          <button className="btn-primary flex-1" onClick={onStop} disabled={parsing}>
            {parsing ? "İşleniyor…" : "Bitir"}
          </button>
        </div>
      </div>
    </div>
  );
}
