// Log Analyzer (Sprint 7)
// PLC/HMI log dosyasını okur, alarm örüntülerini çıkarır,
// aynı makinenin geçmiş log'larıyla karşılaştırır.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "log_analysis_response",
    description: "PLC/HMI log dosyasının yapılandırılmış analizi.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "1-2 cümlelik Türkçe özet." },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["info", "warn", "critical"] },
              code: { type: "string", description: "Alarm/uyarı kodu (ör. H-201). Yoksa boş." },
              message: { type: "string", description: "Türkçe kısa açıklama." },
              count: { type: "number" },
              first_seen: { type: "string", description: "İlk görüldüğü zaman damgası (log'tan)." },
              last_seen: { type: "string" },
            },
            required: ["severity", "message", "count"],
            additionalProperties: false,
          },
        },
        recurring_match: {
          type: "object",
          description: "Geçmişteki bir log ile örüntü eşleşmesi. Yoksa null bırak.",
          properties: {
            matched_log_id: { type: "string" },
            matched_date: { type: "string" },
            similarity_pct: { type: "number" },
            note: { type: "string", description: "Türkçe karşılaştırma notu." },
          },
          required: ["matched_log_id", "similarity_pct", "note"],
          additionalProperties: false,
        },
        recommendations: {
          type: "array",
          items: { type: "string", description: "Türkçe, sahaya yönelik aksiyon önerisi." },
        },
      },
      required: ["summary", "findings", "recommendations"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { log_id } = await req.json();
    if (!log_id) {
      return new Response(JSON.stringify({ error: "log_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Fetch log row
    const { data: logRow, error: logErr } = await supabase
      .from("machine_logs").select("*").eq("id", log_id).maybeSingle();
    if (logErr || !logRow) throw new Error("Log kaydı bulunamadı");

    await supabase.from("machine_logs")
      .update({ status: "processing", error_msg: null }).eq("id", log_id);

    // 2. Download file
    const { data: signed, error: signErr } = await supabase.storage
      .from("machine-logs").createSignedUrl(logRow.storage_path, 300);
    if (signErr || !signed) throw new Error("Dosya URL'i alınamadı");

    const fileResp = await fetch(signed.signedUrl);
    if (!fileResp.ok) throw new Error("Dosya indirilemedi");
    let text = await fileResp.text();

    // Cap ~500KB head + 50KB tail
    const HEAD = 500_000, TAIL = 50_000;
    if (text.length > HEAD + TAIL) {
      text = text.slice(0, HEAD) + "\n...[KIRPILDI]...\n" + text.slice(-TAIL);
    }

    // 3. Historical context: last 5 ready logs for same machine
    const { data: history } = await supabase
      .from("machine_logs")
      .select("id, created_at, summary, findings")
      .eq("machine_id", logRow.machine_id)
      .eq("status", "ready")
      .neq("id", log_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const historyContext = (history ?? []).map((h: any) => ({
      log_id: h.id,
      date: h.created_at,
      summary: h.summary,
      findings: h.findings,
    }));

    // 4. Call Lovable AI
    const systemPrompt = `Sen endüstriyel beton pompası bakım uzmanısın. PLC/HMI log dosyalarını analiz edersin.
Görevin:
1. Alarm ve uyarı örüntülerini çıkar (kod, sıklık, ilk/son görülme).
2. Verilen geçmiş log özetleriyle karşılaştır. Aynı kod/örüntü tekrarlıyorsa recurring_match doldur (matched_log_id, benzerlik %, Türkçe not). Yoksa recurring_match'i null bırak.
3. Sahaya yönelik 3-5 somut öneri ver (Türkçe, kısa, uygulanabilir).
Her şey Türkçe. Tahminde bulunma; veriden çıkar.`;

    const userMessage = `LOG DOSYASI (${logRow.file_name}):
\`\`\`
${text}
\`\`\`

GEÇMİŞ ANALİZLER (aynı makine, son 5):
${historyContext.length ? JSON.stringify(historyContext, null, 2) : "Yok — bu makinenin ilk analizi."}

Şimdi log_analysis_response aracını çağır.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "function", function: { name: "log_analysis_response" } },
      }),
    });

    if (aiResp.status === 429) {
      await supabase.from("machine_logs").update({
        status: "failed", error_msg: "AI hız sınırı aşıldı, lütfen biraz sonra tekrar deneyin.",
      }).eq("id", log_id);
      return new Response(JSON.stringify({ error: "Rate limit" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      await supabase.from("machine_logs").update({
        status: "failed", error_msg: "AI kredisi tükendi. Workspace ayarlarından kredi ekleyin.",
      }).eq("id", log_id);
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI hatası ${aiResp.status}: ${t.slice(0, 200)}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI yapılandırılmış sonuç döndürmedi");

    const parsed = JSON.parse(toolCall.function.arguments);

    // 5. Save results
    const { error: updErr } = await supabase.from("machine_logs").update({
      status: "ready",
      summary: parsed.summary ?? null,
      findings: parsed.findings ?? [],
      recurring_match: parsed.recurring_match ?? null,
      recommendations: parsed.recommendations ?? [],
      error_msg: null,
    }).eq("id", log_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, log_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.error("log_analyzer error:", msg);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.log_id) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );
        await sb.from("machine_logs").update({
          status: "failed", error_msg: msg,
        }).eq("id", body.log_id);
      }
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
