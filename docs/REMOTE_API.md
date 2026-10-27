# Especificación de la API de Control Remoto y Escenario (Fase 6)

ChurchPresenter incorpora un servidor HTTP y WebSocket local para permitir el control de presentaciones desde dispositivos móviles y proveer un monitor de escenario interactivo para tabletas.

---

## 1. Endpoints HTTP del Servidor

| Método | Ruta | Autenticación Requerida | Nivel de Acceso | Descripción |
|---|---|---|---|---|
| `GET` | `/` o `/index.html` | No (Carga la app cliente) | Público | Sirve la interfaz web para smartphones/tablets del operador. |
| `GET` | `/stage` o `/stage.html` | Token en query o PIN modal | Solo Lectura | Visor de escenario interactivo para músicos/pastor. |
| `GET` | `/api/status` | No | Público | Estado de la versión y si requiere autenticación. |
| `POST` | `/api/auth` | No (Valida PIN) | Público con Rate-Limit | Autenticación mediante PIN numérico de 6 dígitos. |
| `GET` | `/api/state` | Sí (`Bearer <token>`) | Operador / Solo Lectura | Obtiene el estado actual de la presentación (`PresenterState`). |
| `POST` | `/api/control` | Sí (`Bearer <token>`) | Operador (Control Total) | Ejecuta órdenes de proyección en vivo (diapositivas, capas, video, mensajes). |

---

## 2. Protocolo WebSocket (`/ws?token=<token>`)

La comunicación bidireccional de baja latencia se realiza a través de WebSocket en la ruta `/ws`.

### Mensajes Enviados por el Cliente (Inbound)

| Tipo (`type`) | Carga Útil (`payload`) | Requisitos de Rol | Acción Ejecutada |
|---|---|---|---|
| `ping` | `{ t0: number }` | Cualquier rol | Responde inmediatamente con `pong` para medir latencia de transporte. |
| `next-slide` | Ninguno | Operador | Avanza a la siguiente diapositiva y la envía a vivo. |
| `prev-slide` | Ninguno | Operador | Retrocede a la diapositiva anterior y la envía a vivo. |
| `next-item` | Ninguno | Operador | Salta al siguiente elemento de la playlist del servicio. |
| `prev-item` | Ninguno | Operador | Salta al elemento anterior de la playlist del servicio. |
| `select-item` | `{ itemId: string }` | Operador | Selecciona un elemento específico de la playlist. |
| `send-slide` | `{ slide: SlideItem }` | Operador | Proyecta directamente una diapositiva en las salidas. |
| `clear-layer` | `{ layer: 'audio' \| 'background' \| 'slide' \| 'message' \| 'media' \| 'all' }` | Operador | Limpia una capa individual de forma independiente. |
| `global-control` / `emergency-action` | `{ action: 'black' \| 'clear' \| 'logo' \| 'freeze' }` | Operador | Conmuta acciones globales de emergencia (F1-F4). |
| `control-timer` / `timer-action` | `{ action: 'start' \| 'pause' \| 'reset', timerId?: string }` | Operador | Controla temporizadores de cuenta regresiva o cronómetro. |
| `control-video` / `video-control` | `{ command: 'play' \| 'pause' \| 'seek' \| 'seek-rel', deltaSeconds?: number }` | Operador | Controla reproducción de video y saltos manuales (+/-15s). |
| `send-message` | `{ text: string, target?: 'stage' \| 'audience' \| 'both', durationSeconds?: number }` | Operador | Despliega avisos en audiencia o escenario. |
| `clear-message` | Ninguno | Operador | Retira cualquier aviso activo. |

### Mensajes Enviados por el Servidor (Outbound)

| Tipo (`type`) | Contenido | Descripción |
|---|---|---|
| `pong` | `{ t0: number, t1: number }` | Respuesta al ping de medición de latencia. |
| `state-update` | `{ state: PresenterState, layout?: StageLayoutConfig }` | Difusión en tiempo real de cambios de diapositiva, timers y estado. |
| `error` | `{ error: string }` | Notificación de error de validación, sintaxis o permisos. |

---

## 3. Matriz de Separación de Privilegios

ChurchPresenter implementa el principio de **mínimo privilegio**:

| Operación / Comando | Rol: Monitor Escenario (`stage-viewer`) | Rol: Control Remoto (`operator`) | Aplicación Local (Operador de Escritorio) |
|---|---|---|---|
| Ver diapositiva actual y siguiente | ✅ Permitido | ✅ Permitido | ✅ Permitido |
| Ver reloj, temporizadores y avisos | ✅ Permitido | ✅ Permitido | ✅ Permitido |
| Cambiar diapositiva / elemento | ❌ Bloqueado (403) | ✅ Permitido | ✅ Permitido |
| Conmutar Negro, Logo, Limpiar, Congelar | ❌ Bloqueado (403) | ✅ Permitido | ✅ Permitido |
| Controlar temporizadores y videos | ❌ Bloqueado (403) | ✅ Permitido | ✅ Permitido |
| **Modificar Configuración del Sistema (`save-config`)** | ❌ **PROHIBIDO (403)** | ❌ **PROHIBIDO (403)** | ✅ Permitido |
| **Eliminar Canciones / Bibliotecas (`delete-song`)** | ❌ **PROHIBIDO (403)** | ❌ **PROHIBIDO (403)** | ✅ Permitido |
| **Borrar Datos de Demostración (`clear-demo-data`)** | ❌ **PROHIBIDO (403)** | ❌ **PROHIBIDO (403)** | ✅ Permitido |
| **Expulsar Dispositivos / Gestionar Red (`manage-devices`)**| ❌ **PROHIBIDO (403)** | ❌ **PROHIBIDO (403)** | ✅ Permitido |
| **Importar / Exportar Datos (`import-library`, etc.)** | ❌ **PROHIBIDO (403)** | ❌ **PROHIBIDO (403)** | ✅ Permitido |

Cualquier intento por parte de un token de control de invocar comandos administrativos es interceptado y rechazado con código HTTP 403 Forbidden.

---

## 4. Medición de Latencia de Extremo a Extremo (E2E Real)

La latencia no se mide mediante un simple eco de red (ping-pong), sino **de extremo a extremo real**:
1. El cliente móvil envía el comando `next-slide` por WebSocket a través de la dirección IP de red local (LAN).
2. El servidor procesa el paquete y despacha el cambio al hilo de presentación.
3. El motor de salidas actualiza el DOM de la ventana de salida real de Electron (`/output/main`).
4. El observador de la ventana de salida detecta la renderización efectiva del cambio.

### Resultados de la Auditoría Automatizada (50 Muestras Continuas):
- **Conexión:** Red Local LAN (`10.0.0.122:8080`)
- **Muestras:** 50 iteraciones consecutivas
- **Mínimo:** 1.37 ms
- **Mediana ($p_{50}$):** **15.37 ms**
- **Percentil 95 ($p_{95}$):** **16.07 ms**
- **Máximo:** 16.40 ms
- **Resultado:** **APROBADA** (Supera ampliamente el umbral exigido de 150 ms para $p_{50}$ y 200 ms para $p_{95}$).
