# CHANGELOG — IVAO Companion

> **Proyecto:** IVAO Companion  
> **Autor:** Álvaro · AirNubeiro (NBV) · IVAO  
> **VID:** 687072  
> **Client ID:** 1e1a3f0b-8703-45a4-9ac4-c3d32c  
> **Redirect URLs registradas:** https://claude.ai · GitHub Pages

---

## [Unreleased] — Roadmap

### v1.1 — Perfil extendido + FPL desde app
- [ ] Scopes adicionales: `flight_plans:read`, `flight_plans:write`
- [ ] Crear/modificar Flight Plans directamente desde la app
- [ ] Historial de vuelos del piloto (Private API)
- [ ] ATIS automático de aeropuerto de destino

### v1.2 — Opción B · Control Remoto LAN
- [ ] Guía de configuración RustDesk/Parsec/AnyDesk para acceso a Altitude UI desde tablet
- [ ] Documentación arquitectura: Pilot Core (sim) ↔ Pilot UI (LAN/remoto)

### v1.3 — Nubeiro AWOS Integration
- [ ] Integración con sistema AWOS propio de AirNubeiro para datos meteo locales
- [ ] Persistencia de amigos (IndexedDB o backend mínimo)
- [ ] Alertas push cuando ATC se conecta en área

### v2.0 — App nativa móvil (PWA/Capacitor)
- [ ] Empaquetado como PWA con service worker
- [ ] Notificaciones push en segundo plano
- [ ] Mapa con clustering de tráfico para mejor rendimiento

---

## [3.0] — 2026-02-28

### OAuth2 PKCE — Integración completa

#### Flujo implementado
- **Authorization Code + PKCE** — el estándar que usa WebEye y FPL de IVAO
- `code_verifier` generado con `crypto.getRandomValues` (seguro, no predecible)
- `code_challenge = base64url(SHA-256(verifier))` vía `crypto.subtle.digest`
- URL de autorización: `https://sso.ivao.aero/auth?response_type=code&code_challenge=...`
- Scopes: `openid email`
- State anti-CSRF incluido

#### Mecanismo popup + polling automático
- Se abre popup a `https://sso.ivao.aero/auth`
- Polling cada 500ms — cross-origin lanza excepción mientras en dominio IVAO (capturada silenciosamente)
- Cuando el popup redirige a `claude.ai` (mismo origen), la excepción cesa y se lee `popup.location`
- Extracción automática del `code` y verificación de `state`
- El popup se cierra automáticamente tras capturar el código
- **Sin acción manual del usuario** — el token se captura solo

#### Intercambio de código
- `POST https://sso.ivao.aero/token` con `grant_type=authorization_code`, `code`, `code_verifier`
- Fetch directo del browser (CORS permitido en el endpoint de token de IVAO)
- Fallback: proxy via Claude API si falla CORS
- Decodificación JWT del `access_token` (sin verificar firma) para extraer VID del campo `sub`

#### Perfil de usuario
- `GET https://api.ivao.aero/v2/users/me` con `Authorization: Bearer {token}`
- Obtiene: `firstName`, `lastName`, `id` (VID), `pilotRating`, `atcRating`, `division`
- Fallback proxy via Claude API si CORS falla en acceso directo
- Perfil mostrado en header y pantalla "Mi vuelo"

#### UX del flujo de login
- 3 pasos visuales con estado: Esperando login → Intercambiando código → Obteniendo perfil
- Indicador de progreso animado por paso
- Mensajes de error descriptivos con causa exacta
- Botón cancelar en cualquier momento
- Fallback: acceso por VID sin OAuth si popup bloqueado o IVAO no responde

#### Seguridad
- Client Secret NUNCA en el frontend (PKCE lo hace innecesario)
- State anti-CSRF verificado antes de intercambiar código
- `code_verifier` nunca sale del browser hasta el intercambio con token endpoint
- Token almacenado en React state (en memoria, no en localStorage)

### Mejoras generales
- Header: muestra nombre completo + VID cuando autenticado con OAuth2
- FlightTab: chip de perfil con nombre, rating y división cuando no está volando
- Código refactorizado: auth desacoplada del resto de la app
- Sin dependencias externas excepto Leaflet y Google Fonts

---

## [2.1] — 2026-02-28 (anterior)

### Correcciones críticas
- FIX: `localStorage` eliminado → React state puro
- FIX: Prop `style` duplicado en JSX
- FIX: Syntax error `gap:6"` en objeto style
- RENAME: Proyecto → "IVAO Companion"

---

## [2.0] — 2026-02-28 ⚠️ Bugs críticos

### Implementado (con bugs)
- Tema claro, 3 pestañas (Mi vuelo / Tráfico / Amigos)
- Mapa Leaflet con todos los pilotos y ATC
- Amigos por VID con estado en tiempo real

---

## [1.0.0] — 2026-02-28

### Primera versión
- Login VID, dashboard vuelo, brújula, FPL, ATC en área
- Auto-refresco 30s, mapa OSM estático
- Estética dark glass cockpit (deprecated)

---

## Notas técnicas — Configuración IVAO

### Application Settings (developers.ivao.aero)
```
App Name:    MobileAPP
Status:      Active
User ID:     687072
Client ID:   1e1a3f0b-8703-45a4-9ac4-c3d32c  ← VERIFICAR UUID COMPLETO
Redirect:    https://claude.ai  ✅
             https://[github-pages-url]  ✅
```

### ⚠️ Verificación pendiente
El Client ID visible en la captura (`c3d32c` al final) puede estar truncado.
Un UUID completo tiene formato `8-4-4-4-12` = 32 caracteres hex + 4 guiones.
Verificar en developers.ivao.aero → tu app → Client Credentials.

### Endpoints IVAO usados
| Endpoint | Auth | Estado |
|---|---|---|
| `GET /v2/tracker/whazzup` | No | ✅ Activo |
| `POST sso.ivao.aero/token` | PKCE | ✅ v3.0 |
| `GET /v2/users/me` | Bearer | ✅ v3.0 |
| `GET /v2/users/me` (flight plans) | Bearer+scope | 🔜 v1.1 |
