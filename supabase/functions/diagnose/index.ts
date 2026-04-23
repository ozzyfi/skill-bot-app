// ToolA — Diagnose edge function (Sprint 4)
// Reads usta profiles from master_profiles table (work.md + persona.md).
// Falls back to hardcoded profiles if DB is empty.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MasterProfile = {
  id: string;
  name: string;
  region: string;
  domain: string;
  experience_years: number;
  city: string;
  work_md: string;
  persona_md: string;
};

// --- Fallback (DB boşsa) ---
const FALLBACK: Record<string, MasterProfile> = {
  Marmara: {
    id: "fallback-marmara", name: "Kemal Yıldız", region: "Marmara", domain: "hidrolik",
    experience_years: 23, city: "İstanbul",
    work_md: "BSF 36/42, BSA 1409. Hidrolik öncelik. H-201 → önce filtre fark basıncı.",
    persona_md: "Layer 0: H-201'de pompaya el sürme, önce filtre. LOTO şart.",
  },
  "İç Anadolu": {
    id: "fallback-ic", name: "Ahmet Çelik", region: "İç Anadolu", domain: "hidrolik",
    experience_years: 17, city: "Ankara",
    work_md: "BSF 36/42. Toz koşulu. Filtre 750 saatte değişir.",
    persona_md: "Layer 0: Ankara'da hava filtresi atlanmaz.",
  },
  Ege: {
    id: "fallback-ege", name: "Murat Demir", region: "Ege", domain: "mekanik",
    experience_years: 12, city: "İzmir",
    work_md: "BSF 36, BSA 1409. Bom kolu / silindir uzmanı.",
    persona_md: "Layer 0: Bom kolunda LOTO + emniyet pimi şart.",
  },
};

function buildSystemPrompt(
  usta: MasterProfile,
  woContext: string | null,
  corrections: { wrong: string; correct: string; lesson: string }[],
  activeRules: { wrong: string; correct: string; lesson: string }[],
) {
  const month = new Date().getMonth();
  const summer = month >= 5 && month <= 8;
  const corBlock = corrections.length > 0
    ? "\nGEÇMİŞ CORRECTION KAYITLARI (bu bağlamda öğrenilmiş):\n" +
      corrections.map((c) => `- Yanlış: ${c.wrong} → Doğru: ${c.correct} (Ders: ${c.lesson})`).join("\n")
    : "";
  const ruleBlock = activeRules.length > 0
    ? "\n\n═══ ZORUNLU UYULACAK KURALLAR (sahnede öğrenildi, ASLA TEKRARLAMA) ═══\n" +
      activeRules.map((r, i) => `${i + 1}. YANLIŞ: ${r.wrong}\n   DOĞRU: ${r.correct}\n   DERS: ${r.lesson}`).join("\n\n")
    : "";

  return `Sen ToolA — Putzmeister beton pompası teknisyenlerine yardım eden AI asistan.
Bu cevabı **${usta.name}** olarak ver (${usta.experience_years} yıl · ${usta.city} · ${usta.domain}).

═══ USTA İŞ BİLGİSİ (work.md) ═══
${usta.work_md}

═══ USTA KİMLİĞİ (persona.md) ═══
${usta.persona_md}
${summer && usta.city === "İstanbul" ? "\n⚠ YAZ MEVSİMİ: Soğutucu fan / radyatör peteği kontrolü kritik." : ""}
${woContext ? "\nİŞ EMRİ BAĞLAMI: " + woContext : ""}${corBlock}${ruleBlock}

═══ GÜVENLİK (asla atlama) ═══
- Makineyi durdur, LOTO uygula — bom kolu havadayken çalışma
- Hidrolik yağ 80°C üzeri dokunma
- Sistemi basınçsız et

═══ YANIT KURALLARI ═══
1. Türkçe, sahadan dil — ${usta.name}'in ifade stiline sadık kal
2. Güvenlik uyarısı varsa ilk satırda
3. Adım adım, kısa ve net
4. **Her adımda mümkünse** \`source_ref\` (ör. "Hidrolik_Manuel.pdf · sf.42") ve \`confidence\` (0-100) belirt
5. Kaynak belirt: Kılavuz s.X, ${usta.name} notu, N vaka
6. Emin değilsen söyle (düşük confidence)
7. Sorun çözüldüyse iş emri kapatmayı öner
8. **YUKARIDAKİ ÖĞRENİLMİŞ KURALLAR ZORUNLUDUR** — onlara sadık kal

SADECE \`diagnosis_response\` tool_call ile yanıt ver.`;
}

const TOOL = {
  type: "function",
  function: {
    name: "diagnosis_response",
    description: "Yapılandırılmış teşhis yanıtı.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["diagnosis", "info", "resolution", "correction_learned"] },
        safety: { type: "string" },
        text: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              num: { type: "number" },
              text: { type: "string" },
              ref: { type: "string" },
              expected: { type: "string" },
              source_ref: { type: "string", description: "Kaynak (ör. Hidrolik_Manuel.pdf sf.42)" },
              confidence: { type: "number", description: "0-100 bu adıma güven" },
            },
            required: ["num", "text"],
            additionalProperties: false,
          },
        },
        confidence: { type: "number" },
        top_cause: { type: "string" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, pct: { type: "number" } },
            required: ["name", "pct"],
            additionalProperties: false,
          },
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: { tag: { type: "string" }, name: { type: "string" }, page: { type: "string" } },
            required: ["tag", "name"],
            additionalProperties: false,
          },
        },
        correction: {
          type: "object",
          properties: {
            scene: { type: "string" }, wrong: { type: "string" },
            correct: { type: "string" }, lesson: { type: "string" },
          },
          required: ["scene", "wrong", "correct", "lesson"],
          additionalProperties: false,
        },
      },
      required: ["type", "safety", "text", "steps", "confidence"],
      additionalProperties: false,
    },
  },
};

async function pickUsta(region: string, domain: string | null): Promise<MasterProfile> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    let q = supabase
      .from("master_profiles")
      .select("*")
      .eq("region", region)
      .eq("is_active", true);
    if (domain) q = q.eq("domain", domain);
    const { data, error } = await q.limit(1);
    if (error) console.error("master_profiles fetch err", error);
    if (data && data.length > 0) return data[0] as MasterProfile;
    // domain match yoksa region-only dene
    if (domain) {
      const { data: d2 } = await supabase
        .from("master_profiles").select("*")
        .eq("region", region).eq("is_active", true).limit(1);
      if (d2 && d2.length > 0) return d2[0] as MasterProfile;
    }
  } catch (e) {
    console.error("pickUsta err", e);
  }
  return FALLBACK[region] ?? FALLBACK.Marmara;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { question, region, domain, woContext, corrections, history, mode } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const usta = await pickUsta(region as string ?? "Marmara", (domain as string) ?? null);
    const sys = buildSystemPrompt(usta, woContext ?? null, Array.isArray(corrections) ? corrections : []);

    const messages: { role: string; content: string }[] = [{ role: "system", content: sys }];
    if (Array.isArray(history)) {
      for (const m of history) {
        if (m && typeof m.role === "string" && typeof m.content === "string") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    const userPrefix = mode === "correction"
      ? "Bu teşhis veya prosedür yanlış sonuç verdi. Nerede hata oldu, doğrusu ne olmalıydı? type='correction_learned' ve correction alanını doldur. Soru/bağlam: "
      : "";
    messages.push({ role: "user", content: userPrefix + question });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "diagnosis_response" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Çok fazla istek, biraz bekleyin." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI kredisi tükendi. Lovable AI workspace'inize fon ekleyin." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    if (call?.function?.arguments) {
      try { parsed = JSON.parse(call.function.arguments); } catch (e) { console.error("parse err", e); }
    }
    if (!parsed) {
      const txt = data?.choices?.[0]?.message?.content ?? "";
      parsed = { type: "info", safety: "", text: String(txt || "Yanıt alınamadı."), steps: [], confidence: 0 };
    }

    return new Response(
      JSON.stringify({
        result: parsed,
        usta: {
          id: usta.id,
          ad: usta.name,
          kidem: usta.experience_years,
          bolge: usta.city,
          domain: usta.domain,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("diagnose error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
