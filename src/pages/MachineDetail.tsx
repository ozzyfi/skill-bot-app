import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Machine, Technician } from "@/types/db";
import LogAnalyzerPanel from "@/components/LogAnalyzerPanel";

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
);
const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const SparkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.3 0 .56.2.64.49l1.36 5.01 5.01 1.36a.67.67 0 0 1 0 1.28l-5.01 1.36-1.36 5.01a.67.67 0 0 1-1.28 0l-1.36-5.01-5.01-1.36a.67.67 0 0 1 0-1.28l5.01-1.36 1.36-5.01A.67.67 0 0 1 12 2z"/></svg>
);

const RISK_DEFAULT = [
  { title: "H-201 arızası tekrar riski", sub: "312 vakadan hesaplandı · Ort. 65 günde bir", pct: "%74", detail: "Tahmini sonraki tekrar: <strong>15 Haziran 2026</strong> (±10 gün)", warn: false },
  { title: "Yaz şartları uyarısı", sub: "Hidrolik yağ ısınması riski artıyor", pct: "%41", detail: "Yaz aylarında <strong>pompa contası ömrü %30 azalıyor</strong> (112 vaka). Soğutucu fan kontrolü önerilir.", warn: true },
];

const SERVICE_LOG_DEFAULT = [
  { date: "10 Mart 2026", what: "Yağ filtresi değişimi", dur: "1,5s" },
  { date: "18 Ocak 2026", what: "Basınç valfi ayarı", dur: "2s" },
  { date: "4 Kasım 2025", what: "Hidrolik pompa revizyonu", dur: "4s" },
  { date: "22 Eylül 2025", what: "Rutin bakım", dur: "1s" },
];

export default function MachineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [usta, setUsta] = useState<Technician | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: m } = await supabase.from("machines").select("*").eq("id", id).maybeSingle();
      setMachine(m as Machine | null);
      if (m) {
        const { data: tList } = await supabase
          .from("technicians").select("*").eq("region", m.region).limit(1);
        setUsta(((tList ?? [])[0] ?? null) as Technician | null);
      }
    })();
  }, [id]);

  if (!machine) return <div className="p-8 text-center text-text-3">Yükleniyor...</div>;

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate(-1)}>
          <ChevronLeftIcon /> Geri
        </button>
        <div className="topbar-title">Makine</div>
        <div className="topbar-action" />
      </div>

      {usta && (
        <div className="mx-5 mt-3 px-3 py-2 bg-primary-bg rounded-lg text-xs text-primary font-semibold flex items-center gap-1.5">
          <span className="text-base">👤</span>
          <span>{usta.full_name} · {usta.experience_years} yıl · {usta.city}</span>
        </div>
      )}

      {/* Machine detail top */}
      <div className="machine-detail-top">
        <div className="machine-detail-name">{machine.name}</div>
        <div className="machine-detail-loc">
          <PinIcon />
          <span>{machine.district}, {machine.city}</span>
        </div>
        <div className="machine-detail-status-row">
          {machine.status === "ok" ? (
            <div className="machine-status ok">Çalışıyor</div>
          ) : (
            <div className={`machine-status ${machine.status}`}>
              {machine.status === "fault" ? "Arıza" : machine.status === "busy" ? "Atandı" : "Bakımda"}
            </div>
          )}
        </div>
      </div>

      {/* Spec */}
      <div className="machine-spec">
        <div className="machine-spec-title">Makine Bilgileri</div>
        <div className="spec-grid">
          <Spec k="Model" v={machine.model} />
          <Spec k="Seri No" v={machine.serial_no ?? "-"} />
          <Spec k="Üretim Yılı" v={String(machine.year ?? "-")} />
          <Spec k="Çalışma saati" v={`${machine.operating_hours.toLocaleString("tr-TR")} sa`} />
          <Spec k="Son servis" v={fmtFull(machine.last_service)} />
          <Spec k="Sonraki bakım" v={fmtFull(machine.next_maintenance)} />
        </div>
      </div>

      {/* Risk */}
      <div className="section">
        <div className="section-title">Risk Analizi</div>
        <div className="section-sub">Saha vakalarına göre tahmin</div>
        {RISK_DEFAULT.map((r, i) => (
          <div key={i} className="risk-card">
            <div className="risk-head">
              <div className={`risk-icon ${r.warn ? "warn" : ""}`}>
                {r.warn ? <AlertIcon /> : <ClockIcon />}
              </div>
              <div className="risk-body">
                <div className="risk-title">{r.title}</div>
                <div className="risk-sub">{r.sub}</div>
              </div>
              <div className="risk-pct">{r.pct}</div>
            </div>
            <div className="risk-detail" dangerouslySetInnerHTML={{ __html: r.detail }} />
          </div>
        ))}
      </div>

      {/* Service history */}
      <div className="section">
        <div className="section-title">Servis Geçmişi</div>
        <div className="section-sub">Son işlemler</div>
        {SERVICE_LOG_DEFAULT.map((l, i) => (
          <div key={i} className="log">
            <div className="log-date">{l.date}</div>
            <div className="log-what">{l.what}</div>
            <div className="log-dur">{l.dur}</div>
          </div>
        ))}
      </div>

      {/* Log analyzer (gerçek backend bağlantısı) */}
      <LogAnalyzerPanel machineId={machine.id} region={machine.region} />

      {/* Machine actions */}
      <div className="machine-actions">
        <button className="btn btn-secondary" onClick={() => navigate("/diagnosis", { state: { question: `${machine.name} için sor` } })}>
          <SparkIcon />
          Bu makine için sor
        </button>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          İş bildir
        </button>
      </div>
    </div>
  );
}

const Spec = ({ k, v }: { k: string; v: string }) => (
  <div className="spec-item">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

const fmtFull = (d: string | null) => {
  if (!d) return "-";
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
};
