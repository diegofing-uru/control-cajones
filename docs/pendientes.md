# Pendientes

## ✅ Resuelto (2026-10-05): registro con celular fallaba ("No se pudo crear la cuenta")

**Causa:** en Supabase la confirmación por celular estaba activada (`/auth/v1/settings` devolvía
`"phone_autoconfirm": false`). Al registrarse con celular, Supabase intentaba mandar un SMS, no había
proveedor de SMS y el alta fallaba. Con email funcionaba porque esa confirmación sí estaba desactivada.

**Por qué costó:** el panel de Supabase no deja desactivar "Enable phone confirmations" sin un
proveedor de SMS cargado, y la CLI (v2.119) lee `[auth.sms] enable_confirmations` al revés: marcaba el
cambio como aplicado pero el servidor no cambiaba.

**Solución aplicada (parche):** en **Authentication > Sign In / Providers > Phone** se cargaron datos
de Twilio **de relleno** (no son una cuenta real) y se desactivó "Enable phone confirmations".
`supabase/config.toml` quedó sincronizado con el servidor y tiene un comentario explicándolo.

- Nunca se manda un SMS, así que los datos de relleno no se usan.
- Si algún día se quiere mandar SMS de verdad (códigos, recuperar contraseña por SMS), hay que
  reemplazarlos por una cuenta real de Twilio u otro proveedor.
- Verificar: `curl <SUPABASE_URL>/auth/v1/settings -H "apikey: <anon>"` → `"phone_autoconfirm": true`.

**Alternativa más prolija (no aplicada):** que la app registre los celulares como un email interno
(ej. `59899123456@tel.control-mudanzas`) y no use el login por celular de Supabase. Elimina la
dependencia de esta configuración. Si se hace, avisar a quien arma los zips del proyecto.

## Mejora: mensajes de error al registrarse

"No se pudo crear la cuenta. Probá de nuevo." oculta el error real. En `src/lib/auth.tsx`
(función `registrarse`) conviene mostrar algo más útil o registrar `error.message` para diagnosticar
más rápido.
