import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft } from "@/components/icons";
import { toast } from "@/hooks/use-toast";
import ThinkingSteps from "@/components/ThinkingSteps";
import StepCard from "@/components/StepCard";
import ConflictCard from "@/components/ConflictCard";

type Step = { num: number; text: string; ref?: string; expected?: string; source_ref?: string; confidence?: number };
type Source = { tag: string; name: string; page?: string };
type Correction = { scene: string; wrong: string; correct: string; lesson: string };
type Conflict = { manual: string; field: string; winner?: string };
type DiagResult = {
  type: "diagnosis" | "info" | "resolution" | "correction_learned";
  safety: string;
  text: string;
  steps: Step[];
  confidence: number;
  top_cause?: string;
  alternatives?: { name: string; pct: number }[];
  sources?: Source[];
  conflicts?: Conflict[];
  correction?: Correction;
};

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; result?: DiagResult; usta?: { ad: string; bolge: string } };

const QUICK_CHIPS = [
  "Hidrolik basınç düşük, ne yapmalıyım?",
  "H-201 alarm kodu ne anlama gelir?",
  "Yağ filtresi değişim aralığı?",
  "S-valf nasıl temizlenir?",
];

export default function Diagnosis() {
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { question?: string; woContext?: string; woId?: string } };
  const { profile } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "yes" | "no" | undefined>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialAsked = useRef(false);

  const ask = async (question: string, mode?: "correction") => {
    if (!question.trim() || loading) return;
    const region = profile?.region ?? "Marmara";
    setInput("");
    setTurns((t) => [...t, { role: "user", content: question }]);
    setLoading(true);

    try {
      const { data: corrs } = await supabase
        .from("corrections")
        .select("scene, wrong, correct, lesson")
        .eq("bolge", region)
        .order("created_at", { ascending: false })
        .limit(8);

      const history = turns.map((t) =>
        t.role === "user" ? { role: "user", content: t.content } : { role: "assistant", content: t.content }
      );

      const { data, error } = await supabase.functions.invoke("diagnose", {
        body: {
          question,
          region,
          woContext: loc.state?.woContext ?? null,
          corrections: corrs ?? [],
          history,
          mode,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const result: DiagResult = (data as any).result;
      const usta = (data as any).usta;
      setTurns((t) => [...t, { role: "assistant", content: result.text || "", result, usta }]);

      if (result.type === "correction_learned" && result.correction?.wrong) {
        const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
        const sceneText = result.correction.scene || question.slice(0, 200);
        const { data: corrRow } = await supabase.from("corrections").insert({
          scene: sceneText,
          wrong: result.correction.wrong,
          correct: result.correction.correct,
          lesson: result.correction.lesson,
          bolge: region,
          usta: usta?.ad ?? "",
          created_by: userId,
        }).select("id").maybeSingle();

        const { data: mp } = await supabase
          .from("master_profiles").select("id")
          .eq("region", region).eq("is_active", true)
          .order("experience_years", { ascending: false }).limit(1).maybeSingle();

        await supabase.from("correction_rules").insert({
          master_profile_id: mp?.id ?? null,
          region,
          scene_pattern: sceneText,
          wrong: result.correction.wrong,
          correct: result.correction.correct,
          lesson: result.correction.lesson,
          source_correction_id: corrRow?.id ?? null,
          created_by: userId,
        });

        toast({ title: "📝 Kural öğrenildi", description: result.correction.lesson });
      }
    } catch (e: any) {
      toast({ title: "Hata", description: e.message ?? "AI yanıt veremedi", variant: "destructive" });
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  };

  useEffect(() => {
    if (loc.state?.question && !initialAsked.current) {
      initialAsked.current = true;
      ask(loc.state.question);
    }
    // eslint-disable-next-line
  }, []);

  const handleFeedback = async (idx: number, ok: boolean) => {
    setFeedback((f) => ({ ...f, [idx]: ok ? "yes" : "no" }));
    const turn = turns[idx];
    if (turn?.role !== "assistant") return;
    const region = profile?.region ?? "Marmara";

    if (ok) {
      await supabase.from("learning_cases").insert({
        alarm: loc.state?.woContext?.split("·")[1]?.trim() ?? turns[0]?.content?.slice(0, 80) ?? "—",
        diagnosis: turn.result?.top_cause ?? turn.result?.text?.slice(0, 200) ?? "—",
        success: true,
        usta: turn.usta?.ad ?? "",
        bolge: region,
        month: new Date().toISOString().slice(0, 7),
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      toast({ title: "Teşekkürler", description: "Başarılı vaka kaydedildi." });
    } else {
      ask("Bu prosedür işe yaramadı. Nerede hata yaptık, doğrusu ne?", "correction");
    }
  };

  const isEmpty = turns.length === 0 && !loading;

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="grid grid-cols-[80px_1fr_80px] items-center px-5 py-3.5 border-b border-border min-h-[56px] bg-background flex-shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[15px] font-medium text-text-2 -ml-1 py-2">
          <ChevronLeft /> Geri
        </button>
        <div className="text-[17px] font-semibold tracking-tight text-center">Teşhis</div>
        <div />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Hero (empty state) */}
        {isEmpty && (
          <div>
            <div className="px-5 pt-8 pb-2 text-center">
              <div className="text-[20px] font-bold tracking-tight mb-1">Sorunu sor, ToolA çözsün</div>
              <div className="text-[14px] text-text-2 mb-6">Sesli veya yazılı — usta bilgisiyle yanıt</div>
              <button className="mic-huge" onClick={() => document.getElementById("ask-input")?.focus()}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
              <div className="mic-hint">Mikrofona dokun veya alttan yaz</div>
            </div>
            <div className="chips">
              {QUICK_CHIPS.map((q) => (
                <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        <div className="px-4 py-4 space-y-4">
          {turns.map((t, i) => (
            <div key={i}>
              {t.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-[15px]">
                    {t.content}
                  </div>
                </div>
              ) : (
                <AssistantBubble turn={t} idx={i} feedback={feedback[i]} onFeedback={handleFeedback} />
              )}
            </div>
          ))}
          {loading && <ThinkingSteps loading={loading} />}
        </div>
      </div>

      {/* Ask bar */}
      <div className="border-t border-border bg-background p-3 flex gap-2 flex-shrink-0 items-center">
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Sorunu yaz..."
          className="flex-1 bg-bg-2 border border-border rounded-full px-4 py-2.5 text-[15px] outline-none focus:border-primary"
          disabled={loading}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AssistantBubble({
  turn, idx, feedback, onFeedback,
}: {
  turn: Extract<Turn, { role: "assistant" }>;
  idx: number;
  feedback: "yes" | "no" | undefined;
  onFeedback: (idx: number, ok: boolean) => void;
}) {
  const r = turn.result;
  const [showMore, setShowMore] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});

  const totalSteps = r?.steps?.length ?? 0;
  const doneCount = Object.values(doneSteps).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {turn.usta && (
        <div className="text-[11px] text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {turn.usta.ad} · {turn.usta.bolge}
        </div>
      )}

      {/* Safety block (separate, prominent) */}
      {r?.safety && (
        <div className="safety">
          <div className="safety-title">⚠ Güvenlik</div>
          <ul className="safety-list">
            {r.safety.split(/[.\n]+/).filter((s) => s.trim()).map((s, i) => (
              <li key={i}>{s.trim()}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main answer text */}
      {r?.text && (
        <div className="bg-bg-2 border-l-[3px] border-primary rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-relaxed">
          {r.text}
        </div>
      )}

      {/* Steps as checklist cards */}
      {totalSteps > 0 && (
        <div>
          <div className="flex justify-between items-center px-1 pb-2.5 pt-1">
            <div className="text-[15px] font-semibold tracking-tight">Adım adım</div>
            <div className="text-[13px] text-text-3 font-medium">{doneCount} / {totalSteps} tamam</div>
          </div>
          <div className="steps-wrap">
            {r!.steps.map((s) => (
              <StepCard
                key={s.num}
                num={s.num}
                text={s.text}
                ref_={s.ref}
                expected={s.expected}
                done={!!doneSteps[s.num]}
                onToggle={() => setDoneSteps((d) => ({ ...d, [s.num]: !d[s.num] }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conflicts (Kılavuz ≠ Saha) */}
      {r?.conflicts && r.conflicts.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-warn uppercase tracking-wider mb-2 px-1">
            ⚠ Kılavuz ≠ Saha
          </div>
          {r.conflicts.map((c, i) => (
            <ConflictCard key={i} manual={c.manual} field={c.field} winner={c.winner} />
          ))}
        </div>
      )}

      {/* Correction learned */}
      {r?.correction && r.type === "correction_learned" && r.correction.wrong && (
        <div className="bg-warn-bg border border-warn/30 rounded-lg p-3 text-[13px] space-y-1">
          <div className="font-bold text-warn">📝 Correction kaydedildi</div>
          <div><span className="text-text-3">Yanlış:</span> {r.correction.wrong}</div>
          <div><span className="text-text-3">Doğru:</span> {r.correction.correct}</div>
          <div><span className="text-text-3">Ders:</span> {r.correction.lesson}</div>
        </div>
      )}

      {/* Detail toggle: confidence + alternatives */}
      {(r?.top_cause || (r?.alternatives && r.alternatives.length > 0)) && (
        <div>
          <button
            onClick={() => setShowMore((v) => !v)}
            className="w-full px-4 py-3 bg-bg-2 border border-border rounded-xl text-[14px] font-semibold flex items-center justify-between"
          >
            <span className="flex flex-col items-start">
              <span>Detay göster</span>
              <span className="text-[12px] text-text-3 font-medium">Güven skoru, alternatifler</span>
            </span>
            <span className={`text-text-3 transition-transform ${showMore ? "rotate-180" : ""}`}>▼</span>
          </button>
          {showMore && (
            <div className="mt-3 space-y-3 px-1">
              {r?.top_cause && (
                <div>
                  <div className="text-[11px] uppercase font-bold text-text-3 tracking-wider mb-1.5">En olası sebep</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-bold text-primary tracking-tight">%{r.confidence ?? 0}</span>
                    <span className="text-[14px] text-text-2 font-medium">olasılık</span>
                  </div>
                  <div className="text-[15px] font-semibold mt-1">{r.top_cause}</div>
                </div>
              )}
              {r?.alternatives && r.alternatives.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase font-bold text-text-3 tracking-wider mb-1.5">Alternatifler</div>
                  {r.alternatives.map((a, i) => (
                    <div key={i} className="flex justify-between py-2 border-t border-border text-[14px]">
                      <span className="text-text-2">{a.name}</span>
                      <span className="text-text-3 font-semibold">%{a.pct}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sources */}
      {r?.sources && r.sources.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-[11px] font-bold text-text-3 uppercase tracking-wider mb-2.5">Kaynaklar</div>
          {r.sources.map((s, i) => {
            const tone =
              s.tag.toLowerCase().startsWith("p") ? "bg-primary-bg text-primary"
              : s.tag.toLowerCase().startsWith("k") ? "bg-[#e7f0fa] text-[#1e5ea8]"
              : "bg-warn-bg text-warn";
            return (
              <div key={i} className="flex items-center gap-2.5 py-2 border-t border-border first:border-0 text-[14px]">
                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${tone}`}>{s.tag}</span>
                <span className="flex-1">{s.name}</span>
                {s.page && <span className="text-text-3 text-[12px]">{s.page}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Feedback */}
      {r && r.type !== "correction_learned" && (
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-[13px] text-text-2 font-medium">Yardımcı oldu mu?</span>
          <div className="flex gap-2">
            <button
              onClick={() => onFeedback(idx, true)}
              disabled={!!feedback}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${feedback === "yes" ? "bg-primary border-primary text-white" : "bg-bg-2 border-border text-text-2"} disabled:opacity-60`}
            >
              👍
            </button>
            <button
              onClick={() => onFeedback(idx, false)}
              disabled={!!feedback}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${feedback === "no" ? "bg-destructive border-destructive text-white" : "bg-bg-2 border-border text-text-2"} disabled:opacity-60`}
            >
              👎
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
