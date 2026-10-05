# Pendientes

## Registro con celular falla ("No se pudo crear la cuenta")

**Detectado:** 2026-10-05, al crear una cuenta con celular desde la app instalada. Con email funciona.

**Causa:** en Supabase la confirmación por celular quedó **activada**. El endpoint público
`/auth/v1/settings` devuelve `"phone_autoconfirm": false` (y `"mailer_autoconfirm": true`).
Al registrarse con celular, Supabase intenta mandar un SMS de confirmación, no hay proveedor
de SMS configurado y el alta falla.

`supabase/config.toml` ya dice `[auth.sms] enable_confirmations = false` y `supabase config diff`
no muestra diferencias, así que la CLI no detecta el problema: hay que forzarlo.

**Cómo arreglarlo (cualquiera de las dos):**
- Panel de Supabase: **Authentication > Sign In / Providers > Phone** → desactivar
  **Enable phone confirmations** y guardar.
- CLI: poner `enable_confirmations = true` en `[auth.sms]`, `supabase config push`, volver a
  `false` y `supabase config push` de nuevo, para que mande el valor explícitamente.

**Verificar:** `/auth/v1/settings` tiene que devolver `"phone_autoconfirm": true`. Después probar
un registro con celular (esa cuenta queda pendiente de aprobación; rechazarla o desactivarla si fue de prueba).

**Mejora en la app:** el mensaje "No se pudo crear la cuenta. Probá de nuevo." oculta el error real.
En `src/lib/auth.tsx` (función `registrarse`) conviene mostrar algo más útil o registrar `error.message`
para diagnosticar más rápido.
