# IVAO Companion

**Mobile companion app for IVAO pilots and controllers.**
Seguimiento de tráfico en vivo, mapa interactivo y gestión de amigos — todo desde el navegador, sin instalar nada.

---

## ¿Qué hace?

| Pestaña | Función |
|---|---|
| **Mi vuelo** | Datos en tiempo real de tu vuelo activo: altitud, velocidad, rumbo, brújula, FPL y ATC cercano |
| **Tráfico** | Mapa interactivo con todos los pilotos y controladores conectados a IVAO |
| **Amigos** | Lista de amigos por VID con estado online en tiempo real |

---

## Cómo usar

1. Abre el archivo `ivao-companion-v3.jsx` en el entorno Claude.ai
2. Inicia sesión con tu cuenta IVAO (OAuth2 PKCE — seguro, sin contraseñas almacenadas)
3. Si el popup de login está bloqueado, usa el acceso directo por VID como alternativa
4. Los datos se actualizan automáticamente cada 30 segundos

---

## Tecnología

- **React** (hooks, sin build step)
- **Leaflet** para el mapa interactivo
- **OAuth2 PKCE** para autenticación segura con IVAO SSO
- **IVAO API v2** — datos de tráfico en tiempo real
- Funciona directamente en el navegador, sin npm ni bundler

---

## Endpoints IVAO

| Endpoint | Descripción |
|---|---|
| `GET /v2/tracker/whazzup` | Snapshot completo del tráfico en vivo |
| `POST sso.ivao.aero/token` | Intercambio de código OAuth2 |
| `GET /v2/users/me` | Perfil del usuario autenticado |

---

## Seguridad

- El Client Secret **nunca** está en el frontend (PKCE lo hace innecesario)
- El token se guarda solo en memoria (no en localStorage)
- Protección anti-CSRF con parámetro `state`

---

## Versiones

| Versión | Cambios principales |
|---|---|
| **v3.0** | OAuth2 PKCE completo, popup + polling automático, perfil de usuario |
| **v2.1** | Correcciones críticas: localStorage eliminado, estado React puro |
| **v2.0** | Tema claro, 3 pestañas, mapa Leaflet, amigos |
| **v1.0** | MVP: login VID, dashboard, brújula, FPL, ATC |

Ver historial completo en [CHANGELOG-ivao-companion.md](./CHANGELOG-ivao-companion.md).

---

## Próximamente

- Crear y editar Flight Plans desde la app (v1.1)
- Integración con AWOS propio de AirNubeiro (v1.3)
- PWA / app nativa con Capacitor (v2.0)

---

**Autor:** Álvaro · AirNubeiro (NBV) · IVAO VID 687072
