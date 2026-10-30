import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const { data: isAdmin } = await callerClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Not authorized — admin only");

    const { name, email, password, role, sub } = await req.json();
    if (!name || !email || !password || !role) {
      throw new Error("Missing required fields");
    }

    // Create user with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createError) throw createError;

    // Update profile with extra info
    const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#0d3d26", "#3182ce", "#38a169", "#c9a84c", "#e53e3e", "#805ad5"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    await adminClient.from("profiles").update({
      email,
      sub: sub || "",
      initials,
      color,
    }).eq("id", newUser.user!.id);

    // Assign role
    await adminClient.from("user_roles").insert({
      user_id: newUser.user!.id,
      role,
    });

    // Log audit
    const { data: callerProfile } = await adminClient.from("profiles").select("name").eq("id", caller.id).single();
    await adminClient.from("audit_log").insert({
      admin_name: callerProfile?.name || caller.email || "Admin",
      action: "Création compte",
      target_user: name,
      detail: `Nouveau compte ${role === "admin" ? "Administrateur" : role === "superviseur" ? "Superviseur" : "Agent Terrain"} créé`,
    });

    return new Response(JSON.stringify({ success: true, user_id: newUser.user!.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
