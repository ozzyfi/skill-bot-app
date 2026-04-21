import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Machine, Technician } from "@/types/db";
import { ChevronLeft, Pin, Clock, Alert } from "@/components/icons";

const RISK_DEFAULT = [
  { title: "H-201 arızası tekrar riski", sub: "312 vakadan hesaplandı · Ort. 65 günde bir", pct: "%74", detail: "Tahmini sonraki tekrar: <strong>15 Haziran 2026</strong> (±10 gün)", warn: false },
  { title: "Yaz şartları uyarısı", sub: "Sıcaklık + yağ viskozitesi", pct: "%41", detail: "Temmuz–Ağustos arası valf gevşemesi vakaları %38 artıyor.", warn: true },
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
      <div className="grid grid-cols-[80px_1fr_80px] items-center px-5 py-3.5 border-b border-border min-h-[56px]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[15px] font-medium text-text-2 active:text-foreground -ml-1 py-2">
          <ChevronLeft /> Geri
        </button>
        <div className="text-[17px] font-semibold tracking-tight text-center">Makine</div>
        <div />
      </div>

      {usta && (
        <div className="mx-5 mb-3 px-3 py-2 bg-primary-bg rounded-lg text-xs text-primary font-semibold flex items-center gap-1.5">
          <span className="text-base">👤</span>
          <span>
            {usta.full_name} · {usta.experience_years} yıl · {usta.city}
          </span>
        </div>
      )}

      <div className="px-5 pt-1 pb-4 border-b border-border">
        <div className="text-[22px] font-bold tracking-tight leading-tight mb-2">{machine.name}</div>
        <div className="flex items-center gap-1 text-sm text-text-2 mb-2.5">
          <Pin />
          <span>{machine.district}, {machine.city}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {machine.status !== "ok" && (
            <span className={`ms-badge ${machine.status}`}>
              {machine.status === "fault" ? "Arıza" : machine.status === "busy" ? "Atandı" : "Bakımda"}
            </span>
          )}
          {machine.status === "ok" && <span className="ms-badge ok">Çalışıyor</span>}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Makine Bilgileri</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <Spec k="Model" v={machine.model} />
          <Spec k="Seri No" v={machine.serial_no ?? "-"} />
          <Spec k="Üretim Yılı" v={String(machine.year ?? "-")} />
          <Spec k="Çalışma saati" v={`${machine.operating_hours.toLocaleString("tr-TR")} sa`} />
          <Spec k="Son servis" v={fmtFull(machine.last_service)} />
          <Spec k="Sonraki bakım" v={fmtFull(machine.next_maintenance)} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Risk Analizi</div>
        <div className="section-sub">Saha vakalarına göre tahmin</div>
        {RISK_DEFAULT.map((r, i) => (
          <div key={i} className="risk-card">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`risk-icon ${r.warn ? "warn" : ""}`}>
                {r.warn ? <Alert /> : <Clock />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight">{r.title}</div>
                <div className="text-xs text-text-3 mt-0.5">{r.sub}</div>
              </div>
              <div className="text-xl font-bold text-primary tracking-tight">{r.pct}</div>
            </div>
            <div className="text-[13px] text-text-2 leading-snug pt-2 border-t border-dashed border-border" dangerouslySetInnerHTML={{ __html: r.detail }} />
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 p-3 bg-background border-t border-border flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => navigate("/diagnosis")}>
          Teşhis sor
        </button>
        <button className="btn-primary flex-1" onClick={() => navigate("/")}>
          İşlere dön
        </button>
      </div>
    </div>
  );
}

const Spec = ({ k, v }: { k: string; v: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-text-3">{k}</span>
    <span className="text-sm font-semibold">{v}</span>
  </div>
);

const fmtFull = (d: string | null) => {
  if (!d) return "-";
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
};
