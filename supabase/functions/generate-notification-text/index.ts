import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify super_admin
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { keywords, tone } = await req.json();

    if (!keywords || keywords.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Keywords are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toneMap: Record<string, string> = {
      exciting: "empolgante e convidativo, com emojis",
      formal: "profissional e informativo",
      friendly: "amigável e caloroso, como uma conversa entre amigas",
      mystery: "misterioso e intrigante, criando curiosidade",
    };

    const toneInstruction = toneMap[tone] || toneMap.exciting;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é uma assistente de comunicação para a plataforma Doula Care, voltada para doulas e gestantes. 
Crie notificações push curtas e impactantes. 
Tom: ${toneInstruction}.`,
          },
          {
            role: "user",
            content: `Crie uma notificação push sobre: ${keywords}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_notification",
              description: "Create a push notification with title and message",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Notification title, max 50 characters" },
                  message: { type: "string", description: "Notification body, max 120 characters" },
                },
                required: ["title", "message"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_notification" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    console.log("AI response:", JSON.stringify(aiData));

    // Extract from tool call
    let parsed: { title: string; message: string };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        parsed = { title: "Novidade!", message: "Confira as novidades na plataforma!" };
      }
    } else {
      // Fallback: try content
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { title: "Novidade!", message: content.slice(0, 120) || "Confira as novidades!" };
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
