import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSyncQueue, enqueue, flushQueue } from "@/hooks/useSyncQueue";
import { ChevronLeft } from "@/components/icons";
import { toast } from "@/hooks/use-toast";
import type { WorkOrder, Machine } from "@/types/db";

type Cat = "ariza" | "bakim" | "parca" | "diger";
type Field = { id: string; label: string; req: boolean; type: "input" | "textarea"; placeholder: string };

const CATEGORIES: { id: Cat; label: string; fields: Field[]; voiceSample: string }[] = [
  {
    id: "ariza", label: "Arıza",
    voiceSample: "Hidrolik pompa basıncı düşüktü. Filtre tıkanmış, yağ filtresini değiştirdim. 45 dakika sürdü.",
    fields: [
      { id: "ariza", label: "Arıza", req: true, type: "input", placeholder: "Arıza ne idi?" },
      { id: "neden", label: "Nedeni", req: true, type: "input", placeholder: "Arızanın sebebi ne idi?" },
      { id: "yapilan", label: "Yapılan işlem", req: true, type: "textarea", placeholder: "Hangi işlem yapıldı? Varsa parça no belirtin." },
      { id: "sure", label: "Süre (dk)", req: false, type: "input", placeholder: "0" },
    ],
  },
  {
    id: "bakim", label: "Bakım",
    voiceSample: "Rutin 2000 saatlik bakım yaptım. Yağ filtresini değiştirdim, hidrolik yağı kontrol ettim, kayış gerginliğine baktım.",
    fields: [
      { id: "yapilanBakim", label: "Yapılan Bakım", req: true, type: "textarea", placeholder: "Hangi bakım işlemleri yapıldı?" },
      { id: "periyod", label: "Bakım Periyodu", req: true, type: "input", placeholder: "ör: 3 aylık, 2000 saat" },
      { id: "notlar", label: "Notlar", req: false, type: "textarea", placeholder: "Ek notlar veya gözlemler" },
    ],
  },
  {
    id: "parca", label: "Parça Değişimi",
    voiceSample: "Yağ filtresini değiştirdim. Tıkanmıştı. Parça numarası HF-0330, Putzmeister orijinal.",
    fields: [
      { id: "parca", label: "Değiştirilen Parça", req: true, type: "input", placeholder: "Hangi parça değiştirildi?" },
      { id: "nedenDeg", label: "Neden Değiştirildi", req: true, type: "input", placeholder: "Parçanın değiştirilme sebebi nedir?" },
      { id: "parcaNo", label: "Parça No / Tedarikçi", req: true, type: "input", placeholder: "Parça numarası veya tedarikçi" },
    ],
  },
  {
    id: "diger", label: "Diğer",
    voiceSample: "Yerinde inceleme yaptım. Müşterinin şikayet ettiği ses normaldi.",
    fields: [
      { id: "islem", label: "İşlem", req: true, type: "input", placeholder: "Yapılan işlem nedir?" },
      { id: "aciklama", label: "Açıklama", req: true, type: "textarea", placeholder: "İşlemin detaylı açıklaması" },
      { id: "notlar2", label: "Notlar", req: false, type: "textarea", placeholder: "Ek notlar" },
    ],
  },
];

type Wo = WorkOrder & { machines: Machine };

export default function CloseWO() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { queue } = useSyncQueue();
  const [wo, setWo] = useState<Wo | null>(null);
  const [cat, setCat] = useState<Cat>("ariza");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("work_orders").select("*, machines(*)").eq("id", id).maybeSingle();
      setWo(data as any);
    })();
  }, [id]);

  const activeCat = useMemo(() => CATEGORIES.find((c) => c.id === cat)!, [cat]);

  const setVal = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  // Web Speech API — Turkish voice fill
  const startListening = () => {
    setTranscript("");
    setListening(true);
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // Demo fallback
      setTimeout(() => {
        const sample = activeCat.voiceSample;
        setTranscript(sample);
        setListening(false);
        autofillFromTranscript(sample);
        toast({ title: "Demo mod", description: "Tarayıcı mikrofonu desteklemiyor — örnek metin kullanıldı." });
      }, 800);
      return;
    }
    const r = new SR();
    r.lang = "tr-TR";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((res: any) => res[0].transcript).join("");
      setTranscript(t);
    };
    r.onerror = () => {
      setListening(false);
      const sample = activeCat.voiceSample;
      setTranscript(sample);
      autofillFromTranscript(sample);
      toast({ title: "Demo mod", description: "Mikrofon erişimi yok — örnek metin kullanıldı." });
    };
    r.onend = () => {
      setListening(false);
      setTimeout(() => {
        setTranscript((cur) => {
          if (cur.trim()) autofillFromTranscript(cur);
          return cur;
        });
      }, 50);
    };
    r.start();
    recRef.current = r;
  };

  const stopListening = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };

  // AI-powered autofill: send transcript to voice_to_workorder edge function
  const autofillFromTranscript = async (text: string) => {
    const txt = text.trim();
    if (!txt) return;
    if (!navigator.onLine) {
      // Offline fallback: dump into first textarea
      const target = activeCat.fields.find((f) => f.type === "textarea") ?? activeCat.fields.find((f) => f.req);
      if (target) setValues((prev) => ({ ...prev, [target.id]: ((prev[target.id] ?? "") + " " + txt).trim() }));
      toast({ title: "Çevrimdışı", description: "Ham metin yerleştirildi, AI parse atlandı." });
      return;
    }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice_to_workorder", {
        body: { transcript: txt, category: cat },
      });
      if (error) throw error;
      const errMsg = (data as any)?.error;
      if (errMsg) throw new Error(errMsg);
      const parsed = (data as any)?.values ?? {};
      setValues((prev) => {
        const next = { ...prev };
        for (const f of activeCat.fields) {
          const v = parsed[f.id];
          if (typeof v === "string" && v.trim()) next[f.id] = v.trim();
        }
        return next;
      });
      toast({ title: "✓ AI alanları doldurdu", description: `${Object.keys(parsed).length} alan yerleştirildi` });
    } catch (e: any) {
      // Heuristic fallback
      const target = activeCat.fields.find((f) => f.type === "textarea") ?? activeCat.fields.find((f) => f.req);
      if (target) setValues((prev) => ({ ...prev, [target.id]: ((prev[target.id] ?? "") + " " + txt).trim() }));
      toast({ title: "AI parse başarısız", description: e?.message ?? "Ham metin yerleştirildi", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  // Video → SOP upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !wo) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "En fazla 50MB.", variant: "destructive" });
      return;
    }
    setVideoUploading(true);
    setVideoStatus("Yükleniyor…");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Giriş gerekli");
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${user.id}/${wo.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("repair-videos").upload(path, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: vRow, error: insErr } = await supabase.from("repair_videos").insert({
        wo_id: wo.id,
        machine_id: wo.machine_id,
        storage_path: path,
        status: "uploaded",
        region: profile?.region ?? null,
        created_by: user.id,
      }).select("id").maybeSingle();
      if (insErr) throw insErr;

      setVideoStatus("AI işliyor…");
      const { error: fnErr } = await supabase.functions.invoke("video_to_sop", {
        body: {
          video_id: vRow?.id,
          wo_context: `${wo.code} · ${wo.machines?.name ?? ""} · ${wo.alarm_code ?? ""}`,
        },
      });
      if (fnErr) throw fnErr;
      setVideoStatus("✓ SOP hazır");
      toast({ title: "✓ Video → SOP hazır", description: "Adımlar iş emrine eklendi" });
    } catch (err: any) {
      setVideoStatus("");
      toast({ title: "Video hata", description: err?.message ?? "Yükleme başarısız", variant: "destructive" });
    } finally {
      setVideoUploading(false);
    }
  };

  const valid = activeCat.fields.every((f) => !f.req || (values[f.id] ?? "").trim().length > 0);

  const submit = async () => {
    if (!wo || !valid) return;
    setSubmitting(true);
    const closing_notes = JSON.stringify({ category: cat, ...values });
    const learning = {
      alarm: wo.alarm_code ?? values.ariza ?? values.islem ?? "—",
      diagnosis: values.neden ?? values.yapilanBakim ?? values.nedenDeg ?? values.aciklama ?? "—",
      success: true,
      usta: profile?.full_name ?? "—",
      bolge: profile?.region ?? "Marmara",
      month: new Date().toISOString().slice(0, 7),
    };

    if (!navigator.onLine) {
      enqueue({ kind: "close_wo", payload: { woId: wo.id, closing_notes, learning } });
      setSuccess(true);
      setSubmitting(false);
      toast({ title: "Çevrimdışı kayıt", description: "Bağlantı geri geldiğinde otomatik gönderilecek." });
      return;
    }

    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: "closed", badge: "scheduled", closed_at: new Date().toISOString(), closing_notes })
        .eq("id", wo.id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("learning_cases").insert({ ...learning, created_by: user?.id ?? null });
      setSuccess(true);
    } catch (e: any) {
      // Fall back to queue
      enqueue({ kind: "close_wo", payload: { woId: wo.id, closing_notes, learning } });
      setSuccess(true);
      toast({ title: "Sıraya alındı", description: "Sunucu hatası — bağlantı geri geldiğinde gönderilecek." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!wo) return <div className="p-8 text-center text-text-3">Yükleniyor...</div>;

  if (success) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 rounded-full bg-primary-bg text-primary flex items-center justify-center text-3xl mb-4">✓</div>
        <div className="text-[20px] font-bold mb-1">İş emri kapatıldı</div>
        <div className="text-[14px] text-text-2 mb-6">{wo.code} · {wo.machines.name}</div>
        <button className="btn-primary w-full max-w-[260px]" onClick={() => navigate("/")}>Ana sayfaya dön</button>
      </div>
    );
  }

  const pendingCount = queue.filter((q) => q.status !== "synced").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_80px] items-center px-5 py-3.5 border-b border-border min-h-[56px] bg-background flex-shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[15px] font-medium text-text-2 -ml-1 py-2">
          <ChevronLeft /> Geri
        </button>
        <div className="text-[17px] font-semibold tracking-tight text-center">İş emrini kapat</div>
        <div />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Context */}
        <div className="px-5 py-3 bg-bg-2 text-[12px] text-text-2 flex flex-wrap gap-x-2 gap-y-1 border-b border-border">
          <span>İş <strong className="text-foreground">{wo.code}</strong></span>
          <span className="self-center w-[3px] h-[3px] rounded-full bg-text-3" />
          <span>Makine <strong className="text-foreground">{wo.machines.name}</strong></span>
          <span className="self-center w-[3px] h-[3px] rounded-full bg-text-3" />
          <span>Teknisyen <strong className="text-foreground">{profile?.full_name?.split(" ")[0] ?? "—"}</strong></span>
        </div>

        {pendingCount > 0 && (
          <div className="px-5 py-2 bg-warn-bg text-warn text-[12px] font-medium border-b border-border">
            {pendingCount} bekleyen kayıt — bağlantı geldiğinde gönderilecek.
            <button className="ml-2 underline" onClick={() => flushQueue()}>Şimdi dene</button>
          </div>
        )}

        {/* Category chips */}
        <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCat(c.id); setValues({}); }}
              className={`region-chip ${cat === c.id ? "active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Voice call */}
        <button
          onClick={listening ? stopListening : startListening}
          className={`mx-5 mb-3 w-[calc(100%-40px)] flex items-center gap-3 p-4 border rounded-xl text-left ${listening ? "bg-destructive-bg border-destructive" : "bg-primary-bg border-primary/20"}`}
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center ${listening ? "bg-destructive text-white animate-pulse" : "bg-primary text-white"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </div>
          <div className="flex-1">
            <div className={`text-[15px] font-semibold ${listening ? "text-destructive" : "text-primary"}`}>
              {listening ? "Dinleniyor… (durdurmak için dokun)" : "Mikrofona anlat"}
            </div>
            <div className="text-[12px] text-text-2 mt-0.5">
              {listening ? (transcript || "Konuşmaya başla…") : "Türkçe (tr-TR) — alanları senin yerine doldurayım"}
            </div>
          </div>
        </button>

        {transcript && !listening && (
          <div className="mx-5 mb-3 p-3 bg-bg-2 border border-border rounded-lg text-[13px] text-text-2 italic">
            "{transcript}"
            {parsing && <div className="not-italic mt-1.5 text-primary text-[12px] font-semibold">⚙ Anlatılanı alanlara yerleştiriyorum…</div>}
          </div>
        )}

        {/* Video → SOP capture */}
        <label className="mx-5 mb-3 w-[calc(100%-40px)] flex items-center gap-3 p-4 border rounded-xl text-left bg-bg-2 border-border cursor-pointer hover:border-primary/40 transition-colors">
          <div className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <path d="M22 8l-6 4 6 4V8z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">
              {videoUploading ? videoStatus || "İşleniyor…" : "Tamir videosu çek"}
            </div>
            <div className="text-[12px] text-text-2 mt-0.5">
              {videoUploading
                ? "AI adım adım prosedüre çeviriyor — biraz bekle."
                : "30-90 sn tamir videosu — AI sahaya SOP üretir (max 50MB)"}
            </div>
          </div>
          <input
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleVideoUpload}
            disabled={videoUploading}
            className="hidden"
          />
        </label>

        <div className="px-5 text-center text-[12px] text-text-3 mb-2">veya elle doldur</div>

        {/* Form */}
        <div className="px-5 pb-4 space-y-3">
          {activeCat.fields.map((f) => (
            <div key={f.id}>
              <label className="block text-[12px] font-semibold text-text-2 mb-1.5">
                {f.label} {f.req && <span className="text-destructive">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={values[f.id] ?? ""}
                  onChange={(e) => setVal(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-primary focus:bg-background resize-none"
                />
              ) : (
                <input
                  value={values[f.id] ?? ""}
                  onChange={(e) => setVal(f.id, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-primary focus:bg-background"
                />
              )}
            </div>
          ))}
        </div>

        {/* SAP/Maximo placeholder */}
        <div className="mx-5 mb-4 p-3 bg-bg-2 border border-dashed border-border rounded-lg text-[12px] text-text-3 leading-relaxed">
          <strong className="text-text-2">SAP / Maximo entegrasyonu</strong> — Onayladığında bu kayıt SAP iş emri kapanışına ve Maximo varlık geçmişine otomatik gönderilecek. (Entegrasyon bağlantısı pasif.)
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-border bg-background p-3 flex-shrink-0">
        <button onClick={submit} disabled={!valid || submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? "Gönderiliyor…" : navigator.onLine ? "✓ Onayla ve gönder" : "✓ Çevrimdışı kaydet"}
        </button>
      </div>
    </div>
  );
}
