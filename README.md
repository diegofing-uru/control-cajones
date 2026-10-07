# Control de Cajones

App mobile para que una empresa de fletes y mudanzas controle las cajas y cajones que deja en cada dirección: quién los dejó, quién los retiró y cuánto queda afuera.

Este repositorio es el **MVP** (historias HU-01 a HU-07). La carga por WhatsApp (HU-10) queda para la fase 2, pero la base ya está preparada: cada usuario tiene teléfono, cada movimiento guarda su origen y la lógica vive en una función del servidor que cualquier canal puede llamar.

## Qué hace

- **Registrar entregas y retiros** en tres toques: tipo, dirección y cantidades con contadores grandes.
- **Mudanzas:** cuando el cliente se muda, los cajones pasan de la dirección donde se entregaron a la nueva en un solo paso, y el retiro se registra en la dirección nueva. Si al entregar ya se sabe a dónde se muda, se anota y ese día viene precargado.
- **Validar el saldo:** no se puede retirar más de lo que hay en la dirección.
- **Pendientes:** direcciones con inventario afuera, ordenadas por antigüedad. Se marcan en rojo cuando pasan los días configurados.
- **Trazabilidad:** cada dirección tiene su línea de tiempo con usuario, fecha y hora. Los movimientos nunca se borran; un administrador puede anularlos con motivo y queda registrado.
- **Panel del administrador:** total de cajas y cajones afuera, direcciones atrasadas y configuración de la alerta.
- **Cuentas:** registro libre con email o celular uruguayo; un administrador aprueba cada cuenta nueva y puede nombrar otros administradores.
- **Sin señal:** los movimientos se guardan en el celular y se envían solos al recuperar conexión, sin duplicarse.
- **Tiempo real:** las listas se actualizan cuando otro empleado registra algo.
- Modo claro y oscuro automático.

## Stack

| Parte | Tecnología |
| --- | --- |
| App | Expo SDK 57 (React Native 0.86), Expo Router, TypeScript |
| Backend | Supabase: Postgres, Auth, Realtime y Edge Functions |
| Seguridad | Row Level Security; el saldo solo cambia mediante funciones del servidor |

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (el plan gratuito alcanza).
2. En **SQL Editor**, ejecutá en orden los archivos de `supabase/migrations/`.
3. En **Authentication > Sign In / Providers**:
   - **Email:** activado, con **Confirm email** desactivado.
   - **Phone:** activado, con **Confirm phone** desactivado. No hace falta configurar un proveedor de SMS: el control de acceso lo hace la aprobación del administrador.
4. Desplegá la función para asignar contraseñas nuevas (necesita la [CLI de Supabase](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy restablecer-contrasena
   ```

### Cuentas y roles

- **Registro libre:** cualquiera puede crear su cuenta desde la app con email o celular uruguayo y contraseña.
- **La primera cuenta del sistema queda como administrador.** Entregale la app al cliente vacía para que se registre primero.
- **Las siguientes quedan como operario pendiente.** No pueden ver ni cargar nada hasta que un administrador las apruebe en **Panel > Usuarios**.
- El administrador puede aprobar, rechazar, desactivar, nombrar otros administradores y asignar contraseñas nuevas. Siempre queda al menos un administrador activo.

### 2. Correr la app

```bash
npm install
cp .env.example .env   # completá URL y anon key (Project Settings > API)
npx expo start
```

Escaneá el QR con **Expo Go** en el celular. Para generar instaladores (APK o App Store) usá [EAS Build](https://docs.expo.dev/build/introduction/).

## Probar sin backend (modo demo)

Con `EXPO_PUBLIC_DEMO=1` la app usa datos de prueba guardados en el dispositivo, con las mismas reglas que la base de datos. Sirve para mostrársela al cliente antes de configurar Supabase:

```bash
EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=demo npx expo start --web
```

Usuarios de prueba: `admin@demo.uy` (administradora) y el celular `098 111 222` (operario), contraseña `demo1234`. Hay una cuenta pendiente de aprobación para probar ese flujo.

### Demo y app publicadas en GitHub Pages

El workflow `.github/workflows/demo.yml` publica dos versiones en cada push a `main`, cada una como una única página (`scripts/build-web.mjs`):

- **Demo** (`npm run demo:build`): sin backend, con datos de prueba. Queda en `https://<usuario>.github.io/control-cajones/`.
- **App real** (`npm run app:build`): conectada a Supabase e instalable en el celular desde el navegador (PWA, sin tiendas), con ícono propio y uso sin señal. Queda en `https://<usuario>.github.io/control-cajones/app/`. Toma la URL y la anon key de las variables del repositorio `SUPABASE_URL` y `SUPABASE_ANON_KEY` (**Settings > Secrets and variables > Actions > Variables**).

Para activarlo, una sola vez: **Settings > Pages > Source: GitHub Actions**. La guía para instalarla en los celulares está en [docs/guia-empleados.md](docs/guia-empleados.md).

## Estructura

```
app/                     Pantallas (Expo Router)
  (tabs)/                Pendientes, Buscar, Historial, Panel
  direccion/[id].tsx     Detalle con saldo, contacto y línea de tiempo
  movimiento/nuevo.tsx   Registrar entrega o retiro
  usuarios.tsx           Aprobación de cuentas, roles y contraseñas
  login.tsx
src/
  components/            Saldo, Stepper, tarjetas, íconos de caja y cajón
  lib/api.ts             Acceso a Supabase
  lib/colaOffline.ts     Cola de movimientos sin señal
  theme.ts               Colores y tipografía
supabase/
  migrations/            Esquema, reglas de saldo, permisos
  functions/             Edge Function para asignar contraseñas
```

## Reglas de negocio en la base de datos

- `registrar_movimiento`: valida usuario activo, cantidades y saldo; crea la dirección si es nueva; ignora duplicados por `client_id`.
- `registrar_mudanza`: pasa cajas y cajones de una dirección a otra (crea el destino si es nuevo). Deja un movimiento en cada dirección (`mudanza_salida` / `mudanza_llegada`, unidos por `mudanza_id`), copia el contacto al destino si no tiene y el aviso de atrasada del destino cuenta desde la mudanza. Cualquier usuario activo puede registrarla.
- `anular_movimiento`: solo administradores; crea un ajuste inverso y deja el original tachado. Anular una mudanza deshace las dos puntas.
- Los usuarios no pueden insertar ni modificar movimientos ni saldos directamente.
- Las direcciones no se duplican por diferencias de mayúsculas o espacios.

## Pruebas automáticas

- `npm test`: pruebas de la app (conteo de días, fechas, cantidades, celulares y emails). Corren solas en GitHub antes de cada publicación: si alguna falla, no se publica.
- `npm run test:base`: pruebas de las reglas de la base (entregas, retiros, mudanzas, anulaciones, días y alertas, usuarios y permisos). Corren contra el proyecto de Supabase vinculado, cada archivo dentro de una transacción que se deshace siempre al final: no guardan nada. Necesitan `supabase login` y `supabase link`. Correrlas antes y después de cada cambio en la base.

Las pruebas de la base están en `supabase/pruebas/` (las ayudas comunes en `_ayudas.sql`). Cuando aparece un error, conviene agregar la prueba que lo habría detectado.

## Próximos pasos (fase 2)

- Foto y nota de evidencia (HU-08) y contacto del cliente en el alta (HU-09).
- Carga por audio de WhatsApp (HU-10) con confirmación antes de guardar.
- Notificaciones push para direcciones atrasadas.
