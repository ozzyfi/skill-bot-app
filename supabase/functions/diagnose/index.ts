// ToolA — Diagnose edge function
// Calls Lovable AI Gateway with usta-persona system prompt and returns structured JSON.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Usta = {
  ad: string; kidem: number; bolge: string; ekipman: string[];
  oem: { konu: string; oem: string; saha: string; vaka: number; basari: number }[];
  layer0: { durum: string; refleks: string; neden: string }[];
  teshis_sirasi: string;
};

const USTA_PROFILES: Record<string, Usta> = {
  Marmara: {
    ad: "Kemal Yıldız", kidem: 23, bolge: "İstanbul",
    ekipman: ["BSF 36", "BSF 42", "BSA 1409"],
    oem: [
      { konu: "Yağ değişim aralığı", oem: "2000 saat", saha: "1500 saat (yaz)", vaka: 198, basari: 87 },
      { konu: "Pompa contası", oem: "5000 saat", saha: "3500 saat (yaz)", vaka: 112, basari: 91 },
    ],
    layer0: [
      { durum: "H-201 hidrolik basınç düşüklüğü", refleks: "Önce yağ filtresi fark basıncı ölç", neden: "Saha %30 tıkanma çıkıyor" },
      { durum: "Yaz + İstanbul nemi", refleks: "Soğutucu fan + radyatör kontrolü", neden: "Yağ ısınması hızlanıyor" },
    ],
    teshis_sirasi: "Filtre → Basınç → Valf → Pompa",
  },
  "İç Anadolu": {
    ad: "Ahmet Çelik", kidem: 17, bolge: "Ankara",
    ekipman: ["BSF 36", "BSF 42"],
    oem: [
      { konu: "Filtre değişim", oem: "1000 saat", saha: "750 saat (toz)", vaka: 142, basari: 89 },
    ],
    layer0: [
      { durum: "Pompa basıncı düşük", refleks: "Önce filtre, sonra valf", neden: "Ankara tozunda %30 erken tıkanma" },
    ],
    teshis_sirasi: "Filtre → Valf → Pompa → Hortum",
  },
  Ege: {
    ad: "Murat Demir", kidem: 12, bolge: "İzmir",
    ekipman: ["BSF 36", "BSA 1409"],
    oem: [
      { konu: "Basınç valfi ayarı", oem: "350 bar", saha: "340 bar", vaka: 87, basari: 93 },
    ],
    layer0: [
      { durum: "B-310 bom kolu", refleks: "Silindir conta ve pim kontrolü önce", neden: "BSF 42'de %54 silindir contasından" },
    ],
    teshis_sirasi: "Conta → Pim → Silindir → Valf",
  },
};

function buildSystemPrompt(usta: Usta, woContext: string | null, corrections: { wrong: string; correct: string; lesson: string }[]) {
  const month = new Date().getMonth();
  const summer = month >= 5 && month <= 8;
  const oem = usta.oem.map((f) => `- ${f.konu}: OEM=${f.oem} → Saha=${f.saha} (${f.vaka} vaka, %${f.basari} başarı)`).join("\n");
  const layer0 = usta.layer0.map((l) => `  DURUM: ${l.durum}\n  REFLEKS: ${l.refleks}\n  NEDEN: ${l.neden}`).join("\n\n");
  const corBlock = corrections.length > 0
    ? "\nGEÇMİŞ CORRECTION KAYITLARI (bu bağlamda öğrenilmiş):\n" + corrections.map((c) => `- Yanlış: ${c.wrong} → Doğru: ${c.correct} (Ders: ${c.lesson})`).join("\n")
    : "";

  return `Sen ToolA — Putzmeister beton pompası teknisyenlerine yardım eden AI asistan.

USTA: ${usta.ad} (${usta.kidem} yıl · ${usta.bolge})
Ekipman: ${usta.ekipman.join(", ")}${summer && usta.bolge === "İstanbul" ? "\n⚠ YAZ: Soğutucu fan kontrolü kritik." : ""}
${woContext ? "\nİŞ EMRİ: " + woContext : ""}${corBlock}

LAYER 0 — ÇİĞNENEMEZ REFLEKSLER:
${layer0}

OEM vs SAHA:
${oem}
Teşhis sırası: ${usta.teshis_sirasi}

GÜVENLİK (asla atlama):
- Makineyi durdur, LOTO uygula — bom kolu havadayken çalışma
- Hidrolik yağ 80°C üzeri dokunma
- Sistemi basınçsız et

YANIT KURALLARI:
1. Türkçe, sahadan dil
2. Güvenlik uyarısı varsa ilk satırda
3. Adım adım, kısa ve net
4. Kaynak belirt: Kılavuz s.X, ${usta.ad} notu, N vaka
5. Emin değilsen söyle
6. Sorun çözüldüyse iş emri kapatmayı öner

SADECE aşağıdaki tool_call ile yanıt ver: diagnosis_response.`;
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
        safety: { type: "string", description: "Güvenlik uyarısı veya boş string" },
        text: { type: "string", description: "Kısa açıklama / özet" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              num: { type: "number" },
              text: { type: "string" },
              ref: { type: "string" },
              expected: { type: "string" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { question, region, woContext, corrections, history, mode } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const usta = USTA_PROFILES[region as string] ?? USTA_PROFILES.Marmara;
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

    return new Response(JSON.stringify({ result: parsed, usta: { ad: usta.ad, kidem: usta.kidem, bolge: usta.bolge } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("diagnose error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
