import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * CROSS-ORG ISOLATION TEST
 * 
 * This test verifies that RLS policies enforce strict org isolation.
 * It creates two orgs with separate admin users, each with their own data,
 * then verifies that neither admin can see the other's data.
 */

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test("Cross-org data isolation - admin cannot see other org data", async () => {
  if (!SERVICE_ROLE_KEY) {
    console.log("Skipping: SUPABASE_SERVICE_ROLE_KEY not available");
    return;
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create two test orgs
  const { data: org1 } = await adminClient.from("organizations").insert({
    name: "Test Org A",
    responsible_email: "testa@test.com",
    plan: "free",
    status: "ativo",
  }).select("id").single();

  const { data: org2 } = await adminClient.from("organizations").insert({
    name: "Test Org B", 
    responsible_email: "testb@test.com",
    plan: "free",
    status: "ativo",
  }).select("id").single();

  // Create two admin users
  const { data: user1Data } = await adminClient.auth.admin.createUser({
    email: `test-isolation-a-${Date.now()}@test.com`,
    password: "testpass123",
    email_confirm: true,
  });

  const { data: user2Data } = await adminClient.auth.admin.createUser({
    email: `test-isolation-b-${Date.now()}@test.com`,
    password: "testpass123",
    email_confirm: true,
  });

  const userId1 = user1Data.user!.id;
  const userId2 = user2Data.user!.id;

  try {
    // Set up roles and profiles
    await adminClient.from("user_roles").insert([
      { user_id: userId1, role: "admin" },
      { user_id: userId2, role: "admin" },
    ]);

    await adminClient.from("profiles").update({ organization_id: org1!.id }).eq("user_id", userId1);
    await adminClient.from("profiles").update({ organization_id: org2!.id }).eq("user_id", userId2);

    // Create clients in each org
    const { data: clientA } = await adminClient.from("clients").insert({
      full_name: "Client Org A",
      phone: "11999990001",
      organization_id: org1!.id,
      owner_id: userId1,
    }).select("id").single();

    const { data: clientB } = await adminClient.from("clients").insert({
      full_name: "Client Org B",
      phone: "11999990002",
      organization_id: org2!.id,
      owner_id: userId2,
    }).select("id").single();

    // Sign in as user1 (Org A admin) using anon key
    const user1Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: signIn1Error } = await user1Client.auth.signInWithPassword({
      email: user1Data.user!.email!,
      password: "testpass123",
    });
    assertEquals(signIn1Error, null, "User1 should sign in successfully");

    // Query clients as user1 - should ONLY see Org A clients
    const { data: user1Clients } = await user1Client.from("clients").select("id, full_name, organization_id");
    
    const user1SeesOrgA = user1Clients?.some(c => c.id === clientA!.id);
    const user1SeesOrgB = user1Clients?.some(c => c.id === clientB!.id);

    assertEquals(user1SeesOrgA, true, "User1 (Org A admin) should see Org A client");
    assertEquals(user1SeesOrgB, false, "User1 (Org A admin) must NOT see Org B client");

    // Query transactions as user1
    await adminClient.from("transactions").insert({
      description: "Org B Revenue",
      amount: 500,
      type: "receita",
      organization_id: org2!.id,
      owner_id: userId2,
    });

    const { data: user1Transactions } = await user1Client.from("transactions").select("*");
    const seesOrgBTransaction = user1Transactions?.some(t => t.organization_id === org2!.id);
    assertEquals(seesOrgBTransaction, false, "User1 must NOT see Org B transactions");

    // Sign in as user2 (Org B admin) - verify they can't see Org A
    const user2Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await user2Client.auth.signInWithPassword({
      email: user2Data.user!.email!,
      password: "testpass123",
    });

    const { data: user2Clients } = await user2Client.from("clients").select("id, full_name, organization_id");
    const user2SeesOrgA = user2Clients?.some(c => c.id === clientA!.id);
    const user2SeesOrgB = user2Clients?.some(c => c.id === clientB!.id);

    assertEquals(user2SeesOrgA, false, "User2 (Org B admin) must NOT see Org A client");
    assertEquals(user2SeesOrgB, true, "User2 (Org B admin) should see Org B client");

    // Test admin_settings isolation
    await adminClient.from("admin_settings").insert([
      { owner_id: userId1, organization_id: org1!.id, pix_key: "pix-org-a" },
      { owner_id: userId2, organization_id: org2!.id, pix_key: "pix-org-b" },
    ]);

    const { data: user1Settings } = await user1Client.from("admin_settings").select("*");
    const seesOrgBSettings = user1Settings?.some(s => s.organization_id === org2!.id);
    assertEquals(seesOrgBSettings, false, "User1 must NOT see Org B admin settings");

    console.log("✅ All cross-org isolation tests passed!");

    // Cleanup
    await user1Client.auth.signOut();
    await user2Client.auth.signOut();
  } finally {
    // Cleanup all test data
    await adminClient.from("transactions").delete().in("organization_id", [org1!.id, org2!.id]);
    await adminClient.from("admin_settings").delete().in("organization_id", [org1!.id, org2!.id]);
    await adminClient.from("clients").delete().in("organization_id", [org1!.id, org2!.id]);
    await adminClient.from("user_roles").delete().in("user_id", [userId1, userId2]);
    await adminClient.from("profiles").delete().in("user_id", [userId1, userId2]);
    await adminClient.auth.admin.deleteUser(userId1);
    await adminClient.auth.admin.deleteUser(userId2);
    await adminClient.from("organizations").delete().in("id", [org1!.id, org2!.id]);
  }
});
