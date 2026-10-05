# Control de Cajones

App mobile para que una empresa de fletes y mudanzas controle las cajas y cajones que deja en cada dirección: quién los dejó, quién los retiró y cuánto queda afuera.

Este repositorio es el **MVP** (historias HU-01 a HU-07). La carga por WhatsApp (HU-10) queda para la fase 2, pero la base ya está preparada: cada usuario tiene teléfono, cada movimiento guarda su origen y la lógica vive en una función del servidor que cualquier canal puede llamar.

## Qué hace

- **Registrar entregas y retiros** en tres toques: tipo, dirección y cantidades con contadores grandes.
- **Validar el saldo:** no se puede retirar más de lo que hay en la dirección.
- **Pendientes:** direcciones con inventario afuera, ordenadas por antigüedad. Se marcan en rojo cuando pasan los días configurados.
- **Trazabilidad:** cada dirección tiene su línea de tiempo con usuario, fecha y hora. Los movimientos nunca se borran; un administrador puede anularlos con motivo y queda registrado.
- **Panel del administrador:** total de cajas y cajones afuera, direcciones atrasadas y configuración de la alerta.
- **Usuarios y roles:** operario o administrador; un usuario desactivado no puede registrar nada.
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
2. En **SQL Editor**, pegá y ejecutá el contenido de `supabase/migrations/20261004000000_init.sql`.
3. Desplegá la función para crear empleados (necesita la [CLI de Supabase](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy crear-usuario
   ```

4. Creá el primer administrador: en **Authentication > Users > Add user** creá tu usuario con email y contraseña. Después, en el SQL Editor:

   ```sql
   update perfiles set rol = 'administrador', nombre = 'Tu Nombre'
   where id = (select id from auth.users where email = 'tu@email.com');
   ```

   Los demás empleados se crean desde la app: **Panel > Usuarios > Agregar empleado**.

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

Usuarios de prueba: `admin@demo.uy` (administradora) y `juan@demo.uy` (operario), contraseña `demo1234`.

### Demo publicada en GitHub Pages

El workflow `.github/workflows/demo.yml` genera la demo como una única página (`npm run demo:build`) y la publica en cada push a `main`. Para activarlo, una sola vez: **Settings > Pages > Source: GitHub Actions**. Queda en `https://<usuario>.github.io/control-cajones/` y se puede abrir desde cualquier celular.

## Estructura

```
app/                     Pantallas (Expo Router)
  (tabs)/                Pendientes, Buscar, Historial, Panel
  direccion/[id].tsx     Detalle con saldo, contacto y línea de tiempo
  movimiento/nuevo.tsx   Registrar entrega o retiro
  usuarios.tsx           Gestión de empleados (administradores)
  login.tsx
src/
  components/            Saldo, Stepper, tarjetas, íconos de caja y cajón
  lib/api.ts             Acceso a Supabase
  lib/colaOffline.ts     Cola de movimientos sin señal
  theme.ts               Colores y tipografía
supabase/
  migrations/            Esquema, reglas de saldo, permisos
  functions/             Edge Function para crear usuarios
```

## Reglas de negocio en la base de datos

- `registrar_movimiento`: valida usuario activo, cantidades y saldo; crea la dirección si es nueva; ignora duplicados por `client_id`.
- `anular_movimiento`: solo administradores; crea un ajuste inverso y deja el original tachado.
- Los usuarios no pueden insertar ni modificar movimientos ni saldos directamente.
- Las direcciones no se duplican por diferencias de mayúsculas o espacios.

## Próximos pasos (fase 2)

- Foto y nota de evidencia (HU-08) y contacto del cliente en el alta (HU-09).
- Carga por audio de WhatsApp (HU-10) con confirmación antes de guardar.
- Notificaciones push para direcciones atrasadas.
