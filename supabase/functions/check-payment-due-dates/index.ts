// Disabled: automatic client payment-due notifications are no longer sent.
// The doula now triggers payment reminders manually from the "Cobranças" page.
// Keeping the endpoint as a no-op preserves backwards compatibility for any
// lingering invocations (cron, manual calls).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: true,
      disabled: true,
      message:
        "Automatic payment reminders are disabled. Reminders are now sent manually from the Cobranças page.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
