# Protocolo WebSocket de Subtítulos y Traducción en Vivo (`SUBTITLES_API`)

Este documento especifica la interfaz WebSocket utilizada por transcriptores, traductores humanos y servicios automáticos de subtitulación para inyectar subtítulos y traducciones en tiempo real en las salidas de ChurchPresenter.

---

## 1. Conexión y Autenticación

- **URL del Endpoint**: `ws://<host>:<puerto>/ws?token=<sessionToken>`
- **Autenticación**:
  El parámetro `token` es obligatorio para sesiones con privilegios de envío. Se obtiene al iniciar sesión como operador o mediante un token específico generado en la pantalla de control de subtítulos.
  Las conexiones con tokens inválidos o sin privilegios de control son rechazadas inmediatamente con código `401 Unauthorized` o `403 Forbidden`.
- **Protección de Origen (CORS / DNS Rebinding)**:
  El servidor valida el encabezado `Origin` permitiendo únicamente conexiones procedentes de la red de área local (LAN) o localhost.

---

## 2. Formato de Mensajes

Todos los mensajes se transmiten en formato JSON codificado en UTF-8. El tamaño máximo por mensaje es de **64 KB**.

### A. Envío de Subtítulo (`subtitle`)

Envía un nuevo subtítulo y/o traducción para ser proyectado en pantalla. Si ya hay un subtítulo en pantalla, se reemplaza suavemente con una transición de fundido.

```json
{
  "type": "subtitle",
  "text": "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito...",
  "translation": "For God so loved the world, that he gave his only begotten Son...",
  "targetRoles": ["main", "lobby", "program"],
  "durationSec": 6
}
```

#### Campos:
| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `type` | `string` | Sí | Debe ser `"subtitle"` o `"send_subtitle"`. |
| `text` | `string` | Sí | Texto en el idioma original que se proyectará. |
| `translation` | `string` | No | Traducción opcional proyectada en una segunda línea con color destacado. |
| `targetRoles` | `string[]` | No | Lista de salidas donde debe verse. Si se omite, usa la configuración predeterminada (por ejemplo `["main", "lobby"]`). Si se excluye `"stage"`, el monitor de escenario no se satura con subtítulos. |
| `durationSec` | `number` | No | Segundos tras los cuales el subtítulo desaparece automáticamente tras silencio. Si se omite, usa `autoClearDelaySec` (5 segundos por defecto). |

---

### B. Limpieza Manual de Subtítulos (`clear_subtitle`)

Oculta de inmediato cualquier subtítulo activo en todas las salidas.

```json
{
  "type": "clear_subtitle"
}
```

---

### C. Latencia y Keepalive (`ping` / `pong`)

Para medir la latencia entre el transcriptor y la pantalla o mantener viva la conexión WebSocket:

**Cliente envía:**
```json
{
  "type": "ping",
  "t0": 1709000000123
}
```

**Servidor responde:**
```json
{
  "type": "pong",
  "t0": 1709000000123
}
```

---

## 3. Renderizado y Estructura DOM en Pantalla

En cada ventana de salida (`OutputApp.tsx`), los subtítulos se renderizan en una capa dedicada con clase CSS `.output-subtitles-layer`:

```html
<div class="output-subtitles-layer output-subtitles-bottom">
  <div class="output-subtitle-bubble">
    <div class="output-subtitle-text">Texto del subtítulo...</div>
    <div class="output-subtitle-translation">Traducción opcional...</div>
  </div>
</div>
```

### Características de Visualización:
1. **Posición**: Configurable en `'bottom'` (inferior) o `'top'` (superior).
2. **Líneas Máximas**: Truncado elegante (`WebkitLineClamp: 2`) para no tapar el contenido de diapositivas o cámaras.
3. **Fundido Suave**: Transición de opacidad gobernada por `fadeDurationMs` (300 ms por defecto).
4. **Desvanecimiento Automático por Silencio**: Temporizador cancelable que oculta el subtítulo si transcurren `durationSec` sin nuevos mensajes.
5. **Aislamiento por Rol**: Si el rol de la pantalla no coincide con `targetRoles`, el componente no se monta en el DOM.
