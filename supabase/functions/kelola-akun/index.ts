// Edge Function "kelola-akun": membuat akun anggota, mengatur ulang password, dan menghapus akun.
// Hanya admin (members.role = 'admin') yang boleh memanggil, kecuali aksi "bootstrap"
// yang hanya berlaku sekali saat belum ada satu pun akun login.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Kunci server: legacy service_role, atau secret key format baru bila legacy dinonaktifkan.
function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      const first = Array.isArray(keys) ? keys[0] : Object.values(keys)[0];
      if (typeof first === "string") return first;
    } catch { /* ignore */ }
  }
  return Deno.env.get("SUPABASE_SECRET_KEY") || "";
}

const ROLES = ["admin", "editor", "viewer"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(body.action || "");
  const email = String(body.email || "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  const findUser = async (mail: string) => {
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => (u.email || "").toLowerCase() === mail);
      if (hit) return hit;
      if (data.users.length < 200) return null;
    }
    return null;
  };

  // ---- Bootstrap: admin pertama membuat password sendiri ----
  if (action === "bootstrap") {
    const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) return json({ error: "server_error" }, 500);
    if (list.users.length > 0) return json({ error: "already_initialized" }, 403);
    if (!EMAIL_RE.test(email) || password.length < 8) return json({ error: "invalid_input" }, 400);
    const { data: m } = await admin.from("members").select("role").eq("email", email).maybeSingle();
    if (!m || m.role !== "admin") return json({ error: "not_admin_member" }, 403);
    const { error: e2 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (e2) return json({ error: "create_failed", detail: e2.message }, 400);
    return json({ ok: true });
  }

  // ---- Aksi lain: wajib admin ----
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who.user?.email) return json({ error: "unauthorized" }, 401);
  const me = who.user.email.toLowerCase();
  const { data: myRow } = await admin.from("members").select("role").eq("email", me).maybeSingle();
  if (!myRow || myRow.role !== "admin") return json({ error: "forbidden" }, 403);

  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);

  try {
    if (action === "create") {
      const role = String(body.role || "");
      const nama = String(body.nama || "").trim().slice(0, 120);
      if (!ROLES.includes(role)) return json({ error: "invalid_role" }, 400);
      if (password.length < 8) return json({ error: "weak_password" }, 400);
      const existing = await findUser(email);
      if (existing) {
        const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
        if (error) throw error;
      } else {
        const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
      }
      const { error: upErr } = await admin.from("members").upsert({ email, nama, role, created_by: me });
      if (upErr) throw upErr;
      return json({ ok: true, existed: Boolean(existing) });
    }

    if (action === "set-password") {
      if (password.length < 8) return json({ error: "weak_password" }, 400);
      const u = await findUser(email);
      if (!u) return json({ error: "user_not_found" }, 404);
      const { error } = await admin.auth.admin.updateUserById(u.id, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      if (email === me) return json({ error: "cannot_delete_self" }, 400);
      const { error: delErr } = await admin.from("members").delete().eq("email", email);
      if (delErr) throw delErr;
      const u = await findUser(email);
      if (u) {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: "server_error", detail: String((e as Error)?.message || e) }, 500);
  }

  return json({ error: "unknown_action" }, 400);
});
