import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft } from "@/components/icons";
import { toast } from "@/hooks/use-toast";

type Step = { num: number; text: string; ref?: string; expected?: string; source_ref?: string; confidence?: number };
type Source = { tag: string; name: string; page?: string };
type Correction = { scene: string; wrong: string; correct: string; lesson: string };
type DiagResult = {
  type: "diagnosis" | "info" | "resolution" | "correction_learned";
  safety: string;
  text: string;
  steps: Step[];
  confidence: number;
  top_cause?: string;
  alternatives?: { name: string; pct: number }[];
  sources?: Source[];
  correction?: Correction;
};

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; result?: DiagResult; usta?: { ad: string; bolge: string } };

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
      // Pull recent corrections for this region as context
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
      setTurns((t) => [
        ...t,
        { role: "assistant", content: result.text || "", result, usta },
      ]);

      // If correction returned, persist it AND create active rule
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

        // Find usta master_profile id by region for FK
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

  // Auto-fire if question passed via state
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
      // Record successful resolution
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
      // Trigger correction loop
      ask("Bu prosedür işe yaramadı. Nerede hata yaptık, doğrusu ne?", "correction");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_80px] items-center px-5 py-3.5 border-b border-border min-h-[56px] bg-background flex-shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[15px] font-medium text-text-2 -ml-1 py-2">
          <ChevronLeft /> Geri
        </button>
        <div className="text-[17px] font-semibold tracking-tight text-center">Teşhis</div>
        <div />
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {turns.length === 0 && !loading && (
          <div className="text-center text-text-3 text-sm py-12">
            <div className="text-4xl mb-3">🛠️</div>
            <div className="font-semibold text-foreground mb-1">Sorunu yaz, ToolA çözsün</div>
            <div>Hidrolik, alarm kodu, prosedür — usta bilgisiyle yanıtlar.</div>
          </div>
        )}

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

        {loading && (
          <div className="flex items-center gap-2 text-text-3 text-sm px-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:150ms]" />
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:300ms]" />
            <span className="ml-2">Usta düşünüyor…</span>
          </div>
        )}
      </div>

      {/* Ask bar */}
      <div className="border-t border-border bg-background p-3 flex gap-2 flex-shrink-0">
        <input
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
          className="btn-primary !py-2.5 !px-5 disabled:opacity-50"
        >
          Sor
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

  return (
    <div className="space-y-2.5">
      {turn.usta && (
        <div className="text-[11px] text-text-3 font-medium uppercase tracking-wider">
          {turn.usta.ad} · {turn.usta.bolge}
        </div>
      )}
      <div className="bg-bg-2 border border-border rounded-2xl rounded-tl-sm p-4 space-y-3">
        {r?.safety && (
          <div className="bg-destructive-bg text-destructive text-[13px] rounded-lg px-3 py-2 font-medium">
            ⚠ {r.safety}
          </div>
        )}

        {r?.text && <div className="text-[15px] leading-relaxed">{r.text}</div>}

        {r?.steps && r.steps.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Adımlar ({r.steps.length})</div>
            {r.steps.map((s) => (
              <div key={s.num} className="flex gap-3 bg-background border border-border rounded-lg p-2.5">
                <div className="w-6 h-6 rounded-full bg-primary-bg text-primary text-[13px] font-bold flex items-center justify-center flex-shrink-0">{s.num}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] leading-snug">{s.text}</div>
                  {s.ref && <div className="text-[11px] text-text-3 mt-0.5">{s.ref}</div>}
                  {s.expected && <div className="text-[11px] text-primary mt-0.5">Beklenen: {s.expected}</div>}
                  {(s.source_ref || typeof s.confidence === "number") && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {s.source_ref && (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-bg text-primary border border-primary/20">
                          📖 {s.source_ref}
                        </span>
                      )}
                      {typeof s.confidence === "number" && (
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            s.confidence >= 80
                              ? "bg-primary-bg text-primary border-primary/20"
                              : s.confidence >= 50
                              ? "bg-warn-bg text-warn border-warn/20"
                              : "bg-destructive-bg text-destructive border-destructive/20"
                          }`}
                        >
                          %{s.confidence}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {r?.correction && r.type === "correction_learned" && r.correction.wrong && (
          <div className="bg-warn-bg border border-warn/30 rounded-lg p-3 text-[13px] space-y-1">
            <div className="font-bold text-warn">📝 Correction kaydedildi</div>
            <div><span className="text-text-3">Yanlış:</span> {r.correction.wrong}</div>
            <div><span className="text-text-3">Doğru:</span> {r.correction.correct}</div>
            <div><span className="text-text-3">Ders:</span> {r.correction.lesson}</div>
          </div>
        )}

        {(r?.top_cause || (r?.alternatives && r.alternatives.length > 0)) && (
          <div>
            <button onClick={() => setShowMore((v) => !v)} className="text-[13px] text-primary font-semibold">
              {showMore ? "▲ Gizle" : "▼ Daha fazla bilgi"}
            </button>
            {showMore && (
              <div className="mt-2 space-y-2 text-[13px]">
                {r?.top_cause && (
                  <div>
                    <div className="text-text-3 text-[11px] uppercase font-bold mb-1">En olası sebep</div>
                    <div className="font-semibold">{r.top_cause} {typeof r.confidence === "number" && <span className="text-primary">· %{r.confidence}</span>}</div>
                  </div>
                )}
                {r?.alternatives?.map((a, i) => (
                  <div key={i} className="flex justify-between bg-background rounded px-2.5 py-1.5">
                    <span>{a.name}</span><span className="text-text-3">%{a.pct}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {r?.sources && r.sources.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <div className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Kaynaklar</div>
            {r.sources.map((s, i) => (
              <div key={i} className="text-[12px] flex gap-2">
                <span className="font-bold text-primary">{s.tag}</span>
                <span>{s.name}</span>
                {s.page && <span className="text-text-3">{s.page}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {r && r.type !== "correction_learned" && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[12px] text-text-3 mr-1">Yardımcı oldu mu?</span>
          <button
            onClick={() => onFeedback(idx, true)}
            disabled={!!feedback}
            className={`text-[13px] px-3 py-1 rounded-full border ${feedback === "yes" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"} disabled:opacity-60`}
          >
            👍 Evet
          </button>
          <button
            onClick={() => onFeedback(idx, false)}
            disabled={!!feedback}
            className={`text-[13px] px-3 py-1 rounded-full border ${feedback === "no" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border bg-background"} disabled:opacity-60`}
          >
            👎 Hayır
          </button>
        </div>
      )}
    </div>
  );
}
