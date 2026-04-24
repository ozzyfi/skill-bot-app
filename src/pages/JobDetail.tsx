import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrder, Machine, WorkOrderPart, RepairVideo } from "@/types/db";

type Wo = WorkOrder & { machines: Machine };

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
);

const FALLBACK_PARTS: (WorkOrderPart & { stock?: string; prob?: number })[] = [
  { code: "HP-4420", name: "Hidrolik pompa", qty: 1, stock: "3 stokta", prob: 68 },
  { code: "PV-1180", name: "Basınç regülasyon valfi", qty: 1, stock: "7 stokta", prob: 18 },
  { code: "HF-0330", name: "Hidrolik yağ filtresi", qty: 1, stock: "24 stokta", prob: 10 },
];

const FALLBACK_LOG = [
  { date: "10 Mart 2026", what: "Hidrolik yağ filtresi değişimi", dur: "1,5s" },
  { date: "18 Oca 2026", what: "Basınç valfi ayarı", dur: "2s" },
  { date: "4 Kas 2025", what: "Hidrolik pompa revizyonu", dur: "4s" },
];

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [wo, setWo] = useState<Wo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [videos, setVideos] = useState<RepairVideo[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("*, machines(*)")
        .eq("id", id)
        .maybeSingle();
      setWo(data as any);
      if (data) {
        const woRow = data as any;
        const { data: vids } = await supabase
          .from("repair_videos")
          .select("*")
          .or(`wo_id.eq.${woRow.id},machine_id.eq.${woRow.machine_id}`)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(5);
        setVideos((vids ?? []) as any);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-text-3">Yükleniyor...</div>;
  if (!wo) return <div className="p-8 text-center text-text-3">İş emri bulunamadı.</div>;

  const partsList = (wo.parts && wo.parts.length > 0
    ? wo.parts.map((p: any) => ({ ...p, stock: p.stock, prob: p.prob }))
    : FALLBACK_PARTS) as (WorkOrderPart & { stock?: string; prob?: number })[];

  const closed = wo.status === "closed";

  return (
    <div className="flex flex-col h-full">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <ChevronLeftIcon />
        Geri
      </button>

      <div className="flex-1 overflow-y-auto">
        <div className="detail-top">
          <div className="detail-name">{wo.machines.name}</div>
          <div className="detail-info">
            <span>{wo.code}</span>
            {wo.alarm_code && (<><span className="dot" /><span>{wo.alarm_code}</span></>)}
            <span className="dot" />
            <span>{wo.machines.district}, {wo.machines.city}</span>
            {wo.badge === "urgent" && (
              <>
                <span className="dot" />
                <span style={{ color: "hsl(var(--destructive))", fontWeight: 600 }}>Yüksek öncelik</span>
              </>
            )}
          </div>
          <div className="detail-complaint">{wo.complaint || wo.description || "—"}</div>
        </div>

        {/* Parts */}
        <div className="section">
          <div className="section-title">Yanına al</div>
          <div className="section-sub">312 vakaya göre hazırlanmış parça listesi</div>
          {partsList.map((p) => {
            const isChecked = !!checked[p.code];
            return (
              <button
                key={p.code}
                onClick={() => setChecked((c) => ({ ...c, [p.code]: !c[p.code] }))}
                className={`part ${isChecked ? "checked" : ""}`}
              >
                <div className={`part-check ${isChecked ? "on" : ""}`}>
                  {isChecked && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
                <div className="part-body">
                  <div className="part-name">{p.name}</div>
                  <div className="part-meta">{p.code}{p.stock ? ` · ${p.stock}` : ""}</div>
                </div>
                {typeof p.prob === "number" && (
                  <div className={`part-prob ${p.prob < 50 ? "low" : ""}`}>{p.prob}%</div>
                )}
              </button>
            );
          })}
        </div>

        {/* History */}
        <div className="section">
          <div className="section-title">Geçmiş işlemler</div>
          <div className="section-sub">Bu ekipmandaki son kayıtlar</div>
          {FALLBACK_LOG.map((l, i) => (
            <div key={i} className="log">
              <div className="log-date">{l.date}</div>
              <div className="log-what">{l.what}</div>
              <div className="log-dur">{l.dur}</div>
            </div>
          ))}
        </div>

        {/* Video → SOP */}
        {videos.length > 0 && (
          <div className="section">
            <div className="section-title">📹 Video → SOP ({videos.length})</div>
            <div className="section-sub">Bu ekipmandan AI ile çıkarılmış prosedürler</div>
            {videos.map((v) => (
              <div key={v.id} className="py-2.5 border-b border-border last:border-0">
                <div className="text-[13px] font-semibold mb-1">{v.summary || "Tamir prosedürü"}</div>
                <div className="text-[11px] text-text-3 mb-1.5">
                  {new Date(v.created_at).toLocaleDateString("tr-TR")} · {v.sop_steps?.length ?? 0} adım
                </div>
                <ol className="space-y-1 text-[12.5px] text-text-2 list-decimal list-inside">
                  {(v.sop_steps ?? []).slice(0, 5).map((s, i) => (
                    <li key={i}>{s.text}{s.time ? <span className="text-text-3"> · {s.time}</span> : null}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {closed && (
          <div className="m-5 p-3 bg-primary-bg text-primary text-[13px] rounded-lg text-center font-semibold">
            ✓ Bu iş emri kapatıldı
          </div>
        )}
      </div>

      {!closed && (
        <div className="bottom-bar">
          <button
            className="btn btn-primary"
            onClick={() =>
              navigate("/diagnosis", {
                state: {
                  question: `${wo.machines.name} · ${wo.alarm_code ?? "alarm"} — ${wo.complaint}`,
                  woContext: `${wo.code} · ${wo.machines.name}`,
                  woId: wo.id,
                },
              })
            }
          >
            Teşhis başlat
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/close/${wo.id}`)}>
            İşi kapat
          </button>
        </div>
      )}
    </div>
  );
}
