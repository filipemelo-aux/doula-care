import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serviceName } = await req.json();
    if (!serviceName) {
      return new Response(JSON.stringify({ icon: "🔧" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ icon: "🔧" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You are an emoji selector. Given a service name (usually health/wellness/doula related), respond with ONLY a single emoji that best represents that service. No text, no explanation, just one emoji character.",
          },
          {
            role: "user",
            content: serviceName,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ icon: "🔧" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawIcon = data.choices?.[0]?.message?.content?.trim() || "🔧";
    // Extract only the first emoji character (safety)
    const emojiMatch = rawIcon.match(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u);
    const icon = emojiMatch ? emojiMatch[0] : "🔧";

    return new Response(JSON.stringify({ icon }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-service-icon error:", e);
    return new Response(JSON.stringify({ icon: "🔧" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
