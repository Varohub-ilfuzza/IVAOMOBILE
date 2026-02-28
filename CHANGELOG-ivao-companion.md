# CHANGELOG — IVAO Altitude Companion

> **Proyecto:** IVAO Altitude Companion · Dashboard móvil para pilotos IVAO  
> **Repositorio:** Local / Claude.ai Artifact  
> **Autor:** Álvaro · Técnico Aeronáutico IVAO  
> **API base:** `https://api.ivao.aero/v2/`

---

## [Unreleased] — Roadmap

### Planificado v1.1 — OAuth2 SSO (Login IVAO Oficial)
- [ ] Integración completa con OAuth2 Authorization Code Flow de IVAO
- [ ] Login con usuario y contraseña IVAO directamente desde la app (SSO oficial)
- [ ] Acceso a endpoints privados `/v2/users/me/*` tras consentimiento GDPR
- [ ] Scope requerido: `profile`, `email`, `ivao_data`
- [ ] Endpoint SSO: `https://sso.ivao.aero/`
- [ ] **Nota:** Requiere callback URL registrado en `https://developers.ivao.aero/`

### Planificado v1.2 — Opción B · Control Remoto LAN/RDP
- [ ] Guía de configuración VNC/RDP sobre red local para acceso a Altitude UI desde tablet
- [ ] Pruebas con Parsec, RustDesk y AnyDesk como clientes recomendados
- [ ] Documentación arquitectura: Pilot Core (simulador) <-> Pilot UI (LAN/remoto)
- [ ] Compatibilidad confirmada: MSFS 2020/2024, X-Plane 12, P3D v5
- [ ] Pilot Core y Pilot UI en red local interna (mismo segmento o VPN)

### Planificado v1.3 — Funcionalidades extendidas
- [ ] Historial de vuelos del usuario vía Private API
- [ ] Flight Plan System API: crear/modificar FPL desde móvil
- [ ] ATIS automático de destino (ATIS Whazzup v2)
- [ ] Integración Nubeiro AWOS para datos meteorológicos locales
- [ ] Alertas push cuando ATC se conecta en área (requiere backend)
- [ ] Integración SimBrief -> FPL automático a IVAO

### Planificado v2.0 — App nativa móvil
- [ ] Evaluación React Native / Capacitor.js (APK/IPA)
- [ ] Mapa interactivo nativo con tráfico IVAO en tiempo real (tipo WebEye)
- [ ] Notificaciones push en segundo plano

---

## [1.0.0] — 2026-02-28

### Primera versión — Lanzamiento inicial

#### Nuevas funcionalidades
- Pantalla de login por VID de IVAO
- Dashboard principal: vista completa del vuelo activo
- Tracking en tiempo real: altitud, GS, heading, posición, fase de vuelo, squawk, tiempo conectado
- Plan de vuelo completo: DEP/ARR, aeronave, nivel, reglas, ruta, observaciones
- ATC en área: hasta 8 estaciones activas con frecuencias
- Mapa de posición OpenStreetMap embebido (filtro glass cockpit, expandible)
- Estadísticas de red en tiempo real (pilotos + ATC online)
- Auto-refresco cada 30s con barra de progreso visual
- Pantalla offline cuando el piloto no está conectado
- Placeholder Opción B para futura integración control remoto

#### Arquitectura técnica
- API pública: IVAO Whazzup v2 — `https://api.ivao.aero/v2/tracker/whazzup`
- Proxy: peticiones cursadas vía Claude API con herramienta web_search
- Frontend: React + CSS-in-JS, mobile-first (max-width 480px)
- Estética: Glass cockpit — dark aviation, cyan/amber, scanlines CRT

#### Endpoints IVAO utilizados en v1.0
| Endpoint | Tipo | Auth | Uso |
|---|---|---|---|
| GET /v2/tracker/whazzup | Pública | No | Datos en tiempo real de todos los conectados |
| GET /v2/tracker/atis | Pública | No | ATIS estaciones ATC (planificado v1.3) |
| GET /v2/users/{vid} | Privada | API Key | Perfil usuario (planificado v1.1) |
| GET /v2/users/me | Privada | OAuth2 | Datos propios autenticado (v1.1) |
| FPL System | Privada | OAuth2 | Gestión planes de vuelo (planificado v1.3) |

#### Limitaciones conocidas v1.0.0
- No existe API oficial IVAO para controlar Altitude remotamente
- Login usuario/contraseña requiere OAuth2 SSO — pendiente v1.1
- ATC en área no filtrado por distancia geográfica real
- Sin historial de vuelos (requiere API privada)

---

## Notas de investigación API — 2026-02-28

### Confirmado
- Whazzup pública: todos los pilotos/ATC, refresco 15s, sin auth
- Private API: requiere API key o OAuth2 desde `https://developers.ivao.aero/`
- OAuth2 SSO: login real con credenciales IVAO (el usuario puede autenticarse con su login habitual)
- GDPR: consentimiento vinculado a la app, no al token; acceso permanente posible con API key propia
- NO existe API para controlar Altitude (radio, transponder, chat, FPL activo)
- Workaround control remoto: Pilot UI soporta red Ethernet interna -> compatible RDP/VNC desde tablet

### Referencias
- API Docs: https://wiki.ivao.aero/en/home/devops/api/documentation-v2
- Whazzup v2: https://api.ivao.aero/v2/tracker/whazzup
- Developers: https://developers.ivao.aero/
- OAuth samples: https://github.com/ivaoaero/OAuth-samples
- Private API Swagger: https://api.ivao.aero/docs
