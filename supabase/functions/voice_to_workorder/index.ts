// Voice → Work Order parser (Sprint 5)
// Takes a Turkish transcript + category, returns structured field values.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMAS: Record<string, { name: string; desc: string; fields: { id: string; desc: string }[] }> = {
  ariza: {
    name: "ariza_form",
    desc: "Arıza iş emri formu",
    fields: [
      { id: "ariza", desc: "Arızanın kısa tanımı" },
      { id: "neden", desc: "Arızanın temel sebebi" },
      { id: "yapilan", desc: "Yapılan işlem ve varsa parça numarası" },
      { id: "sure", desc: "Süre dakika cinsinden, sadece sayı (ör: 45)" },
    ],
  },
  bakim: {
    name: "bakim_form",
    desc: "Bakım formu",
    fields: [
      { id: "yapilanBakim", desc: "Yapılan bakım işlemleri" },
      { id: "periyod", desc: "Bakım periyodu (ör: 2000 saat, 3 aylık)" },
      { id: "notlar", desc: "Ek notlar veya gözlemler" },
    ],
  },
  parca: {
    name: "parca_form",
    desc: "Parça değişim formu",
    fields: [
      { id: "parca", desc: "Değiştirilen parçanın adı" },
      { id: "nedenDeg", desc: "Değiştirilme sebebi" },
      { id: "parcaNo", desc: "Parça numarası veya tedarikçi" },
    ],
  },
  diger: {
    name: "diger_form",
    desc: "Diğer işlem formu",
    fields: [
      { id: "islem", desc: "Yapılan işlem" },
      { id: "aciklama", desc: "Detaylı açıklama" },
      { id: "notlar2", desc: "Ek notlar" },
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { transcript, category } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cat = SCHEMAS[category as string] ?? SCHEMAS.ariza;

    const properties: Record<string, any> = {};
    for (const f of cat.fields) {
      properties[f.id] = { type: "string", description: f.desc };
    }

    const tool = {
      type: "function",
      function: {
        name: cat.name,
        description: cat.desc,
        parameters: {
          type: "object",
          properties,
          required: cat.fields.map((f) => f.id),
          additionalProperties: false,
        },
      },
    };

    const sys = `Sen Putzmeister beton pompası teknisyeninin sesli notunu OEM uyumlu iş emri formuna dönüştüren bir asistansın.
Türkçe konuşulan transkripti oku, alanları DOLDUR.
Eğer bir alan transkriptte yoksa, en mantıklı kısa değeri (veya boş string) yaz — uydurma ekleme yapma.
Süre alanı sadece sayı olmalı (dakika).`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Kategori: ${category}\n\nTranskript:\n"""${transcript}"""` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: cat.name } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("voice_to_workorder AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Çok fazla istek." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI kredisi tükendi." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let values: Record<string, string> = {};
    if (call?.function?.arguments) {
      try { values = JSON.parse(call.function.arguments); } catch (e) { console.error("parse err", e); }
    }

    return new Response(JSON.stringify({ values }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice_to_workorder err", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
