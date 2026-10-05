// Edge Function: crea un empleado nuevo. Solo la puede usar un administrador.
// Deploy: supabase functions deploy crear-usuario
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

  // 1. Verificar que quien llama es un administrador activo
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: esAdmin, error: errAdmin } = await comoUsuario.rpc("es_admin");
  if (errAdmin || !esAdmin) {
    return responder({ error: "Solo un administrador puede crear usuarios." }, 403);
  }

  // 2. Validar datos
  const { nombre, email, password, telefono, rol } = await req.json();
  if (!nombre || !email || !password) {
    return responder({ error: "Completá nombre, email y contraseña." }, 400);
  }
  if (String(password).length < 8) {
    return responder({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
  }
  if (rol && !["operario", "administrador"].includes(rol)) {
    return responder({ error: "Rol inválido." }, 400);
  }

  // 3. Crear el usuario con la clave de servicio (el trigger crea su perfil)
  const admin = createClient(url, service);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, telefono: telefono ?? "", rol: rol ?? "operario" },
  });
  if (error) return responder({ error: error.message }, 400);

  return responder({ id: data.user.id });
});
