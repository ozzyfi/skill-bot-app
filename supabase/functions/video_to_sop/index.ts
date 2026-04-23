// Video → SOP (Sprint 6)
// Takes uploaded repair video, asks Gemini Vision to extract step-by-step procedure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOP_TOOL = {
  type: "function",
  function: {
    name: "sop_response",
    description: "Tamir videosundan çıkarılan adım adım prosedür.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Kısa özet (1-2 cümle)" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              num: { type: "number" },
              text: { type: "string", description: "Adımın net açıklaması" },
              time: { type: "string", description: "Videoda görüldüğü zaman damgası (ör. 0:42)" },
            },
            required: ["num", "text"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "steps"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { video_id, wo_context } = await req.json();
    if (!video_id) {
      return new Response(JSON.stringify({ error: "video_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch video record
    const { data: video, error: vErr } = await supabase
      .from("repair_videos").select("*").eq("id", video_id).maybeSingle();
    if (vErr || !video) throw new Error("video not found");

    // Mark processing
    await supabase.from("repair_videos").update({ status: "processing", error_msg: null }).eq("id", video_id);

    // Get signed URL for the video
    const { data: signed, error: sErr } = await supabase.storage
      .from("repair-videos").createSignedUrl(video.storage_path, 600);
    if (sErr || !signed?.signedUrl) throw new Error("signed url failed: " + (sErr?.message ?? ""));

    // Download video and convert to base64 for Gemini multimodal
    const videoResp = await fetch(signed.signedUrl);
    if (!videoResp.ok) throw new Error("video download failed");
    const buf = new Uint8Array(await videoResp.arrayBuffer());
    // Base64 encode
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buf.length; i += chunkSize) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const mimeType = videoResp.headers.get("content-type") ?? "video/mp4";

    const sys = `Sen Putzmeister beton pompası ustası ToolA — bir teknisyenin tamir videosunu izleyip ADIM ADIM prosedüre dönüştürürsün.
Türkçe yaz. Her adım net, kısa, sahada uygulanabilir olsun.
Görsel olarak ne görüldüğünü temel al — uydurma ekleme yapma.
Güvenlik gerektiren adımlarda mutlaka uyarı ekle.
${wo_context ? "İş emri bağlamı: " + wo_context : ""}

SADECE sop_response tool_call ile yanıt ver.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Bu tamir videosunu izle ve adım adım prosedüre dök." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        tools: [SOP_TOOL],
        tool_choice: { type: "function", function: { name: "sop_response" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("video_to_sop AI error", aiResp.status, t);
      await supabase.from("repair_videos")
        .update({ status: "failed", error_msg: `AI ${aiResp.status}` }).eq("id", video_id);
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
    let parsed: any = { summary: "", steps: [] };
    if (call?.function?.arguments) {
      try { parsed = JSON.parse(call.function.arguments); } catch (e) { console.error("parse err", e); }
    }

    await supabase.from("repair_videos").update({
      status: "ready",
      sop_steps: parsed.steps ?? [],
      summary: parsed.summary ?? "",
    }).eq("id", video_id);

    return new Response(JSON.stringify({ ok: true, summary: parsed.summary, steps: parsed.steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("video_to_sop err", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { video_id } = await req.clone().json().catch(() => ({}));
      if (video_id) {
        await supabase.from("repair_videos")
          .update({ status: "failed", error_msg: msg }).eq("id", video_id);
      }
    } catch {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
