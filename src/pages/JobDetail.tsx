import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { WorkOrder, Machine, WorkOrderPart, RepairVideo } from "@/types/db";
import { ChevronLeft } from "@/components/icons";

type Wo = WorkOrder & { machines: Machine };

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
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_80px] items-center px-5 py-3.5 border-b border-border min-h-[56px] bg-background flex-shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[15px] font-medium text-text-2 -ml-1 py-2">
          <ChevronLeft /> Geri
        </button>
        <div className="text-[17px] font-semibold tracking-tight text-center">İş Emri</div>
        <div />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Top */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="text-[20px] font-bold tracking-tight leading-tight">{wo.machines.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-3 mt-1.5 font-medium">
            <span>{wo.code}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-text-3" />
            {wo.alarm_code && (<><span>{wo.alarm_code}</span><span className="w-[3px] h-[3px] rounded-full bg-text-3" /></>)}
            <span>{wo.machines.district}, {wo.machines.city}</span>
            {wo.badge === "urgent" && (<><span className="w-[3px] h-[3px] rounded-full bg-text-3" /><span className="text-destructive font-semibold">Yüksek öncelik</span></>)}
          </div>
          <div className="text-[14px] text-text-2 mt-3 leading-relaxed">{wo.complaint}</div>
          {wo.description && <div className="text-[13px] text-text-3 mt-2 leading-relaxed">{wo.description}</div>}
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
                className="w-full flex items-center gap-3 py-2.5 text-left"
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-primary border-primary text-white" : "border-border-strong bg-background"}`}>
                  {isChecked && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-medium leading-tight">{p.name}</div>
                  <div className="text-[12px] text-text-3 mt-0.5">{p.code}{p.stock ? ` · ${p.stock}` : ""}</div>
                </div>
                {typeof p.prob === "number" && (
                  <div className={`text-[13px] font-bold ${p.prob >= 50 ? "text-primary" : "text-text-3"}`}>%{p.prob}</div>
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
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
              <div>
                <div className="text-[14px] font-medium">{l.what}</div>
                <div className="text-[12px] text-text-3 mt-0.5">{l.date}</div>
              </div>
              <div className="text-[12px] text-text-3 font-medium">{l.dur}</div>
            </div>
          ))}
        </div>

        {closed && (
          <div className="m-5 p-3 bg-primary-bg text-primary text-[13px] rounded-lg text-center font-semibold">
            ✓ Bu iş emri kapatıldı
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {!closed && (
        <div className="border-t border-border bg-background p-3 flex gap-2 flex-shrink-0">
          <button
            className="btn-primary flex-[1.5]"
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
          <button className="btn-secondary flex-1" onClick={() => navigate(`/close/${wo.id}`)}>
            İşi kapat
          </button>
        </div>
      )}
    </div>
  );
}
