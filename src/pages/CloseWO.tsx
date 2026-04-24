import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSyncQueue, enqueue, flushQueue } from "@/hooks/useSyncQueue";
import { ChevronLeft } from "@/components/icons";
import { toast } from "@/hooks/use-toast";
import type { WorkOrder, Machine } from "@/types/db";
import VoiceListenOverlay from "@/components/VoiceListenOverlay";
import SuccessModal from "@/components/SuccessModal";

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
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceFilled, setVoiceFilled] = useState(false);
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

  const setVal = (k: string, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    // user editing clears the AI-filled flag for that field
    setAiFilled((prev) => {
      if (!prev.has(k)) return prev;
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  };

  // ===== Web Speech API — Turkish voice fill (mantık aynı) =====
  const startListening = () => {
    setTranscript("");
    setListening(true);
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // Demo fallback — eski davranış korunur
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

  const cancelListening = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
    setTranscript("");
    setParsing(false);
  };

  // AI-powered autofill — voice_to_workorder edge function (DEĞİŞMEDİ)
  const autofillFromTranscript = async (text: string) => {
    const txt = text.trim();
    if (!txt) return;
    if (!navigator.onLine) {
      const target = activeCat.fields.find((f) => f.type === "textarea") ?? activeCat.fields.find((f) => f.req);
      if (target) {
        setValues((prev) => ({ ...prev, [target.id]: ((prev[target.id] ?? "") + " " + txt).trim() }));
        setAiFilled((prev) => new Set(prev).add(target.id));
      }
      setVoiceFilled(true);
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
      const filledIds = new Set<string>();
      setValues((prev) => {
        const next = { ...prev };
        for (const f of activeCat.fields) {
          const v = parsed[f.id];
          if (typeof v === "string" && v.trim()) {
            next[f.id] = v.trim();
            filledIds.add(f.id);
          }
        }
        return next;
      });
      setAiFilled((prev) => new Set([...prev, ...filledIds]));
      setVoiceFilled(true);
      toast({ title: "✓ AI alanları doldurdu", description: `${filledIds.size} alan yerleştirildi` });
    } catch (e: any) {
      const target = activeCat.fields.find((f) => f.type === "textarea") ?? activeCat.fields.find((f) => f.req);
      if (target) {
        setValues((prev) => ({ ...prev, [target.id]: ((prev[target.id] ?? "") + " " + txt).trim() }));
        setAiFilled((prev) => new Set(prev).add(target.id));
      }
      setVoiceFilled(true);
      toast({ title: "AI parse başarısız", description: e?.message ?? "Ham metin yerleştirildi", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  // Video → SOP upload (DEĞİŞMEDİ)
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
      enqueue({ kind: "close_wo", payload: { woId: wo.id, closing_notes, learning } });
      setSuccess(true);
      toast({ title: "Sıraya alındı", description: "Sunucu hatası — bağlantı geri geldiğinde gönderilecek." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!wo) return <div className="p-8 text-center text-text-3">Yükleniyor...</div>;

  const pendingCount = queue.filter((q) => q.status !== "synced").length;

  return (
    <div className="flex flex-col h-full relative">
      {/* Topbar */}
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate(-1)}>
          <ChevronLeft /> Geri
        </button>
        <div className="topbar-title">İş emrini kapat</div>
        <div className="topbar-action">{wo.code}</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Context row */}
        <div className="context-row">
          <span>Makine <strong>{wo.machines.name}</strong></span>
          <span className="dot self-center" />
          <span>{wo.machines.district}, {wo.machines.city}</span>
          <span className="dot self-center" />
          <span>Teknisyen <strong>{profile?.full_name?.split(" ")[0] ?? "—"}</strong></span>
        </div>

        {pendingCount > 0 && (
          <div className="px-5 py-2 bg-warn-bg text-warn text-[12px] font-medium border-b border-border">
            {pendingCount} bekleyen kayıt — bağlantı geldiğinde gönderilecek.
            <button className="ml-2 underline" onClick={() => flushQueue()}>Şimdi dene</button>
          </div>
        )}

        {/* Category chips */}
        <div className="cat-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCat(c.id); setValues({}); setAiFilled(new Set()); setVoiceFilled(false); setTranscript(""); }}
              className={`cat ${cat === c.id ? "active" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Voice call CTA */}
        <button
          onClick={voiceFilled ? undefined : startListening}
          className={`voice-call ${voiceFilled ? "filled" : ""}`}
          disabled={voiceFilled || listening}
        >
          <div className="voice-mic-sm">
            {voiceFilled ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div className={`text-[15px] font-semibold ${voiceFilled ? "text-text-2" : "text-foreground"}`}>
              {voiceFilled ? "AI doldurdu — istersen düzenle" : "Sesle anlat — formu otomatik dolduralım"}
            </div>
            <div className="text-[13px] text-text-2 mt-0.5">
              {voiceFilled
                ? "Aşağıdaki yeşil alanlar AI tarafından dolduruldu"
                : "Türkçe (tr-TR) — kategori seçtikten sonra konuş"}
            </div>
          </div>
        </button>

        {/* Video → SOP capture */}
        <label className="mx-5 mb-3 w-[calc(100%-40px)] flex items-center gap-3 p-4 border rounded-xl text-left bg-bg-2 border-border cursor-pointer hover:border-primary/40 transition-colors">
          <div className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center flex-shrink-0">
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

        <div className="px-5 text-center text-[13px] text-text-3 mb-3">veya elle doldur</div>

        {/* Form fields */}
        <div>
          {activeCat.fields.map((f) => {
            const filled = aiFilled.has(f.id);
            return (
              <div key={f.id} className={`field-block ${filled ? "filled" : ""}`}>
                <label className="field-label flex justify-between text-[13px] font-semibold text-text-2 mb-2">
                  <span>{f.label} {f.req && <span className="text-destructive">*</span>}</span>
                  {filled && <span className="ai-fill">✓ AI doldurdu</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={values[f.id] ?? ""}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="field-area w-full bg-bg-2 border border-border rounded-[10px] px-3.5 py-3 text-[15px] outline-none focus:border-primary focus:bg-background resize-none"
                  />
                ) : (
                  <input
                    value={values[f.id] ?? ""}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    placeholder={f.placeholder}
                    className="field-input w-full bg-bg-2 border border-border rounded-[10px] px-3.5 py-3 text-[15px] outline-none focus:border-primary focus:bg-background"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mx-5 mb-4 mt-4 p-3 bg-bg-2 border border-dashed border-border rounded-lg text-[12px] text-text-3 leading-relaxed">
          <strong className="text-text-2">SAP / Maximo entegrasyonu</strong> — Onayladığında bu kayıt SAP iş emri kapanışına ve Maximo varlık geçmişine otomatik gönderilecek. (Entegrasyon bağlantısı pasif.)
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border bg-background p-3 flex gap-2 flex-shrink-0">
        <button className="btn-secondary" onClick={() => navigate(-1)}>Taslak</button>
        <button onClick={submit} disabled={!valid || submitting} className="btn-primary flex-1 disabled:opacity-50">
          {submitting ? "Gönderiliyor…" : navigator.onLine ? "✓ İş Emrini Kapat" : "✓ Çevrimdışı kaydet"}
        </button>
      </div>

      {/* Listen overlay */}
      <VoiceListenOverlay
        open={listening || (parsing && !!transcript)}
        transcript={transcript}
        parsing={parsing}
        onStop={stopListening}
        onCancel={cancelListening}
      />

      {/* Success modal */}
      <SuccessModal
        open={success}
        title="İş emri kapatıldı"
        sub={`${wo.machines.name} • Saha öğrenmesine eklendi`}
        idLabel={wo.code}
        ctaLabel="Ana sayfaya dön"
        onCta={() => navigate("/")}
      />
    </div>
  );
}
