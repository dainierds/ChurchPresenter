# ChurchPresenter - Arquitectura del Sistema

Este documento describe la arquitectura técnica de **ChurchPresenter**, el flujo de estado, la interacción entre procesos de Electron y el modelo de ventanas y capas multipantalla.

---

## 1. Arquitectura de Procesos

```mermaid
graph TD
    subgraph MainProcess ["Proceso Principal (Main Process - Node.js)"]
        StateMgr["PresenterStateManager\n(Única Fuente de Verdad)"]
        DisplayMgr["DisplayManager\n(Detección Screen API)"]
        WindowMgr["OutputWindowManager\n(Gestor de Ventanas)"]
        DbMgr["DatabaseService\n(SQLite + Migraciones)"]
        LogMgr["LoggerService\n(electron-log Rotativo)"]
        RemoteServer["RemoteServer\n(HTTP + WebSocket 8080)"]
        StageSvc["StageLayoutService\n(CRUD y Asignación de Diseños)"]
        MsgSvc["MessageService\n(Avisos Audiencia/Escenario)"]
    end

    subgraph PreloadLayer ["Capa de Preload (Aislamiento de Contexto)"]
        Bridge["contextBridge.exposeInMainWorld\n('churchPresenterApi')"]
    end

    subgraph Renderers ["Procesos de Renderizado (Chromium)"]
        OpRenderer["Operador (renderer/operator)\nUI Interactiva, Atajos, Monitor"]
        OutMain["Salida: Main (renderer/output)\nPantalla Sala Principal"]
        OutStage["Salida: Stage (renderer/output)\nPantalla de Escenario"]
        OutLobby["Salida: Lobby (renderer/output)\nPantalla de Vestíbulo"]
    end

    subgraph MobileClients ["Clientes Móviles y Remotos (LAN)"]
        WebRemote["Control Remoto Web (GET /)\nSmartphones / Tablets"]
        WebStage["Visor Web de Escenario (GET /stage)\nTablets / Monitores Inalámbricos"]
    end

    StateMgr -->|IPC: state-updated| Bridge
    DisplayMgr -->|IPC: displays-changed| Bridge
    Bridge --> OpRenderer
    Bridge --> OutMain
    Bridge --> OutStage
    Bridge --> OutLobby

    RemoteServer <-->|WebSocket: /ws| WebRemote
    RemoteServer -->|WebSocket: /ws| WebStage
    RemoteServer -->|Dispatch Action| StateMgr

    OpRenderer -->|IPC Invoke: set-global-control| StateMgr
    OpRenderer -->|IPC Invoke: send-slide| StateMgr
    OpRenderer -->|IPC Invoke: assign-role| WindowMgr
    OpRenderer -->|IPC Invoke: identify-displays| WindowMgr
```

---

## 2. Flujo de Estado Unidireccional (Single Source of Truth)

Toda mutación de estado nace en el proceso principal. Los renderizadores nunca mutan el estado directamente; envían intenciones/acciones mediante invocaciones IPC tipadas y reciben snapshots inmutables del estado actualizado.

```
[Acción del Operador] (p. ej. Presionar 'Negro' o 'F1')
       │
       ▼
[IPC Invoke: 'control:set-global']
       │
       ▼
[Main Process: PresenterStateManager]
       ├── 1. Valida y aplica la mutación en el estado inmutable
       ├── 2. Persiste la configuración relevante en SQLite (si aplica)
       ├── 3. Registra la acción en el archivo de log rotativo
       │
       ▼
[Broadcast IPC: 'state:updated'] (a todas las ventanas activas)
       ├──> Ventana Operador (actualiza botón Negro a estado activo/brillante)
       ├──> Ventana Output 'main' (aplica opacidad 0 o capa negra instantánea)
       ├──> Ventana Output 'stage' (refleja estado según configuración de capas)
       └──> Ventana Output 'lobby' (aplica capa negra)
```

---

## 3. Modelo de Ventanas y Robustez

1. **Ventana del Operador (`operator`)**:
   - Ventana estándar con marco, minimizable, redimensionable, con acceso al control total y vista previa de pantallas.
2. **Ventanas de Salida (`output/:role`)**:
   - Una ventana independiente por cada rol físico asignado (`main`, `stage`, `lobby`, etc.).
   - Atributos clave:
     - `frame: false` (sin bordes).
     - `fullscreen: false` con bounds exactos `(x, y, width, height)` de la pantalla destino (técnica preferida en Windows multipantalla para evitar desubicación de coordenadas al perder foco).
     - `alwaysOnTop: true` (nivel 'screen-saver' o 'floating' configurable).
     - `skipTaskbar: true` (evita saturar la barra de tareas y el diálogo Alt+Tab de Windows).
     - `cursor: none` (cursor oculto permanentemente sobre la superficie de proyección).
     - `backgroundColor: '#000000'` (fondo negro para evitar parpadeos blancos durante la carga).
3. **Resiliencia y Auto-Recuperación**:
   - El `OutputWindowManager` escucha el evento `render-process-gone` y `unresponsive`.
   - Si una ventana de salida falla o es cerrada accidentalmente por el sistema operativo, se registra el incidente con severidad `ERROR` y se instancia una nueva ventana en la misma pantalla en menos de 1 segundo sin afectar al resto de salidas.

---

## 4. Arquitectura de Capas de Salida

Cada rol de salida renderiza cuatro capas apiladas con orden z-index definido:

```
┌────────────────────────────────────────────────────────┐
│ Capa 4: Mensaje (Message Layer - z-index: 40)          │  <-- Avisos urgentes, guardería, alertas
├────────────────────────────────────────────────────────┤
│ Capa 3: Superpuesto (Overlay Layer - z-index: 30)      │  <-- Logo, lower-thirds, marcas de agua
├────────────────────────────────────────────────────────┤
│ Capa 2: Contenido (Content Layer - z-index: 20)        │  <-- Letra de canciones, diapositivas, Biblia
├────────────────────────────────────────────────────────┤
│ Capa 1: Fondo (Background Layer - z-index: 10)         │  <-- Color sólido, degradado, video o imagen
└────────────────────────────────────────────────────────┘
```

### Controles Globales de Supresión Rápida
- **Negro (Black)**: Suprime todas las capas inmediatamente (renderiza negro absoluto en pantalla).
- **Limpiar (Clear)**: Oculta la Capa 2 (Contenido) y Capa 4 (Mensaje), manteniendo visible la Capa 1 (Fondo).
- **Logo**: Muestra inmediatamente el logo configurado en la Capa 3 (Superpuesto), respetando o superponiéndose al fondo.
- **Congelar (Freeze)**: El renderizador de salida ignora temporalmente actualizaciones de contenido nuevo entrantes, congelando el último frame renderizado en memoria GPU hasta descongelar.

---

## 5. Canales IPC Tipados

| Canal IPC | Tipo | Dirección | Descripción |
|---|---|---|---|
| `screens:get` | Invoke/Handle | Renderer -> Main | Solicita lista de pantallas físicas detectadas |
| `screens:identify` | Invoke/Handle | Renderer -> Main | Dispara overlay de identificación durante 3 segundos |
| `screens:assign-role` | Invoke/Handle | Renderer -> Main | Asigna o desasigna un rol a un ID de pantalla |
| `screens:changed` | Send | Main -> Renderer | Notifica conexión/desconexión o cambio de resolución |
| `state:get` | Invoke/Handle | Renderer -> Main | Obtiene el estado actual completo |
| `state:updated` | Send | Main -> Renderer | Notifica mutaciones de estado a todas las ventanas |
| `control:set-global` | Invoke/Handle | Renderer -> Main | Activa/desactiva Black, Clear, Logo, Freeze |
| `slides:send` | Invoke/Handle | Renderer -> Main | Envía una diapositiva a uno o varios roles |
| `stress:log-drop` | Send | Renderer -> Main | Notifica caída de FPS en modo de prueba de estrés al logger |

---

## 6. Panel del Operador en 3 Zonas

El panel principal del operador se organiza en tres zonas de trabajo ergonómicas:

```
┌──────────────────┬───────────────────┬──────────────────────────────────────┐
│  1. BIBLIOTECA   │ 2. LISTA SERVICIO │ 3. DIAPOSITIVAS Y MONITORES DUALES   │
│                  │                   │                                      │
│ [Canciones]      │ Servicio Domingo  │ [EN VIVO]         [VISTA PREVIA]     │
│ [Presentaciones] │ ───────────────── │ Salida Principal  Monitor Previo     │
│                  │ 1. 🎵 Alabanza 1  │ ──────────────────────────────────── │
│ 🔍 Buscar...     │    Arreglo: Def   │ Cuadrícula de diapositivas           │
│                  │ 2. 🎵 Alabanza 2  │ ┌─────────┐ ┌─────────┐ ┌──────────┐ │
│ • Cuán Grande    │ 3. 📄 Bienvenida  │ │Verso 1  │ │Coro     │ │Verso 2   │ │
│ • En la Cruz     │ 4. ➖ En Blanco   │ │(Doble   │ │(Click:  │ │          │ │
│ • Sublime Gracia │                   │ │ Clic)   │ │ Previo) │ │          │ │
│                  │ [▲ Subir] [▼] [X] │ └─────────┘ └─────────┘ └──────────┘ │
│ [+ Nueva Canción]│ [+ Blanco][+ Sep] │ [Actualizar en vivo si fue editada]  │
└──────────────────┴───────────────────┴──────────────────────────────────────┘
```

- **Zona 1 (Biblioteca)**: Búsqueda rápida insensible a acentos y tolerante a faltas ortográficas. Acceso a creación/edición de canciones, importación y exportación de biblioteca en formato JSON.
- **Zona 2 (Lista del Servicio)**: Elementos ordenados del culto (canciones con selector de arreglo, anuncios, diapositivas en blanco y separadores). Permite guardar como plantilla, crear desde plantilla o duplicar cultos.
- **Zona 3 (Diapositivas y Monitores)**:
  - **Doble Monitor Superior**: Muestra en tiempo real lo que está `EN VIVO` en las pantallas de la congregación y la `VISTA PREVIA` de la diapositiva seleccionada antes de proyectarla.
  - **Cuadrícula de Diapositivas**: Un clic selecciona para vista previa; doble clic o tecla `Enter` envía a las pantallas en vivo.
  - **Actualizar en vivo**: Si el operador edita una canción que está siendo proyectada, lo proyectado se mantiene intacto sin parpadeos hasta que el operador presiona el botón "Actualizar en vivo".
  - **Navegación por teclado**: Flechas (Arriba/Abajo/Izquierda/Derecha) navegan diapositivas; `PageDown` o tecla `N` avanza al siguiente elemento de la lista del culto.

---

## 7. Monitor de Escenario (Confidence Monitor)

El rol de salida `stage` implementa una vista adaptada para músicos, cantantes y predicador:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [RETORNO / ESCENARIO]            Cuán Grande es Él                 10:45:00 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔔 ALERTA DEL OPERADOR: "Baja el volumen del micrófono 2"                   │
├─────────────────────────────────────────┬───────────────────────────────────┤
│ EN PANTALLA (62% ancho)                 │ SIGUIENTE (38% ancho)             │
│                                         │                                   │
│ ¡Cuán grande es Él!                     │ Cuando recuerdo del amor divino   │
│ ¡Cuán grande es Él!                     │ que desde el cielo al Salvador    │
│ Canta mi ser, mi Salvador, a Ti...      │ envió...                          │
│                                         │                                   │
└─────────────────────────────────────────┴───────────────────────────────────┘
```

1. **Reloj de Alta Precisión**: Hora local actualizada cada segundo.
2. **Banner de Mensajes**: Mensajes instantáneos enviados por el operador (ej. avisos de tiempo, guardería o volumen).
3. **Panel Dividido Actual vs Siguiente**: Contraste alto con letra extragrande para la diapositiva en curso y previsualización de la siguiente estrofa para anticipar el canto.

---

## 8. Arquitectura del Motor Bíblico (Fase 4)

El subsistema de la Biblia está diseñado para alto rendimiento, desacoplamiento y cero impacto en el tamaño de la base de datos principal de la aplicación:

```mermaid
graph TD
    subgraph Storage ["Almacenamiento Desacoplado (Carpeta bibles/)"]
        RVR["RVR1909.bible\n(SQLite + FTS4 + normalized_text)"]
        KJV["KJV.bible\n(SQLite + FTS4 + normalized_text)"]
        CUSTOM["Traducción_Importada.bible\n(JSON, OSIS, Zefania, USFM)"]
    end

    subgraph MainDB ["Base de Datos Principal (church_presenter.db)"]
        FAVS["bible_favorites\n(Referencias favoritas)"]
        HIST["bible_history\n(Historial de recientes)"]
        SRV["services / service_items\n(Elementos tipo 'scripture')"]
    end

    subgraph BibleEngine ["BibleService (Main Process)"]
        Parser["Bible Reference Parser\n(Resolución tolerante ES/EN)"]
        SearchMgr["Buscador FTS4 / LIKE Normalizado"]
        CacheMgr["Caché de Conexiones SQLite bajo demanda"]
        SlideGen["BibleSlideGenerator\n(División inteligente y Doble Traducción)"]
    end

    subgraph OperatorUI ["Operador (Renderer)"]
        GoToBar["Barra 'Ir a' Referencia"]
        WordSearch["Buscador de Palabras"]
        DualToggle["Selector Doble Traducción (Apilado / Lado a Lado)"]
    end

    GoToBar -->|IPC: bible:get-verses| Parser
    Parser --> CacheMgr
    CacheMgr -->|Consulta puntual| RVR
    CacheMgr -->|Consulta puntual| KJV
    SlideGen -->|Genera diapositivas formateadas| OperatorUI
    WordSearch -->|IPC: bible:search-text| SearchMgr
    SearchMgr --> RVR
```

1. **Archivos `.bible` Desacoplados**: Cada traducción reside en su propio archivo SQLite en `userData/bibles/`. La base de datos principal jamás almacena los 31.102 versículos, garantizando arranques ultrarrápidos y copias de seguridad de la base principal en milisegundos.
2. **Búsqueda Tolerante de Referencias**: Mapeo canónico de los 66 libros con soporte para español e inglés, números romanos ("I Juan" -> "1 Juan"), abreviaturas comunes ("jn", "1 co", "sal", "gén"), rangos entre capítulos y versículos ("Juan 3:16-17", "Génesis 1:1-2:3") y capítulos completos ("Salmos 23").
3. **Búsqueda Eficiente de Palabras**: Motor híbrido que aprovecha FTS4 para palabras completas y consultas sobre la columna pre-normalizada sin acentos (`normalized_text`), logrando tiempos de respuesta de menos de 1 ms sobre toda la Biblia.
4. **Doble Traducción Simultánea**: Permite proyectar dos versiones a la vez (por ejemplo RVR1909 y KJV) en modo apilado o lado a lado, con tamaños de letra adaptativos (auto-fit).
5. **Persistencia en el Culto**: Los pasajes bíblicos se pueden enviar a vivo directamente desde la pestaña de Biblia o guardarse en la lista del servicio activo como elementos de tipo `'scripture'`.

---

## 9. Arquitectura del Módulo de Medios y Presentaciones PDF (Fase 5A)

```mermaid
graph TD
    subgraph Storage ["Almacenamiento Gestionado (userData/media)"]
        VIDS["videos/ (MP4, WebM)"]
        AUDS["audios/ (MP3, WAV, AAC)"]
        PDFS["pdfs/ (Documentos PDF)"]
        THUMBS["thumbnails/"]
        HASH["Deduplicación SHA-256 en media_items"]
    end

    subgraph MainProcess ["Proceso Principal (Main)"]
        MediaSvc["MediaService\n(Validación códecs, copias, integridad)"]
        SyncClock["MasterMediaSyncService\n(Reloj maestro 200ms, transport deck, fade-out)"]
        PdfSvc["PdfService\n(Extracción metadatos y conteo de páginas)"]
    end

    subgraph OperatorRenderer ["Renderer Operador"]
        Deck["Deck de Transporte (Play/Pause/Scrubber/Trim/Audio-Role)"]
        IndAudio["Reproductor de Audio Independiente en barra superior"]
        PdfNav["Selector de Ajuste PDF (contain/cover/center) y páginas"]
        MediaLibTab["Pestaña Biblioteca de Medios"]
    end

    subgraph OutputRenderers ["Renderers de Salida"]
        OutMain["Salida Sala (main)\n(Video renderizado + Audio ACTIVO)"]
        OutLobby["Salida Lobby (lobby)\n(Video sincronizado + Audio MUTED)"]
        OutStage["Salida Escenario (stage)\n(Monitor con cronómetros: Transcurrido / Restante)"]
    end

    Deck -->|IPC: video:control| SyncClock
    IndAudio -->|IPC: audio:control-independent| SyncClock
    SyncClock -->|IPC broadcast: media:sync-tick| OutMain
    SyncClock -->|IPC broadcast: media:sync-tick| OutLobby
    SyncClock -->|IPC broadcast: media:sync-tick| OutStage
    MediaLibTab -->|IPC: media:import| MediaSvc
    MediaSvc --> HASH
    PdfNav --> OutMain
```

### Características Principales de Medios y PDF
1. **Deduplicación SHA-256**: Ningún archivo multimedia se almacena dos veces; si se detecta un hash repetido, se reutiliza el identificador existente.
2. **Reloj Maestro de Sincronización**: El proceso principal transmite pulsos de tiempo (`mediaSyncTick`) cada 200 ms. Las salidas ajustan automáticamente el tiempo solo si la deriva supera los 150 ms, evitando microtirones de audio y video.
3. **Enrutamiento Inteligente de Audio**: Solo la salida designada (`audioOutputRole`, por defecto `main`) reproduce audio por hardware; las salidas secundarias reproducen en silencio para evitar eco acústico.
4. **Pantalla de Escenario Especializada**: Durante la reproducción de video, el monitor de escenario presenta números gigantes de alto contraste indicando el tiempo transcurrido (`01:23`) y el tiempo restante (`-02:15`).
5. **Renderizado Vectorial de PDF**: Integración de `pdfjs-dist` con escalado DPR dinámico, soporte para encajar completo (`contain`), rellenar (`cover`) o centrar (`center`), y precarga en segundo plano de páginas adyacentes para una navegación sin pausas.
6. **Música Independiente de Entrada/Fondo**: Reproductor de pista de audio de fondo en la barra superior con controles de pausa, reanudación y botón de fundido de salida suave de 3 segundos (`fade-out`).
7. **Fondos de Video en Bucle**: Soporte para temas con fondos de video animados en bucle continuo y silenciado.

---

## 10. Arquitectura de Integración de PowerPoint y Conversión de Medios (Fase 5B)

```mermaid
graph TD
    subgraph PPTInput ["Entrada de Archivo PowerPoint (.pptx, .ppsx, .pptm)"]
        File[".pptx en disco"]
    end

    subgraph PowerPointEngine ["PowerPointService (Main Process)"]
        Detector["Detector de Motores\n(PowerPoint COM / LibreOffice / Manual)"]
        Parser["PowerPointParser (OpenXML)\n(Extracción de notas, animaciones, fuentes)"]
        Cache["Caché de Diapositivas\n(userData/media/powerpoint_cache/{hash}_{res})"]
        Runner["export-powerpoint.ps1\n(COM Automation en proceso aislado)"]
    end

    subgraph AudioEngine ["Enrutamiento de Dispositivos de Audio"]
        DevEnum["navigator.mediaDevices.enumerateDevices"]
        SinkVideo["setSinkId (Dispositivo Video)"]
        SinkAmbient["setSinkId (Dispositivo Música Fondo)"]
        Chime["Web Audio Oscillator Test Chime"]
    end

    subgraph OutputLayer ["Renderizado en Salidas"]
        Audience["Salida Sala / Lobby\n(Diapositiva PNG HD/4K)"]
        Stage["Salida Escenario\n(Diapositiva + Notas del Orador en tiempo real)"]
    end

    File --> Parser
    File --> Detector
    Detector -->|Motor COM disponible| Runner
    Runner --> Cache
    Parser --> Cache
    Cache --> Audience
    Cache --> Stage
    DevEnum --> SinkVideo
    DevEnum --> SinkAmbient
```

### Características Principales de PowerPoint
1. **Automatización COM Aislada**: El script `export-powerpoint.ps1` se ejecuta mediante PowerShell con políticas seguras (`-ExecutionPolicy Bypass`, `-NoProfile`, `-NonInteractive`), sin macros (`AutomationSecurity = 3`), sin ventana visible (`WithWindow: false`) y sin interferir con instancias existentes de PowerPoint abiertas por el usuario.
2. **Extracción Directa de Notas del Orador**: `PowerPointParser` lee directamente los archivos XML (`ppt/notesSlides/notesSlide*.xml`) del paquete comprimido `.pptx` y asocia cada nota a su diapositiva respectiva, proyectándola con tipografía clara en el monitor de escenario.
3. **Análisis de Fidelidad**: Avisa preventivamente al operador si una diapositiva contiene animaciones (que se proyectarán estáticas), transiciones o fuentes tipográficas ausentes en Windows.
4. **Caché Determinista por Resolución y Hash**: Evita re-exportaciones redundantes de presentaciones ya procesadas.
5. **Detección de Modificaciones y Apertura Externa**: Permite abrir la presentación en PowerPoint nativo para edición y detectar cambios externos por hash para reimportar en caliente con un clic.

---

## 11. Arquitectura del Rediseño de Interfaz del Operador (Inspirada en ProPresenter 7)

Para reducir la curva de aprendizaje del equipo de audiovisuales de la iglesia y mantener un flujo de trabajo fluido y familiar, la ventana del operador se rediseñó modularmente en React siguiendo la ergonomía y densidad visual de ProPresenter 7:

```mermaid
graph TD
    subgraph OperatorLayout ["Ventana del Operador (ProPresenter 7 Ergonomics)"]
        TopBar["TopMenuBar (Archivo, Editar, Presentación, Pantallas, Ver, Ventana, Ayuda)"]
        Toolbar["ProToolbar (Búsqueda Rápida, Modos, Pastillas de Pantallas, Botones de Acción Rápida)"]
        
        subgraph ThreeColumnLayout ["Distribución de 3 Columnas"]
            subgraph LeftCol ["Columna Izquierda (240px - 280px)"]
                LibPanel["LibraryPanel\n(BIBLIOTECA: Default, Canciones, Jóvenes, +)"]
                PlayPanel["PlaylistPanel\n(LISTA DE CULTO: Secciones plegables con color, badge En Vivo)"]
            end
            
            subgraph CenterCol ["Columna Central (Flex 1)"]
                SlideHeader["SlideHeader\n(Detalles del elemento activo, herramientas rápidas)"]
                SlideGrid["SlideGridPanel\n(Cuadrícula/Lista con miniaturas, badges de grupo, zoom)"]
                MediaDrawer["MediaDrawer (Plegable abajo)\n(Árbol de carpetas, miniaturas, duración, bucle)"]
            end
            
            subgraph RightCol ["Columna Derecha (300px - 340px)"]
                PreviewSwitcher["OutputPreviewSwitcher\n(Main / Stage / Lobby + VU meters estéreo)"]
                ClearLayers["ClearLayerButtons\n(Audio, Fondo, Diapo, Mensaje, Medios, Todo)"]
                TransportDeck["VideoTransportDeck\n(Play/Pause, barra de progreso, volumen, loop)"]
                BottomTabs["RightSidePanel Tabs\n(TEMPORIZADORES / Props / Macros)"]
            end
        end
        
        FileDrop["FileDropOverlay (Drag & Drop nativo)"]
        FileToast["FileWatcherToast (Avisos de cambio externo)"]
    end
```

### Componentes Modulares del Operador:
1. **TopMenuBar**: Barra superior oscura compacta con menús desplegables estándar de Windows y atajos de teclado asociados.
2. **ProToolbar**: Barra de herramientas con campo de búsqueda rápida (`Ctrl+K`), selector de modos (Mostrar, Editar, Biblia, Ajustes), indicadores activos de pantallas (Medios, Audiencia, Escenario) y botones de acción rápida inmediatos (Negro, Limpiar, Logo, Congelar).
3. **LibraryPanel**: Gestión de colecciones/librerías de usuario almacenadas en SQLite (`user_libraries`), permitiendo organizar elementos por ministerios o cultos y arrastrarlos directamente al servicio.
4. **PlaylistPanel**: Selector de servicios con cabeceras de sección con color configurable (p. ej., "MÚSICA", "MENSAJE", "ANUNCIOS"), reordenamiento drag-and-drop, conteo de diapositivas y distintivo "EN VIVO" en el elemento proyectado.
5. **SlideGridPanel**: Visor central de diapositivas con miniaturas de alta legibilidad, distintivos coloreados por grupo litúrgico (Verso 1, Coro, etc.), números de diapositiva ordenados, control deslizante de zoom y alternancia entre vista en cuadrícula y vista de lista.
6. **MediaDrawer**: Cajón inferior colapsable tipo ProPresenter para examinar medios de fondo y videos con árbol de carpetas, distintivos de duración y bucle, y control de zoom.
7. **RightSidePanel**:
   - **Previsualizador de Salida**: Selector de pantalla activa (`main`, `stage`, `lobby`) con vúmetros animados en verde/amarillo/rojo.
   - **Botones de Limpieza por Capas**: Acceso rápido para limpiar selectivamente `Audio`, `Fondo`, `Diapo`, `Mensaje`, `Medios` o `Todo`.
   - **Deck de Transporte de Video**: Reproducción sincronizada con reloj maestro.
   - **Pestaña de Temporizadores Activa**: Cuenta regresiva por duración (`MM:SS`), cuenta hacia una hora del día (`HH:MM`) y cronómetro progresivo con botones de Iniciar/Pausa/Reiniciar y opción de visibilidad en audiencia o escenario.
   - **Pestañas Props y Macros**: Deshabilitadas con distintivo "Próximamente" sin afectar el flujo del operador.
8. **FileDropOverlay**: Arrastrar y soltar nativo de archivos (PPTX, PDF, videos, imágenes) sobre la interfaz usando `webUtils.getPathForFile()`.
9. **FileWatcherToast**: Notificación discreta de auto-recarga cuando un archivo PPTX o de medios externo es modificado en disco, con botón "Actualizar" que preserva la posición del servicio.

---

## 12. Arquitectura de Integración de YouTube (Fase 5C)

```mermaid
graph TD
    subgraph MainProcess ["Main Process (Electron)"]
        YTSession["Session: persist:youtube\n(Sandboxed, Hardware Permissions Denied)"]
        AdBlocker["Ad-Blocker & Filter\n(webRequest.onBeforeRequest + Injected Script)"]
        YTSvc["YouTubeService\n(oEmbed Metadata & Verifier)"]
        BrowserMgr["YouTubeBrowserManager\n(Operator WebContentsView)"]
        OutputMgr["YouTubeOutputManager\n(Output WebContentsViews)"]
    end

    subgraph OperatorUI ["Renderer Operador"]
        ToolbarBtn["Modo YouTube (ProToolbar)"]
        BrowserPanel["YouTubeBrowserPanel\n(Navegación, Atajo Ctrl+Y, Proyectar este video)"]
        VerifyModal["YouTubeVerifyModal\n(Verificación Pre-Culto)"]
    end

    subgraph OutputWindows ["Ventanas de Salida"]
        OutMain["Salida Sala (main)\n(WebContentsView persist:youtube + Audio ACTIVO)"]
        OutStage["Salida Escenario (stage)\n(Cronómetros de Alto Contraste: Transcurrido / Restante)"]
        OutLobby["Salida Lobby (lobby)\n(WebContentsView persist:youtube + Audio MUTED)"]
    end

    ToolbarBtn --> BrowserMgr
    BrowserMgr --> YTSession
    YTSession --> AdBlocker
    BrowserPanel -->|Ctrl+Y / Proyectar| YTSvc
    YTSvc -->|Valida oEmbed & Disponibilidad| BrowserPanel
    BrowserPanel -->|IPC: youtube:control prepare/go-live| OutputMgr
    OutputMgr -->|Vista 1| OutMain
    OutputMgr -->|Vista 2| OutLobby
    OutputMgr -->|Sync Slide & Timers| OutStage
```

### Características de la Integración de YouTube:
1. **Aislamiento de Sesión y Persistencia**: Usa la partición de sesión dedicada `persist:youtube`. Las cookies, inicio de sesión (Google / YouTube Premium) y preferencias del usuario se almacenan en el perfil de datos local de manera segura y persistente. La aplicación jamás intercepta ni lee contraseñas.
2. **Navegación Restringida a Dominios Esenciales**: Bloqueo estricto de navegación a cualquier dominio externo a `youtube.com`, `google.com`, `accounts.google.com`, `gstatic.com`, `ytimg.com`, `googlevideo.com` y `googleusercontent.com`. Enlaces externos se derivan automáticamente al navegador del sistema operativo.
3. **Reproducción por Vistas Nativas sin Parpadeo (Opción b)**: En lugar de un iframe con almacenamiento particionado, las salidas utilizan vistas `WebContentsView` asociadas a `persist:youtube`. Durante la preparación se precargan en pausa y con visibilidad oculta; al pulsar "En vivo", se activan al instante sin recarga ni parpadeo.
4. **Enrutamiento de Audio Exclusivo**: El audio se emite exclusivamente por el rol de salida asignado (por defecto Sala), silenciando por hardware las pantallas accesorias.
5. **Verificación Pre-Culto de la Lista**: El operador dispone del botón "Verificar playlist", que comprueba en lote el estado de disponibilidad e incrustabilidad de todos los videos de YouTube del servicio antes del inicio de la reunión.
6. **Integración con Emergencias y Monitor de Escenario**: Los controles de Negro (F1), Limpiar (F2) y Congelar (F4) actúan directamente sobre la reproducción de YouTube, y el monitor de escenario presenta el título y los cronómetros de tiempo transcurrido y restante.

---

## 13. Arquitectura del Layout Flexible y Estilo Visual del Operador (v1.1)

```mermaid
graph LR
    subgraph OperatorLayout ["Distribución Flexbox Sin Superposiciones"]
        LeftCol["Columna Izquierda\n(width: 200px a 460px)\nLibraryPanel (H1) + PlaylistPanel"]
        V1["Divisor V1\n(col-resize)"]
        CenterCol["Columna Central (min-width: 0, flex: 1)\nSlideGridPanel (H2) + MediaDrawer"]
        V2["Divisor V2\n(col-resize)"]
        RightCol["Columna Derecha\n(width: 260px a 50% ventana)\nPreview 16:9 (H3) + Audio VU + Timers"]
    end

    subgraph FloatingPreviewWindow ["Ventana Flotante de Previsualización"]
        FPView["Viewport 16:9 con Controles\n(Tabs: Audience / Stage / Lobby\nToggle: Siempre Visible)"]
    end

    LeftCol --- V1
    V1 --- CenterCol
    CenterCol --- V2
    V2 --- RightCol
    RightCol -.->|Botón Ampliar / Menú Ver| FPView
```

### Principios de Maquetación y Sistema de Paneles:
1. **Contenedor Flexbox con Espacio Propio y `min-width: 0`**:
   - Cada columna (`.pro-left-column`, `.pro-center-column`, `.pro-right-panel`) cuenta con `min-width: 0`, `min-height: 0` y overflow controlado.
   - Se eliminaron posiciones absolutas o anchos fijos que antes provocaban que la columna izquierda se superpusiera sobre la zona central (evitando el corte visual "RELUDIO..." o "EPARADOR").
   - Los títulos largos se truncan limpiamente con `text-overflow: ellipsis` al final y muestran el texto completo en tooltip mediante el atributo `title`.
2. **Divisores Redimensionables y Persistencia**:
   - Divisores verticales `V1` (entre Izquierda y Centro) y `V2` (entre Centro y Derecha, permitiendo extender la columna derecha hasta el 50% del ancho de la ventana).
   - Divisores horizontales `H1` (entre Library y Playlist), `H2` (entre diapositivas y cajón de medios) y `H3` (entre previsualizador y temporizadores).
   - Doble clic en cualquier divisor restaura su tamaño estándar.
   - Las dimensiones se guardan en `localStorage` y se restauran al iniciar la aplicación. Opción en Menú Ver: "Restablecer diseño".
3. **Previsualizador Escalar y Ventana Flotante Independiente**:
   - La previsualización de la columna derecha escala de forma fluida conservando la relación de aspecto 16:9.
   - Botón "Ampliar" que abre una ventana flotante redimensionable (`/floating-preview`) con selector de rol (`Audience`, `Stage`, `Lobby`) y botón "Siempre visible".
   - **Aislamiento de Pantallas de Proyección**: La ventana flotante es estrictamente un monitor auxiliar para el operador y no se registra en `DisplayManager`, por lo que nunca aparece en la lista de pantallas ni compite por asignaciones de salida.
4. **Paleta Oscura Profesional con Variables CSS y Contraste WCAG AA**:
   - Reemplazo de tonos azul marino por fondos oscuros neutros (`--bg-base: #0A0A0A`, `--bg-surface: #121212`, `--bg-surface-raised: #181818`, `--border-color: #2A2A2A`).
   - Colores de acento configurables en Configuración -> Apariencia: Primario (`#FF7A00`), En Vivo (`#22C55E`), Vista Previa (`#2D9CFF`), Peligro (`#EF4444`).
   - Controles nativos (`select`, `input`, `button`, barras de desplazamiento delgadas, `checkbox`, `range`) estilizados bajo el tema oscuro sin fondos blancos del sistema.

---

## 14. Arquitectura del Servidor de Control Remoto, Escenario Web y Mensajería (Fase 6)

```mermaid
graph TD
    subgraph CoreServices ["Servicios del Proceso Principal"]
        RS["RemoteServer (Node.js http + ws)"]
        AUTH["RemoteAuthService (PIN, Token, Lockout)"]
        MS["MessageService (Avisos Audiencia/Escenario)"]
        SLS["StageLayoutService (Diseños de Escenario)"]
        SM["PresenterStateManager"]
    end

    subgraph WebEndpoints ["Puntos de Entrada Web (LAN)"]
        UI_REMOTE["GET / (Control Remoto Táctil)"]
        UI_STAGE["GET /stage (Monitor de Confianza)"]
        WS_CHAN["WS /ws (Canal Bidireccional)"]
    end

    subgraph OutputSurfaces ["Superficies de Salida"]
        OUT_MAIN["Salida Audiencia (Capa Mensaje)"]
        OUT_STAGE["Salida Escenario (Diseño + Banner)"]
    end

    RS --> AUTH
    RS --> MS
    RS --> SLS
    RS <--> SM

    RS --- UI_REMOTE
    RS --- UI_STAGE
    RS <--> WS_CHAN

    MS -->|Banner Superpuesto| OUT_MAIN
    MS -->|Alerta de Alto Contraste| OUT_STAGE
    SLS -->|Sincronización de Layout| OUT_STAGE
```

### Componentes Clave:
1. **`RemoteServer`**: Servidor unificado HTTP/WS en Node.js que sirve las aplicaciones web directamente en memoria y gestiona conexiones WebSocket concurrentes con latencia < 50ms.
2. **`RemoteAuthService`**: Manejo de PIN numérico de 6 dígitos, bloqueo tras 5 intentos fallidos durante 300 segundos, emisión de tokens UUID v4 criptográficos y verificación en cada acción.
3. **`StageLayoutService`**: Sistema de diseño modular para pantallas de escenario físicas y remotas (`/stage`), con elementos configurables: diapositiva actual, diapositiva siguiente, reloj, temporizadores, mensajes y notas del orador.
4. **`MessageService`**: Emisión y auto-ocultado de mensajes instantáneos dirigidos a Audiencia (banner superior/inferior), Escenario (alerta prominente de alto contraste) o ambas simultáneamente.

---

## 11. Arquitectura de Estabilidad y Operación Segura (Fase 7)

```mermaid
graph TD
    subgraph StabilitySubsystem ["Subsistema de Estabilidad y Operación Segura"]
        SRS["SessionRecoveryService\n(Snapshots continuos y detección de crash)"]
        OHS["OutputHealthService\n(Muestreo de FPS, RAM e incidentes por rol)"]
        SMS["SystemMonitorService\n(CPU, Memoria y fs.statfs para disco libre)"]
        PPS["PowerProtectionService\n(powerSaveBlocker y powerMonitor OS)"]
        EMS["EmergencyService\n(Modo de Emergencia y Safe Mode)"]
        CLS["ChecklistService\n(Verificación Pre-Culto de 9 puntos)"]
        DGS["DiagnosticsService\n(Visor de logs y exportación .ZIP)"]
        RHS["RehearsalService\n(Auditoría dedicada en Modo Ensayo)"]
    end

    subgraph OSIntegration ["Integración con Sistema Operativo Windows"]
        ScreenAPI["Electron Screen API & powerMonitor"]
        PSB["powerSaveBlocker (prevent-display-sleep)"]
        SafeStorage["Electron safeStorage (DPAPI)"]
    end

    PPS --> ScreenAPI
    PPS --> PSB
    SMS --> OSIntegration
    SRS --> SafeStorage
```

### Componentes de Estabilidad:
1. **`SessionRecoveryService`**: Registra instantáneas periódicas de sesión en disco (`session-snapshot.json`) con marca de apagado limpio. Ante un fallo eléctrico o caída del proceso, en el siguiente arranque detecta el cierre anómalo y permite reanudar el área de trabajo (lista, elemento y diapositiva en previo) garantizando que no se proyecte nada automáticamente a las salidas hasta confirmación manual del operador.
2. **`OutputHealthService`**: Registra latidos periódicos emitidos por cada ventana de salida (`main`, `stage`, `lobby`), reportando FPS reales calculados con RAF, consumo de memoria de proceso con `app.getAppMetrics()` y registro cronológico de incidentes (bajas de FPS, desconexiones, cierres inesperados y recreaciones automáticas).
3. **`SystemMonitorService`**: Monitorea de forma no bloqueante el uso de procesador CPU %, memoria RAM libre/ocupada y espacio restante en disco mediante llamadas nativas `fs.promises.statfs()`, emitiendo alertas configurables si el espacio en disco baja de 5 GB o la memoria supera el 85%.
4. **`PowerProtectionService`**: Inicia automáticamente `powerSaveBlocker.start('prevent-display-sleep')` mientras haya salidas de proyección abiertas para evitar que Windows apague los monitores o suspenda la PC. Escucha eventos del sistema operativo (`suspend`, `resume`, `unlock-screen`, `display-metrics-changed`) para pausar medios de forma segura y reconectar/reubicar automáticamente las ventanas de salida al restaurar la sesión.
5. **`EmergencyService`**: Implementa el Modo de Emergencia (botón de pánico) que con un solo clic congela la reproducción de medios y proyecta el logotipo o fondo seguro en todas las pantallas sin alterar la sesión de trabajo del operador. También gestiona la bandera `--safe-mode` al arranque para aislar y diagnosticar problemas técnicos deshabilitando YouTube, servidor remoto y vigilantes de archivos.
6. **`ChecklistService`**: Evalúa la lista de servicio abierta inspeccionando 9 áreas fundamentales (archivos de video/imagen legibles, fuentes, videos de YouTube válidos, PowerPoint actualizados frente a original, traducciones bíblicas cargadas, monitores asignados y conectados, salida de audio, espacio en disco y respaldos recientes de base de datos) asignando estados Verde/Ámbar/Rojo con acciones de corrección directa.
7. **`DiagnosticsService`**: Proporciona el visor interno de registros filtrable por severidad y búsqueda, y la generación de un paquete de diagnóstico `.zip` mediante `adm-zip` que incluye registros, especificaciones de hardware y configuración sanitizada (sin contraseñas, PINs ni tokens).
8. **`RehearsalService`**: Permite activar el Modo Ensayo con insignia visual, registrando cada cambio de diapositiva e incidente en un archivo de log dedicado (`rehearsal-<fecha>.log`) y generando un reporte final al concluir el ensayo.

---

## 16. Arquitectura de Transmisión, Grabación tipo OBS y Mezclador de Audio (Fase 9)

```mermaid
graph TD
    subgraph CaptureInputs ["Fuentes de Entrada y Captura (Etapa B)"]
        CAM["Cámaras / Capturadoras USB/HDMI\n(navigator.mediaDevices)"]
        SCREEN["Captura de Pantalla / Ventana\n(desktopCapturer.getSources)"]
        PRES_IN["Salida de Presentación Interna\n(Programa / Diapositivas / Letras)"]
        MEDIA_IN["Archivos de Video, Audio e Imágenes"]
        AUDIO_MIC["Micrófonos y Tarjetas de Audio"]
    end

    subgraph StudioEngine ["Estudio de Transmisión (Etapa C)"]
        SCENE_MGR["Gestor de Escenas Multicapa\n(4 Escenas de Fábrica + Usuario)"]
        PREV_MON["Monitor de Previo (16:9)"]
        PROG_MON["Monitor de Programa (16:9)"]
        TRANS_CTRL["Control de Transición (Corte / Fundido)"]
        AUDIO_MIXER["Mezclador Digital Web Audio API\n(AnalyserNode, Lip-Sync Delay & Limiter)"]
    end

    subgraph ObsBridgeLayer ["Puente OBS Studio (Etapa A)"]
        HTTP_SRV["RemoteServer (/outputs/*?transparent=true)"]
        OBS_WS["OBS-WebSocket Client v5\n(RFC Protocol, SHA-256 Auth & SafeStorage)"]
        OBS_STUDIO["OBS Studio Externo (Browser Sources)"]
    end

    subgraph EncodingAndOutput ["Codificación y Salida (Etapa D)"]
        FFMPEG_ENG["BroadcastEngine (Proceso FFmpeg dedicado)"]
        NVENC["Hardware Encoder: NVIDIA RTX (h264_nvenc p4)"]
        CPU_FALLBACK["Software CPU Fallback (libx264 veryfast)"]
        AAC_AUDIO["Audio Estéreo AAC (aac 192k)"]
        RTMP_OUT["Servidor RTMP / RTMPS (YouTube, Facebook, Twitch)"]
        LOCAL_REC["Grabación Simultánea en Disco (MP4 / MKV)"]
    end

    subgraph PhysicalDisplays ["Aislamiento de Salidas Físicas"]
        AUDIENCE_DISP["Proyector Audiencia (HDMI 1)"]
        STAGE_DISP["Monitor Escenario (HDMI 2)"]
    end

    CAM --> SCENE_MGR
    SCREEN --> SCENE_MGR
    PRES_IN --> SCENE_MGR
    MEDIA_IN --> SCENE_MGR
    AUDIO_MIC --> AUDIO_MIXER

    SCENE_MGR --> PREV_MON
    SCENE_MGR --> TRANS_CTRL
    TRANS_CTRL --> PROG_MON
    PROG_MON --> FFMPEG_ENG

    PRES_IN -.->|Browser Source Transparente| HTTP_SRV
    HTTP_SRV -.-> OBS_STUDIO
    OBS_WS <--> OBS_STUDIO

    AUDIO_MIXER -->|Mezcla Estéreo Sincronizada| FFMPEG_ENG
    FFMPEG_ENG --> NVENC
    FFMPEG_ENG -.->|Si no hay GPU RTX| CPU_FALLBACK
    FFMPEG_ENG --> AAC_AUDIO
    NVENC --> RTMP_OUT
    NVENC --> LOCAL_REC

    PRES_IN --> AUDIENCE_DISP
    PRES_IN --> STAGE_DISP
```

### Componentes Clave de Transmisión:
1. **`BroadcastEngine`**: Servicio del proceso principal que orquesta el ciclo de vida del subproceso `ffmpeg.exe`. Configura codificación acelerada por hardware NVIDIA RTX (`h264_nvenc`) con preset balanceado `p4` y perfil `high`, o fallback automático a `libx264` con preset `veryfast`. Maneja multiplexación de salida dual (RTMP y grabación simultánea en MP4/MKV) y parsea la salida continua de `stderr` para emitir telemetría precisa en tiempo real (bitrate kbps, FPS reales, fotogramas perdidos y duración).
2. **`ObsWebSocketService`**: Cliente para obs-websocket v5 (RFC oficial). Soporta negociación `Hello`/`Identify` con desafío criptográfico SHA-256 (`safeStorage`), reconexión automática ante caídas de OBS, cambio de escenas, inicio/parada de transmisión y grabación, e integración directa con el motor de macros (`obs_control`).
3. **Páginas de Salida para Fuente de Navegador (`/outputs/:role?transparent=true`)**: Plantillas HTML con renderizado sobre lienzo acelerado de 1080p con soporte de canal alfa transparente, superposición de props, banner de mensajes y soporte de oscurecimiento global (Blackout/Clear).
4. **Mezclador de Audio Digital con Compensación Lip-Sync**: Arquitectura basada en Web Audio API (`AudioContext`, `AnalyserNode`, `DelayNode`, `DynamicsCompressorNode`). Proporciona medición real de volumen en decibelios (RMS y picos) con animación fluida, faders de volumen independientes (0 a 150%), botones Mute individuales y compensación precisa de retardo de sincronización de labios (0 a 1000 ms por fuente).
5. **Aislamiento Total de Salidas Físicas**: Garantía arquitectónica de que la codificación de video por streaming ocurre en subprocesos independientes y nunca compite por recursos de rendering ni bloquea las ventanas de proyección en vivo para la congregación y el escenario.
6. **Cumplimiento y Aviso Legal CCLI**: Recordatorio en interfaz y documentación sobre las regulaciones y derechos de autor para transmisión de música y alabanzas por internet.


```mermaid
graph TD
    subgraph Triggers ["Fuentes de Disparo (Triggers)"]
        UI_BTN["Botón en UI (Panel Macros)"]
        KBD["Atajo de Teclado (Global/Local)"]
        SLIDE_TRG["Diapositiva (onEnter / onExit)"]
        ITEM_TRG["Elemento Playlist (onSelect)"]
        REMOTE_TRG["Control Remoto Web (Touch /ws)"]
        MIDI_TRG["Controlador MIDI (Web MIDI API)"]
        SCHED_TRG["Programador Horario (Cron / Reloj)"]
        HTTP_API["API HTTP Local (Stream Deck / Companion)"]
    end

    subgraph MacroSubsystem ["Motor de Macros y Props (Main Process)"]
        ME["MacroEngine\n(Ejecución Secuencial Aislada)"]
        PS["PropService\n(Gestor de Props en Vivo)"]
        LS["LoopService\n(Temporizador de Auto-Avance)"]
        MIDI["MidiService\n(Router & Learn Mode)"]
        DB["DatabaseService (Migración 10)\nTablas: macros, props"]
    end

    subgraph CorePresenter ["Control del Presentador"]
        SM["PresenterStateManager"]
        MS["MessageService"]
        TS["ThemeService"]
        MM["MasterMediaSyncService"]
    end

    subgraph OutputSurfaces ["Superficie de Salida (OutputApp.tsx)"]
        TRANS["Transiciones de Diapositiva (CSS Keyframes)"]
        PROP_LAYER["Capa Superior: .output-props-layer\n(Lower Thirds, Logos, Relojes)"]
    end

    UI_BTN --> ME
    KBD --> ME
    SLIDE_TRG --> ME
    ITEM_TRG --> ME
    REMOTE_TRG --> ME
    MIDI_TRG --> MIDI
    MIDI --> ME
    SCHED_TRG --> ME
    HTTP_API --> ME

    ME --> DB
    ME --> PS
    ME --> LS
    ME --> SM
    ME --> MS
    ME --> TS
    ME --> MM

    PS -->|activeProps| SM
    LS -->|nextSlide / goLive| SM
    SM -->|state-updated| OutputSurfaces
    OutputSurfaces --> TRANS
    OutputSurfaces --> PROP_LAYER
```

### Componentes de Automatización:
1. **`MacroEngine`**: Motor de ejecución secuencial en el proceso principal. Aísla cada acción con manejo de tiempos de espera (`delayMs`), límite estricto de recursión (profundidad máxima de 5 llamadas), detección de ciclos infinitos, timeout global de ejecución de 60 segundos y botón de interrupción inmediata (`stopAllMacros`). Por motivos de seguridad del templo, la ejecución de comandos del sistema operativo (`execute_command`) está estrictamente bloqueada por defecto y requiere activación explícita en configuración con advertencia.
2. **`PropService`**: Servicio de ciclo de vida de elementos superpuestos (Props). Administra capas flotantes persistentes independientes del contenido de las diapositivas (logotipos de esquina, tercios inferiores con datos de ofrenda, banners de texto, cuentas regresivas), respetando el ocultamiento con Negro (Blackout) y Limpiar (Clear). Soporta filtrado selectivo por roles de salida (`targetRoles`).
3. **`LoopService`**: Motor de automatización para presentaciones en bucle de anuncios, bienvenida o actividades semanales. Gestiona temporizadores de avance automático por diapositiva con cuenta atrás en tiempo real, reinicio continuo al finalizar la última diapositiva, modo aleatorio opcional (shuffle), pista de música de fondo sincronizada y detención suave con transición fluida.
4. **`MidiService`**: Interfaz de recepción MIDI basada en la Web MIDI API de Electron. Permite mapear eventos `noteon` y `controlchange` (CC) a macros o acciones de proyección directa. Incluye un asistente interactivo de aprendizaje ("Aprender MIDI") y panel guiado para operadores cuando no hay interfaces conectadas.
5. **Transiciones entre Diapositivas sin Parpadeo**: Implementación por CSS Keyframes en la capa de contenido (`.anim-fade`, `.anim-slide_left`, `.anim-slide_right`, `.anim-slide_up`, `.anim-slide_down`, `.anim-zoom`) con duración configurable en milisegundos, asignable por tema o por diapositiva individual, y desactivable globalmente desde la barra de herramientas para equipos con hardware modesto.

---

## 9. Fase 10: Extras y Módulos de Operación Extendida

```mermaid
graph TD
    subgraph MultiPCSync ["Sincronización Multi-PC (Offline/Local)"]
        LocalDB[(SQLite Local)] -->|exportPackage| SyncFolder["Carpeta Sincronizada / USB\n(manifest.json, songs, playlists, themes, macros)"]
        SyncFolder -->|inspectPackage| DiffEngine["Motor de Diferencias & Conflictos"]
        DiffEngine -->|mergePackage con Resolución| LocalDB
        LocalDB -->|Backup Pre-Sincronización| RollbackStore["Almacén de Respaldo Deshacer"]
    end

    subgraph SongImporters ["Importadores Multi-Formato (100% Offline)"]
        TXT[".txt (Texto Plano)"] --> Parser["SongImporterService"]
        ChordPro[".chordpro / .chopro / .crd"] --> Parser
        CSV[".csv (Lotes)"] --> Parser
        OpenLyrics[".xml (OpenLyrics)"] --> Parser
        Pro6[".pro6 (ProPresenter 6 XML+RTF)"] --> Parser
        Parser --> DuplicateDetect["Detección de Duplicados & Grupos"]
        DuplicateDetect --> SaveLib["Guardado en Biblioteca"]
    end

    subgraph SubtitlesSystem ["Subtítulos y Traducción en Vivo"]
        WebTranscriber["Transcriptor Web (/subtitles)"] -->|WebSocket /ws| SubtitleService["LiveSubtitlesService"]
        OperatorUI["Modal Operador"] -->|IPC| SubtitleService
        SubtitleService -->|activeSubtitle| StateManager["StateManager"]
        StateManager -->|state-updated| SubLayer[".output-subtitles-layer\n(Audiencia & Programa)"]
        SubtitleService -->|Silencio N seg| AutoClear["Limpieza Automática"]
    end

    subgraph CcliAndAi ["CCLI, Asistente IA & Respaldo USB"]
        LiveProjection["Proyección en Vivo"] -->|ccli_reporting_enabled| CcliLog["Registro song_usage_records"]
        CcliLog --> CcliCsv["Exportación CSV Oficial"]
        AiInput["Bosquejo / Texto / Tema"] --> HumanReview["Revisión Humana Obligatoria"]
        HumanReview --> AiEngine["AiAssistantService\n(safeStorage / Reglas Locales)"]
        AiEngine --> EditableTable["Tabla Editable de Diapositivas"]
        EditableTable --> SavePres["Guardar en Biblioteca"]
        BackupsLocal["Copias de Seguridad Locales"] --> SecBackup["SecondaryBackupService"]
        SecBackup -->|Verificación SHA-256| UsbTarget["Unidad Secundaria / USB"]
    end
```

### Componentes de la Fase 10:
1. **`LibrarySyncService`**: Motor de sincronización sin servicios de nube obligatorios. Exporta e inspecciona colecciones de datos (canciones, servicios, temas y macros) hacia cualquier carpeta elegida por el usuario. Identifica elementos nuevos, idénticos y en conflicto mediante identificadores estables y marcas de tiempo de modificación. Genera una copia de seguridad obligatoria antes de cualquier fusión para permitir deshacer (`undoSync`) de forma inmediata.
2. **`SongImporterService`**: Motor de importación 100% fuera de línea con soporte para cinco formatos estándar:
   - Texto plano (`.txt`): detección heurística de títulos, autores, estrofas (`Verso`, `Coro`, `Puente`) y separación por saltos de línea.
   - ChordPro (`.chordpro`, `.chopro`, `.crd`, `.cho`, `.pro`): eliminación de acordes entre corchetes para proyección limpia y extracción de directivas `{title:}`, `{artist:}`, `{ccli:}`.
   - CSV por lotes (`.csv`): análisis robusto con soporte para comillas multilínea y mapeo flexible de encabezados.
   - OpenLyrics XML (`.xml`): extracción estructurada de títulos, autores, etiquetas de estrofas (`v1`, `c1`, `b1`) y saltos `<br/>`.
   - ProPresenter 6 (`.pro6`): decodificación nativa de texto enriquecido RTF en base64 sin dependencias externas, eliminando caracteres de control y etiquetas binarias para producir diapositivas legibles.
3. **`CcliService`**: Registro de derechos de autor y reproducciones de canciones. Registra en SQLite cada vez que una canción se envía a la pantalla en vivo (`song_usage_records`). Incluye filtrado por rango de fechas, generación de reportes CSV conformes con las directrices de CCLI, desactivación opcional y borrado seguro del historial.
4. **`LiveSubtitlesService`**: Capa de subtítulos y traducción simultánea en vivo proyectada sobre las salidas asignadas (`.output-subtitles-layer`). Alimentada a través de WebSockets autenticados (`/ws`) y con interfaz web accesible en `/subtitles` para operadores de subtitulado remoto. Implementa temporizadores de limpieza automática tras periodos de silencio y estilos totalmente configurables (posición, fuentes, líneas máximas, colores y fundido suave).
5. **`AiAssistantService`**: Asistente de productividad para el operador, desactivado por defecto. Ofrece división inteligente de párrafos en diapositivas legibles (2 a 4 líneas), estructuración de bosquejos de sermones en puntos principales y sugerencias de lecturas bíblicas mediante un índice teológico curado local. Implementa revisión humana estricta: ninguna llamada externa se ejecuta sin confirmación previa y el resultado se presenta en una tabla editable antes de guardarse en la biblioteca. Las credenciales de API se guardan cifradas con `safeStorageService`.
6. **`SecondaryBackupService`**: Duplicación automática de copias de seguridad hacia medios extraíbles (memorias USB o discos duros externos) con verificación criptográfica SHA-256 byte a byte, garantizando la recuperación ante fallos de hardware o corrupción del disco principal.






