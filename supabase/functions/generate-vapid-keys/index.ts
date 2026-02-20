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
    // Generate ECDSA P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    // Export public key as raw (uncompressed point, 65 bytes)
    const publicKeyRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", keyPair.publicKey)
    );
    const publicKey = base64UrlEncode(publicKeyRaw);

    // Export private key as PKCS8, then extract the 32-byte d value from JWK
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const privateKey = privateKeyJwk.d!; // Already base64url

    return new Response(
      JSON.stringify({
        publicKey,
        privateKey,
        message:
          "Chaves VAPID geradas com sucesso! Atualize os secrets VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY com esses valores.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
