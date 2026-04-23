import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MachineLog } from "@/types/db";
import { toast } from "@/hooks/use-toast";

interface Props {
  machineId: string;
  region: string;
}

const SEV_STYLE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  warn: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  info: "bg-muted text-text-2 border-border",
};

const SEV_LABEL: Record<string, string> = {
  critical: "Kritik",
  warn: "Uyarı",
  info: "Bilgi",
};

export default function LogAnalyzerPanel({ machineId, region }: Props) {
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("machine_logs")
      .select("*")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data ?? []) as MachineLog[]);
  };

  useEffect(() => { load(); }, [machineId]);

  // Poll while any log is processing/uploaded
  useEffect(() => {
    const pending = logs.some(l => l.status === "uploaded" || l.status === "processing");
    if (!pending) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [logs, machineId]);

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "En fazla 5 MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum yok");

      const ext = file.name.split(".").pop() || "txt";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("machine-logs").upload(path, file, { contentType: file.type || "text/plain" });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase.from("machine_logs").insert({
        machine_id: machineId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        status: "uploaded",
        region: region as any,
        created_by: user.id,
      }).select("*").single();
      if (insErr) throw insErr;

      setActiveId(row.id);
      setOpenId(row.id);
      await load();

      // Fire-and-forget: invoke analyzer
      supabase.functions.invoke("log_analyzer", { body: { log_id: row.id } })
        .then(({ error }) => {
          if (error) {
            toast({ title: "Analiz başlatılamadı", description: error.message, variant: "destructive" });
          }
          load();
        });

      toast({ title: "Log yüklendi", description: "AI inceliyor…" });
    } catch (err: any) {
      toast({ title: "Yükleme hatası", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="section">
      <div className="section-title">Log Analizi</div>
      <div className="section-sub">PLC/HMI log dosyası yükle, AI alarm örüntüsünü çıkarsın</div>

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.csv,.log,.json"
        className="hidden"
        onChange={onFile}
      />

      <button
        className="btn-primary w-full"
        onClick={onPick}
        disabled={uploading}
      >
        {uploading ? "Yükleniyor…" : "📄 Log Dosyası Yükle"}
      </button>

      {logs.length > 0 && (
        <div className="mt-4 space-y-2">
          {logs.map(l => (
            <LogRow
              key={l.id}
              log={l}
              open={openId === l.id}
              onToggle={() => setOpenId(openId === l.id ? null : l.id)}
              isNew={l.id === activeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({ log, open, onToggle, isNew }: {
  log: MachineLog; open: boolean; onToggle: () => void; isNew: boolean;
}) {
  const dt = new Date(log.created_at);
  const dateStr = `${dt.getDate().toString().padStart(2,"0")}.${(dt.getMonth()+1).toString().padStart(2,"0")}.${dt.getFullYear()} ${dt.getHours().toString().padStart(2,"0")}:${dt.getMinutes().toString().padStart(2,"0")}`;

  const statusBadge = () => {
    if (log.status === "ready") {
      const crit = log.findings.filter(f => f.severity === "critical").length;
      if (crit > 0) return <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">{crit} kritik</span>;
      const warn = log.findings.filter(f => f.severity === "warn").length;
      if (warn > 0) return <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 font-semibold">{warn} uyarı</span>;
      return <span className="text-xs px-1.5 py-0.5 rounded bg-primary-bg text-primary font-semibold">Temiz</span>;
    }
    if (log.status === "failed") return <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Başarısız</span>;
    return <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-text-2 animate-pulse">İşleniyor…</span>;
  };

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${isNew ? "ring-1 ring-primary/40" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left active:bg-muted/50"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{log.file_name}</div>
          <div className="text-xs text-text-3">{dateStr}</div>
        </div>
        {statusBadge()}
      </button>

      {open && log.status === "ready" && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
          {log.summary && (
            <div className="text-[13px] text-text-2 leading-snug">{log.summary}</div>
          )}

          {log.recurring_match && (
            <div className="bg-primary-bg border border-primary/20 rounded-md p-2.5">
              <div className="text-xs font-bold text-primary mb-0.5">
                🔁 Tekrar eden örüntü · %{log.recurring_match.similarity_pct} eşleşme
              </div>
              <div className="text-[13px] text-text-2">{log.recurring_match.note}</div>
            </div>
          )}

          {log.findings.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-text-2 uppercase tracking-wide">Bulgular</div>
              {log.findings.map((f, i) => (
                <div key={i} className={`text-[13px] border rounded-md px-2 py-1.5 ${SEV_STYLE[f.severity] ?? SEV_STYLE.info}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold uppercase">{SEV_LABEL[f.severity]}</span>
                    {f.code && <span className="font-mono text-xs font-bold">{f.code}</span>}
                    <span className="ml-auto text-xs opacity-70">×{f.count}</span>
                  </div>
                  <div className="leading-snug">{f.message}</div>
                </div>
              ))}
            </div>
          )}

          {log.recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-text-2 uppercase tracking-wide">Öneriler</div>
              <ul className="text-[13px] text-text-2 space-y-1 list-disc list-inside">
                {log.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {open && log.status === "failed" && (
        <div className="px-3 pb-3 pt-1 border-t border-border">
          <div className="text-[13px] text-destructive">{log.error_msg ?? "Analiz başarısız"}</div>
        </div>
      )}
    </div>
  );
}
