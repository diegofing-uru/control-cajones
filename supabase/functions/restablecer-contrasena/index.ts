// Edge Function: un administrador asigna una contraseña nueva a un empleado
// (útil para quien ingresa con celular y no puede recuperarla por email).
// Deploy: supabase functions deploy restablecer-contrasena
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: esAdmin, error: errAdmin } = await comoUsuario.rpc("es_admin");
  if (errAdmin || !esAdmin) {
    return responder({ error: "Solo un administrador puede cambiar contraseñas." }, 403);
  }

  const { usuario_id, password } = await req.json();
  if (!usuario_id || !password) return responder({ error: "Faltan datos." }, 400);
  if (String(password).length < 8) {
    return responder({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
  }

  const admin = createClient(url, service);
  const { error } = await admin.auth.admin.updateUserById(usuario_id, { password });
  if (error) return responder({ error: error.message }, 400);
  return responder({ ok: true });
});
