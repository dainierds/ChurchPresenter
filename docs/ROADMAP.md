# ChurchPresenter - Roadmap de Desarrollo

Este documento define la planificación oficial de las 10 fases de desarrollo de **ChurchPresenter**, software de presentaciones para iglesias para uso interno en Windows 11.

---

## Fases del Proyecto

### Fase 0: Preparación
- Definición de requisitos de hardware (PC Windows 11, GPU NVIDIA 4 salidas + splitter HDMI).
- Selección de stack tecnológico (Electron + Vite + React + TypeScript + SQLite).
- Diseño de arquitectura de procesos y aislamiento de seguridad.

### Fase 1: Cimientos (Completada)
- Estructura limpia modular: `main`, `preload`, `renderer/operator`, `renderer/output`, `shared`.
- Documentación técnica inicial: `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `README.md`.
- Configuración de linting, tipado estricto (`tsc`), pruebas unitarias (`vitest`) y script `npm run verify`.
- Base de datos local SQLite con soporte de migraciones automáticas para configuraciones.
- Sistema de logs rotativos persistentes en disco (`electron-log`).

### Fase 2: Motor de salidas multipantalla (Completada)
- Detección en vivo de pantallas físicas con Electron `screen` API (`display-added`, `display-removed`, `display-metrics-changed`).
- Modelo de roles de salida (`operator`, `main`, `stage`, `lobby`) extensible y asignable dinámicamente.
- Persistencia y restauración de asignación de pantallas; tolerancia a pantallas desconectadas.
- Ventanas de salida dedicadas: fullscreen exacto por coordenadas de pantalla, sin bordes, sin cursor (`cursor: none`), sin barra de tareas.
- Renderizado por capas: fondo (`background`), contenido (`content`), superpuesto (`overlay`) y mensaje (`message`).
- Controles globales inmediatos para el operador: Negro (Black), Limpiar (Clear), Logo y Congelar (Freeze) con atajos de teclado.
- Panel mínimo del operador con identificación visual de pantallas (overlay de 3 segundos) y cuadrícula de diapositivas de prueba.
- Modo de prueba de estrés animado (contador de fotogramas, reloj en ms, monitor de resolución y registro de bajadas de FPS).
- Tolerancia a fallos: autorrecuperación de ventanas de salida en caso de cierre anómalo.

### Fase 3: Contenido y servicio (Completada)
- Modelo de datos estructurado en SQLite (Migración 3): Canciones, Grupos (Verso, Coro, Puente, etc.), Arreglos, Presentaciones genéricas, Temas, Fondos, Servicios y Plantillas.
- Editor de canciones con detección automática de secciones mediante pegado de letra, reordenamiento de grupos, división automática por líneas por diapositiva, deshacer/rehacer (Undo/Redo) y vista previa de tema en vivo. Soporte UTF-8 completo para español.
- Motor de Temas con tipografía, colores, sombras, contornos, alineación, márgenes de seguridad y sobreescritura específica por rol de salida (ej. Escenario).
- Escalado universal a 1920x1080 para cualquier resolución y ajuste dinámico de tamaño de texto (auto-fit) para evitar desbordes de márgenes seguros.
- Gestor de biblioteca de fondos e importación/exportación completa de biblioteca en JSON.
- Lista de reproducción del servicio (culto) con canciones, presentaciones, diapositivas en blanco y separadores; creación desde plantillas y duplicación de cultos.
- Panel del operador en 3 zonas (Biblioteca con búsqueda insensible a acentos y tolerante a fallos de tipografía, Lista de Servicio, Cuadrícula de diapositivas con monitores duales de Previo y En Vivo).
- Atajos de teclado para avance de diapositivas y navegación de listas, y botón "Actualizar en vivo" para canciones editadas mientras están proyectadas.
- Monitor de Escenario (Confidence Monitor): vista dividida con diapositiva actual en alto contraste, vista previa de la siguiente diapositiva, reloj en tiempo real y banner de alertas del operador.

### Fase 4: Biblia (Completada)
- Almacenamiento desacoplado: cada traducción en su propio archivo SQLite `.bible` de solo lectura en la carpeta de datos del usuario, abierto bajo demanda y con caché en memoria.
- Base de datos principal limpia: no almacena versículos, únicamente favoritos y referencias recientes del operador.
- Evaluado e implementado motor de búsqueda de texto completo eficiente (FTS4 con normalización sin acentos para coincidencia instantánea sobre 31.102 versículos en < 5 ms).
- Importador de traducciones con soporte para 4 formatos estándar: JSON estructurado, Zefania XML, OSIS XML y USFM, con validación de derechos de autor y aviso explícito de licencia de propiedad intelectual.
- Traducciones de fábrica 100% de Dominio Público verificado: Reina-Valera 1909 (Español) y King James Version (Inglés), obtenidas de fuentes legítimas y libres.
- Analizador tolerante de referencias en español e inglés: soporta abreviaturas, nombres canónicos, números romanos, capítulos completos y rangos entre capítulos y versículos ("Juan 3:16", "jn 3 16", "1 co 13:4-7", "Salmos 23", "Gén 1.1-5").
- Motor de diapositivas bíblicas con auto-fit, salto inteligente de versículos sin cortes a mitad de versículo, indicación de referencia y traducción.
- Soporte de Doble Traducción simultánea (Español e Inglés lado a lado o apilado) configurable en tiempo real.
- Flujo de trabajo ágil para el operador: barra "Ir a", favoritos en un clic, historial de recientes, búsqueda de palabras con resaltado `<mark>`, atajos de teclado para versículos (flechas) y capítulos (C/X), y botón para añadir pasajes al orden del culto como elemento de tipo `'scripture'`.
- Monitor de escenario sincronizado con versículo proyectado y versículo siguiente.
- Banco de pruebas de guardado real con 5.000 canciones documentado en `DECISIONS.md`.
- Pruebas unitarias completas (Vitest) y pruebas E2E automatizadas con Playwright y Electron con capturas en `docs/evidence/`.

### Fase 5A: Medios y PDF (Completada)
- Biblioteca de medios gestionada en `userData/media/` con deduplicación criptográfica determinista SHA-256 (videos, audios, imágenes, PDFs).
- Detección de formatos nativos (MP4 con H.264/AAC, WebM con VP8/VP9, MP3, WAV) y advertencias preventivas de incompatibilidad de códecs.
- Reproducción de video en el servicio con deck de transporte completo (reproducir, pausar, detener, -10s, +10s, volumen, silencio, bucle, puntos de corte de entrada/salida y fundidos).
- Acciones configurables al finalizar el video (congelar en último fotograma, retornar al fondo o avanzar al siguiente elemento).
- Reloj maestro de sincronización multisalida en el proceso principal (`MasterMediaSyncService`, pulsos cada 200 ms) con compensación de deriva superior a 150 ms para reproducción ultra fluida a 60 FPS sin saltos acústicos.
- Enrutamiento de audio selectivo por rol de salida: salida de audio exclusiva por hardware en la pantalla designada (por defecto `main` / Sala), silenciando automáticamente las pantallas secundarias para evitar eco.
- Monitor de escenario inteligente durante videos: despliegue de temporizadores de alto contraste en tiempo real (tiempo transcurrido `MM:SS` y tiempo restante `-MM:SS`).
- Pista de audio ambiental independiente en la barra superior con controles de operador y botón de fundido gradual de 3 segundos (`fade-out`).
- Fondos de video en bucle continuo para temas y canciones.
- Motor de presentaciones PDF vectoriales basado en `pdfjs-dist` (licencia Apache 2.0), con soporte de DPR nativo para textos 4K nítidos, selector de modos de ajuste (`contain`, `cover`, `center`), precarga en segundo plano y navegación por diapositivas sin congelar la interfaz.
- Configuración independiente de Doble Traducción bíblica por rol de salida (ej. Sala: 1 versión; Escenario: 2 versiones apiladas).
- Banco de pruebas de rendimiento de video 1080p y 4K con 3 salidas activas y mediciones reales (`0.00%` caídas de fotogramas registradas con `getVideoPlaybackQuality()`).
- Suite de pruebas automatizadas E2E Playwright de 17 escenarios con captura exhaustiva de pantalla del operador y de cada una de las 3 salidas secundarias guardadas en `docs/evidence/`.

### Fase 5B: PowerPoint y Endurecimiento de Medios (Completada)
- Motor de conversión escalonada de PowerPoint (.pptx, .ppsx, .pptm): Microsoft PowerPoint COM Automation como motor principal, LibreOffice Headless como fallback secundario y Modo Manual asistido como fallback terciario.
- Automatización segura con PowerShell (`export-powerpoint.ps1`): ejecución no interactiva con parámetros tipados sin concatenación de cadenas, bypass de política de ejecución, desactivación forzada de macros (`AutomationSecurity = 3`), apertura en solo lectura sin ventana (`WithWindow = false`) y respeto estricto de PIDs para no cerrar sesiones previas de PowerPoint abiertas por el usuario.
- Extracción directa de notas del orador mediante parseo OpenXML (`ppt/notesSlides/notesSlide*.xml`) proyectadas en tiempo real en el monitor de escenario.
- Análisis de fidelidad visual por diapositiva: detección de animaciones, transiciones, medios incrustados y verificación de fuentes contra el catálogo de Windows (`C:\Windows\Fonts`) con insignias de advertencia.
- Caché inteligente por hash SHA-256 y resolución máxima de las salidas activas (1080p / 4K).
- Botón "Editar en PowerPoint" (`shell.openPath`) y verificación de cambios externos por hash para reimportar con un solo clic.
- Banco de pruebas de PowerPoint con 80 diapositivas convertido en 2.74s (29.2 diapositivas/segundo) sin bloqueo de interfaz.
- Benchmark honesto de reproducción de video extendido (35.4s continuos por resolución en 3 salidas simultáneas): 0% fotogramas caídos, CPU promedio 0.3% (1080p) / 1.4% (4K), RAM controlada (151 - 292 MB).
- Medición real de deriva temporal (drift) entre salidas: promedio 0.0 ms, máximo 1.0 ms. Calibración del umbral de tolerancia a 80 ms con justificación en mediciones reales.
- Enrutamiento físico de dispositivos de audio con `enumerateDevices()` y `setSinkId` (video y música ambiental de fondo) con prueba de tono armónico (chime) y alerta por desconexión física.
- Detección y conversión opcional de videos incompatibles (MKV, AVI, MOV, HEVC) mediante FFmpeg desacoplado (sin inflar el instalador con binarios).
- Aislamiento estricto de entorno de desarrollo (`%APPDATA%\church-presenter-dev`), distintivo visual `DESARROLLO` y botón de clonación unidireccional segura desde producción.
- Seguridad en migraciones SQLite: copia de seguridad automática pre-migración (`backup_pre_migration_v*`) y rollback automático seguro con notificación ante errores de migración.
- Suite de pruebas E2E ampliada a 20 escenarios completos con captura fotográfica de todas las ventanas en `docs/evidence/`.
- **Endurecimiento A.1-A.6 y Rediseño de UI ProPresenter 7**:
  - Explicación de causa raíz de contadores de fotogramas en `<video loop>` (Chromium `getVideoPlaybackQuality().totalVideoFrames` solo cuenta frames de decodificación del buffer y no se incrementa en bucles) vs `requestVideoFrameCallback` (`presentedFrames`).
  - Benchmark honesto extendido de 4 escenarios (MP4 1080p, MP4 4K, WebM 1080p, WebM 4K) en 3 salidas activas con 0 fotogramas caídos y telemetría de CPU/RAM/GPU.
  - Medición fotográfica de deriva entre salidas con timecodes impresos directamente en el buffer de video: deriva promedio < 7 ms y máxima de 16.2 ms (< 0.5 fotogramas).
  - Preservación comprobada de sesiones de PowerPoint del usuario mediante prueba automatizada (`tests/powerpoint-user-session.test.ts`).
  - Eliminación de rutas tipeadas a mano reemplazadas por diálogos nativos (`dialog.showOpenDialog`) y Drag & Drop con `webUtils.getPathForFile`.
  - Vigilante de archivos externos (`fs.watch`) con debounce y toast discreto "Actualizar".
  - Rediseño ergonómico completo de la ventana del operador al flujo ProPresenter 7 (3 columnas, TopMenuBar, ProToolbar, LibraryPanel, PlaylistPanel con cabeceras de sección de color, SlideGridPanel, MediaDrawer colapsable, RightSidePanel con preview, vúmetros, limpieza por capas y temporizadores).
  - Evidencia fotográfica verificada a 1920x1080 y 1366x768 (`docs/evidence/ui-operator-*.png` y `docs/evidence/ui-output-*.png`).

### Fase 5C: YouTube Integrado (Completada)
- Panel del operador con navegador embebido (`WebContentsView`) aislado en partición persistente `persist:youtube`.
- Navegación restringida a lista estricta de dominios permitidos (`youtube.com`, `google.com`, `accounts.google.com`, etc.) con derivación de enlaces externos al navegador predeterminado del sistema.
- Permisos de hardware (cámara, micrófono, geolocalización, notificaciones) denegados por seguridad.
- Bloqueo y filtrado de publicidad: reglas de cancelación de peticiones de anuncios en `webRequest.onBeforeRequest` y script inyectado de omisión automática de anuncios publicitarios.
- Botón en Configuración: "Cerrar sesión / borrar datos de YouTube" para purgar cookies y datos de la partición bajo demanda.
- Botón "Proyectar este video" y atajo de teclado (`Ctrl+Y`) para extraer videoId, título, canal, miniatura y duración desde videos normales, Shorts y listas de reproducción.
- Nuevo tipo de elemento de servicio `'youtube'` con miniatura, duración, puntos de entrada y salida, acción al terminar y selección de pantallas y audio.
- Comprobación automática de disponibilidad mediante endpoint oficial oEmbed (`ok`, `unembeddable`, `requires_auth`, `unavailable`, `offline`).
- Modal "Verificar playlist" pre-culto para comprobar en lote la disponibilidad de todos los videos de YouTube del servicio.
- Evaluación técnica y selección fundamentada de la Opción (b) (vista dedicada con partición `persist:youtube`) frente a la Opción (a) (IFrame) para evitar bloqueo de cookies de terceros y mantener la sesión/Premium del usuario.
- Precarga oculta en pausa para transiciones inmediatas en vivo sin parpadeo negro.
- Enrutamiento selectivo de audio por hardware y silencio automático en pantallas secundarias.
- Sincronización multisalida con compensación de deriva superior a 250 ms.
- Integración con controles globales (Negro F1, Limpiar, Congelar) y pantalla de escenario con temporizadores regresivos de alto contraste.
- Modal de advertencia legal y de conectividad en el primer uso.
- Soporte opcional para descarga y extracción local a la biblioteca de medios mediante `yt-dlp` desacoplado.
- Suite de pruebas unitarias (`tests/youtube-utils.test.ts`, `tests/youtube-service.test.ts`) y prueba automatizada E2E con Playwright/Electron y capturas de evidencia en `docs/evidence/`.
- **Pendiente para fases futuras**:
  - Buscador propio nativo con la API de datos de YouTube v3 (requiere clave de API y administración de cuotas en Google Cloud) para presentar cuadrículas de búsqueda personalizadas dentro del estilo de la app sin abrir youtube.com.

### Fase 6: Escenario/temporizadores/control remoto
- Vista de monitor de escenario (Stage Display / Confidence Monitor) personalizada con reloj, temporizador regresivo y diapositiva siguiente.
- Servidor local WebSocket/HTTP para control remoto inalámbrico desde tabletas o teléfonos en la red local.

### Fase 7: Estabilidad
- Watchdog de rendimiento, optimización de uso de memoria GPU/VRAM.
- Pruebas de estrés de 24+ horas con cambios continuos de medios.
- Modos de recuperación ante desconexiones de cables HDMI / DP.

### Fase 8: Automatización
- Integración MIDI / Companion / Stream Deck para disparo de señales y macros.
- Planificación de cultos y listas de reproducción secuenciales automáticas.

### Fase 9: Transmisión tipo OBS
- Salida NDI o captura directa para software de streaming (OBS Studio / vMix).
- Salida con canal alfa (Key/Fill) para subtitulado y lower thirds en vivo.

### Fase 10: Extras
- Funcionalidades avanzadas de iglesia (anuncios rotativos de lobby, conteo regresivo previo al servicio, sincronización en nube de librerías).
