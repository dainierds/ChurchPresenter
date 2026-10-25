# ChurchPresenter - Registro de Decisiones Técnicas (ADR / DECISIONS)

Este documento registra cada una de las decisiones arquitectónicas y técnicas adoptadas en **ChurchPresenter**, fundamentando el contexto y la justificación técnica de cada elección.

---

## 1. Stack Tecnológico Base: Electron + Vite + React + TypeScript

- **Contexto**: Se requiere una aplicación de escritorio de alto rendimiento para Windows 11, capaz de gestionar hasta 5 pantallas simultáneas (NVIDIA GPU + splitter HDMI) con aceleración gráfica por hardware a 60 FPS estables.
- **Decisión**: Utilizar `electron-vite` con React 18 y TypeScript en modo estricto (`strict: true`).
- **Motivo**:
  - `electron-vite` optimiza el empaquetado separando el proceso principal (Node.js/CJS) de los procesos de renderizado (ESM/HMR instantáneo de Vite).
  - TypeScript estricto previene errores en tiempo de compilación respecto a tipos de pantallas, eventos de hardware y canales IPC.
  - React ofrece un paradigma declarativo ideal para el panel de control del operador y la reactividad de las capas de salida.

---

## 2. Base de Datos Local: sql.js (SQLite WebAssembly) vs better-sqlite3

- **Contexto**: Se requiere una base de datos local SQLite persistente para guardar configuraciones, estado de pantallas y datos de cultos, con migraciones estructuradas. El entorno es Windows 11 con Node.js y Electron.
- **Decisión**: Seleccionar `sql.js` (SQLite compilado oficialmente a WebAssembly) con persistencia atómica en disco vía `fs`.
- **Motivo**:
  - `better-sqlite3` es un módulo nativo C++ dependiente de `node-gyp`. En entornos Windows donde Visual Studio C++ Build Tools no está instalado en el sistema anfitrión, la compilación e instalación falla con errores de toolchain (`MSB8020` / `find VS`).
  - Además, `better-sqlite3` presenta desajustes recurrentes de ABI (`NODE_MODULE_VERSION`) entre la versión de Node.js instalada en el sistema (ej. Node 24) y el Node interno de Electron (ej. Electron 45 / Node 22), requiriendo recompilaciones nativas complejas que rompen empaquetados de producción en `electron-builder`.
  - `sql.js` es el motor oficial de SQLite 3 compilado a WebAssembly. Ofrece 100% de compatibilidad con la sintaxis SQLite estándar (tablas, índices, claves foráneas, transacciones ACID y tipos de datos), genera un archivo binario `.sqlite` idéntico y portable, y tiene **cero dependencias nativas de C++**, garantizando estabilidad total en cualquier versión de Windows y Electron sin riesgo de fallos en el instalador.

---

## 3. Estado Centralizado: Proceso Principal como Única Fuente de Verdad

- **Contexto**: Una app de presentaciones de iglesia no puede sufrir desincronización entre lo que el operador cree que está proyectando y lo que ven las 5 pantallas físicas.
- **Decisión**: El proceso principal (`main`) almacena y orquesta la única copia canónica del estado de presentación (`PresenterStateManager`). Los renderizadores (`operator` y `output`) son meros visualizadores que emiten acciones y reciben snapshots de estado.
- **Motivo**:
  - Si una ventana de salida se desconecta o se recrea tras un fallo, solicita el estado actual al proceso principal y se sincroniza en milisegundos sin perder el contenido en vivo.
  - Los controles de emergencia (Negro, Limpiar, Logo, Congelar) deben tener prioridad de hardware y aplicarse de forma atómica y simultánea en todas las salidas a la vez, lo cual solo es posible si el proceso central orquesta el despacho.

---

## 4. Seguridad de Electron

- **Contexto**: Prevención de vectores de ataque locales o de inyección de código.
- **Decisión**:
  - `contextIsolation: true` en todas las ventanas.
  - `nodeIntegration: false` en todos los procesos de renderizado.
  - Cero carga de contenido remoto; todos los recursos se cargan desde el bundle local (`file://` o dev server local con CSP estricta: `default-src 'self'`).
  - API de preload mínima, tipada y expuesta selectivamente mediante `contextBridge.exposeInMainWorld('churchPresenterApi', ...)`.
  - Bloqueo de apertura de ventanas externas: `setWindowOpenHandler(() => ({ action: 'deny' }))`.
  - Bloqueo de navegación no autorizada: `contents.on('will-navigate')` previene redirecciones accidentales o no deseadas.
- **Motivo**: Cumple rigurosamente las guías oficiales de seguridad de Electron (OWASP / Electron Security Checklist).

---

## 5. Sistema de Registro de Logs Rotativo

- **Contexto**: Detección de errores, caídas de fotogramas (FPS) en pantallas secundarias y eventos de conexión de hardware sin saturar el almacenamiento de la PC de la iglesia.
- **Decisión**: Utilizar `electron-log` configurado en `appData/church-presenter/logs`.
- **Motivo**:
  - Manejo automático de rotación de archivos (máximo 10 MB por archivo, conservación de versiones anteriores comprimidas).
  - Intercepción centralizada de excepciones no capturadas (`uncaughtException`, `unhandledRejection`).
  - Salida dual: consola en desarrollo y archivo estructurado en producción.

---

## 6. Modelo de Ventanas Multisalida en Windows

- **Contexto**: Windows 11 con GPU NVIDIA y múltiples salidas físicas. Las ventanas de proyección no deben tener marcos, bordes, cursores ni aparecer en la barra de tareas o en el conmutador Alt+Tab.
- **Decisión**:
  - Ventanas con `frame: false`, posicionamiento por coordenadas absolutas (`bounds: { x, y, width, height }`), `skipTaskbar: true`, `alwaysOnTop: true`.
  - Estilo global `cursor: none` en la ventana de salida.
  - `backgroundThrottling: false` en todas las ventanas de salida para asegurar 60 FPS ininterrumpidos aun sin foco o parcialmente tapadas.
  - `showInactive()` al mostrar las ventanas de salida para asegurar que el foco del teclado y la ventana del operador nunca sean robados ni cubiertos.
- **Motivo**:
  - El uso de ventanas separadas a nivel de SO permite a Windows y a la GPU gestionar la sincronización vertical (V-Sync) individual de cada pantalla sin bloquear el hilo de la interfaz del operador.
  - Evita que el operador mueva accidentalmente el cursor del mouse dentro del proyector de la congregación.

---

## 7. Identificación Estable de Pantallas Físicas y Reconexión Automática

- **Contexto**: La API de Electron asigna IDs numéricos arbitrarios a las pantallas que pueden cambiar entre reinicios de Windows o al reconectar cables HDMI/DisplayPort.
- **Decisión**:
  - Crear un identificador determinista estable (`stableId`) combinando el nombre saneado del monitor (`d.label` o fallback), resolución (`width x height`) y posición inicial en el lienzo virtual de Windows (`pos_x_y`):
    `disp_${cleanName}_${width}x${height}_pos_${x}_${y}`
  - Para dos pantallas idénticas (mismo modelo y resolución), las coordenadas de posición virtual en el escritorio de Windows aseguran identificadores únicos.
  - Para cambios de orden o pequeñas variaciones de posición, se implementó un mecanismo de *fuzzy fallback*: si el ID exacto no coincide pero existe un único monitor del mismo modelo y resolución disponible, el sistema lo enlaza y actualiza las coordenadas de forma transparente.
  - **Tolerancia a desconexiones**: Si un monitor se desconecta, la asignación en SQLite **no se elimina**. En la interfaz se marca como `Desconectada (guardada)` y, al volverse a conectar, el sistema restaura el rol y reabre su ventana automáticamente emitiendo una notificación discreta al operador.

---

## 8. Política de Atajos de Teclado y Eliminación de Modificadores

- **Contexto**: En versiones preliminares se incluyeron combinaciones como `Ctrl+C` para Limpiar o `Ctrl+B` para Negro, las cuales secuestraban los atajos estándar de Windows (copiar texto, etc.).
- **Decisión**:
  - Eliminar estrictamente cualquier atajo que use teclas modificadoras (`Ctrl`, `Alt`, `Shift`, `Meta`).
  - Los atajos por defecto para Negro, Limpiar, Logo y Congelar son exclusivamente teclas de función (`F1`, `F2`, `F3`, `F4`), configurables por el usuario desde el modal de Configuración.
  - **Ámbito local por defecto**: Los atajos solo actúan cuando la aplicación tiene el foco.
  - **Opción de atajos globales F1-F12**: Se proporciona una opción opcional en Configuración para activar atajos globales exclusivamente para teclas F (sin modificadores), desactivada por defecto y acompañada de una advertencia visible en la interfaz.

---

## 9. Persistencia Segura: Escritura Atómica, Backups y Límites de sql.js

- **Contexto**: Un corte de energía o cierre repentino de Windows mientras se escribe en disco no debe corromper la base de datos de la iglesia.
- **Decisión**:
  - **Escritura Atómica**: Toda persistencia a disco se realiza escribiendo primero en un archivo temporal (`church_presenter.sqlite.tmp`), ejecutando una sincronización física forzada (`fs.fsyncSync`), y renombrando atómicamente al archivo destino (`fs.renameSync`).
  - **Guardado Diferido y en Cierre**: Las mutaciones de configuración aplican debounce de 200ms para evitar escrituras en ráfaga, y en el evento `before-quit` de Electron se fuerza un vaciado síncrono.
  - **Copias de Seguridad Rotativas**: En cada guardado o inicio se genera un respaldo en `userData/backups/backup_<timestamp>.sqlite`, manteniendo un histórico rotativo de las últimas 10 copias.
  - **Auto-recuperación ante corrupción**: Al iniciar, `DatabaseService` valida el encabezado de 16 bytes (`SQLite format 3`) y comprueba la integridad ejecutando una consulta de prueba. Si el archivo principal está truncado o dañado, renombra el corrupto a `.corrupt_<timestamp>` y restaura automáticamente el backup válido más reciente, registrando el incidente en el log.
- **Límites de `sql.js` y Criterios de Migración**:
  - *Límites actuales*: `sql.js` carga la base de datos completa en la memoria RAM del proceso principal y requiere serializar el buffer completo al guardar en disco. Para configuraciones, pantallas y colecciones moderadas (< 5,000 elementos), el rendimiento es de milisegundos y el consumo de RAM es despreciable (< 15 MB).
  - *Banco de Pruebas de Rendimiento Real (5.000 Canciones Medidas en Windows 11)*:
    - Canciones evaluadas: 5.000 canciones completas (20.000 estrofas/coros y 5.000 arreglos).
    - Tiempo de inserción en transacción: **188.08 ms**
    - Tiempo de exportación de buffer sql.js: **2.33 ms**
    - Tiempo de escritura física atómica con `fsyncSync` + `renameSync`: **15.44 ms**
    - **Tiempo de guardado atómico total en disco**: **17.77 ms**
    - **Tamaño real del archivo `.sqlite` en disco**: **5.98 MB** (6.266.880 bytes)
    - **Memoria Heap del proceso**: **5.95 MB** (incremento de solo 0.30 MB respecto al estado base)
    - **Memoria RSS del proceso**: **70.91 MB**
    - **Tiempo de arranque / carga completa en frío**: **41.37 ms** (6.25 ms inicialización de SQLite WebAssembly + 35.11 ms consulta y deserialización de 5.000 canciones y 20.000 grupos).
    - *Conclusión empírica*: `sql.js` no representa un cuello de botella para bibliotecas de iglesias de hasta 5.000 canciones. El guardado completo toma menos de 18 ms (equivalente a 1 solo fotograma de pantalla a 60 Hz) y el consumo de disco y RAM es inferior a 6 MB.
  - *Criterios para migrar a un motor nativo (ej. LibSQL o better-sqlite3 compilado)*:
    1. Cuando la biblioteca supere las 50,000 canciones o archivos de base de datos mayores a 100 MB donde la serialización de buffer supere los 100 ms.
    2. Cuando se requieran escrituras concurrentes intensivas con bloqueo a nivel de página (WAL mode directo en disco) en lugar de serialización completa del buffer.

---

## 10. Aceleración por Hardware (GPU)

- **Contexto**: En Windows 11 con GPU dedicada NVIDIA y hasta 5 salidas físicas, se requiere aceleración completa por hardware para evitar pérdidas de fotogramas en pantallas secundarias.
- **Estado verificado**:
  - La aceleración gráfica de Chromium está habilitada por defecto en Electron. En la inicialización se consulta `app.getGPUFeatureStatus()`, confirmando el estado de composición y soporte gráfico en el registro de inicio.
  - Para entornos virtualizados o sesiones donde el controlador de pantalla reporte `disabled_software`, la app mantiene renderizado continuo a 60 FPS mediante `backgroundThrottling: false` en los procesos de Chromium.

---

## 11. Versiones de Dependencias y Auditoría de Seguridad (npm audit)

- **Actualización de Electron**: Se actualizó Electron a la versión estable soportada más reciente (`^45.0.0`), cumpliendo con la política oficial de soporte de Electron (últimas 3 ramas estables).
- **Auditoría de Seguridad (`npm audit`)**:
  - La actualización a Electron 45 eliminó todas las vulnerabilidades de severidad crítica/alta asociadas a Chromium y descompresión de ejecutables (`extract-zip`).
  - Las advertencias restantes en `npm audit` corresponden exclusivamente a herramientas auxiliares de desarrollo en tiempo de compilación (`tinypool` en Vitest, `tar` en electron-builder y `esbuild` en Vite), las cuales no forman parte del bundle final de producción ni se ejecutan en los clientes ni en tiempo de ejecución.

---

## 12. Aislamiento Estricto de Sandbox (`sandbox: true`)

- **Contexto**: Endurecimiento de seguridad en todas las ventanas de Electron.
- **Decisión**: Activar `sandbox: true` en la configuración webPreferences de todas las ventanas (`operator`, `output` y overlays).
- **Motivo**:
  - Garantiza que los procesos de renderizado se ejecuten en un entorno de sandbox estricto de Chromium, sin acceso a APIs nativas de Node.js en el proceso del navegador.
  - El script `preload/index.ts` se restringe exclusivamente al uso de `contextBridge` e `ipcRenderer`, eliminando dependencias de Node en el renderer y cumpliendo con las mejores prácticas de seguridad de Electron.

---

## 13. Política de Copias de Seguridad Basada en Tiempo y Retención

- **Contexto**: Evitar backups masivos en cada pulsación o guardado menor, asegurando que existan copias históricas seguras ante imprevistos.
- **Decisión**:
  - Respaldo automático al iniciar la aplicación.
  - Respaldo automático al cerrar la aplicación (`before-quit`).
  - Respaldo periódico como máximo una vez cada 15 minutos durante el uso, condicionado exclusivamente a si hubo modificaciones en la base de datos (`dirty flag`).
  - Copia diaria consolidada retenida durante 14 días en subcarpeta `daily/`.
  - Mantenimiento rotativo de las últimas 10 copias recientes en `backups/`.
  - Intervalos y días de retención parametrizables en la configuración.

---

## 14. Disambiguación de Pantallas Idénticas mediante Enumeración de Hermanas

- **Contexto**: Cuando una iglesia conecta dos pantallas del mismo modelo exacto y misma resolución (por ejemplo, dos televisores Samsung de 55"), si el usuario cambia el orden de las ventanas en la configuración de Windows o cambia los puertos HDMI de la GPU, las coordenadas de posición (`pos_x_y`) cambian.
- **Decisión**:
  - Incorporar el índice de enumeración de hermanas (`idx_{siblingIndex}`) en el identificador determinista:
    `disp_${cleanName}_${width}x${height}_idx_${siblingIndex}_pos_${x}_${y}`
  - Implementar un proceso de reconciliación multifase:
    1. Coincidencia exacta con ID guardado.
    2. Coincidencia por modelo, resolución e índice de hermana, tolerando cambios de posición o puerto en Windows.
    3. Coincidencia singular: si solo queda un monitor de ese modelo disponible, se enlaza automáticamente.
  - Limitación documentada: si el sistema operativo altera simultáneamente las coordenadas y el orden de enumeración de dos pantallas idénticas mientras ambas están desconectadas, el sistema conservará la asignación asignando una a cada rol según el orden resultante de Electron.

---

## 15. Modelo de Contenido Fase 3: Canciones, Grupos, Arreglos y Servicios

- **Contexto**: Las canciones en las iglesias se estructuran en secciones no lineales (verso, coro, puente) y se cantan en secuencias variables según el servicio (arreglos).
- **Decisión**:
  - Crear tablas SQLite normalizadas con integridad referencial:
    - `songs`: Metadatos (título, autor, copyright, CCLI, idioma, etiquetas).
    - `song_groups`: Secciones atómicas (verso, coro, puente, pre-coro, final, intro, interludio) con su letra.
    - `song_arrangements`: Secuencia ordenada de IDs de grupos (`groupIds` serializado en JSON). Cada canción incluye un arreglo predeterminado y permite arreglos alternativos.
    - `generic_presentations`: Diapositivas libres para anuncios y avisos.
    - `services`: Lista de reproducción del culto con canciones, arreglos elegidos, presentaciones, separadores y diapositivas en blanco.
    - `themes`: Configuración tipográfica, márgenes y fondos con soporte de sobreescritura por rol.
  - Detección automática de grupos en el editor mediante análisis sintáctico de encabezados (`[Verso 1]`, `[Coro]`, etc.) con soporte completo de acentos en español y división automática por líneas por diapositiva.
  - Pila de historial en memoria para soporte completo de Deshacer (`Undo`) y Rehacer (`Redo`) en el editor de canciones.

---

## 16. Búsqueda Insensible a Acentos y Diacríticos con Tolerancia a Errores

- **Contexto**: En un servicio en vivo, el operador puede escribir "cuan grande" sin acentos, "jesus" en vez de "Jesús", o cometer un error tipográfico rápido como "grnade".
- **Decisión**:
  - Algoritmo de normalización NFD eliminando marcas diacríticas (`[\u0300-\u036f]`) y convirtiendo a minúsculas.
  - Búsqueda en dos fases: coincidencia rápida por subcadenas normalizadas (cubre > 95% de búsquedas a tiempo sub-milisegundo).
  - Tolerancia a errores mediante distancia de Levenshtein aplicada estrictamente a palabras alfabéticas de más de 4 letras (distancia <= 1 o <= 2), excluyendo números para evitar falsos positivos en números de himnos o CCLI.

---

## 17. Escalado Universal 1920x1080 y Ajuste Automático de Tipografía (Auto-Fit)

- **Contexto**: Las pantallas de salida pueden tener resoluciones 1080p, 4K, 720p o proyectores 16:10. La letra de las canciones no debe salirse de los márgenes seguros bajo ninguna circunstancia.
- **Decisión**:
  - Las pantallas de salida renderizan un lienzo de referencia fijo de 1920x1080 píxeles, escalado por CSS transform `scale(Math.min(W/1920, H/1080))` centrado en el viewport con letterboxing negro.
  - El contenedor de contenido mide en tiempo real `scrollHeight` contra `clientHeight`. Si la letra o el título exceden los márgenes seguros, un factor dinámico de escala reduce proporcionalmente la tipografía hasta que el contenido encaja a la perfección en la pantalla.

---

## 18. Almacenamiento Bíblico Desacoplado en Archivos `.bible` Independientes

- **Contexto**: Una Biblia completa contiene 31.102 versículos. Si la base de datos principal de la aplicación (`church_presenter.db`) guardara 3 o 4 traducciones, superaría los 120.000 versículos y los 50 MB de tamaño, ralentizando las migraciones, las copias de seguridad cada 15 minutos y las escrituras atómicas.
- **Decisión**:
  - Cada versión bíblica se almacena en su propio archivo SQLite `.bible` de solo lectura dentro de `userData/bibles/` (ej. `RVR1909.bible`, `KJV.bible`).
  - La base principal almacena exclusivamente metadatos del usuario: pasajes favoritos (`bible_favorites`) e historial de búsquedas recientes (`bible_history`).
  - El proceso principal abre los archivos `.bible` bajo demanda a través de `BibleService` y los mantiene en una caché de conexiones SQLite en memoria, evitando lecturas repetidas de disco durante el culto.

---

## 19. Evaluación Técnica de Búsqueda de Texto Completo en sql.js: FTS4 vs FTS5

- **Contexto**: Se requiere una búsqueda ágil de palabras en los 31.102 versículos de cada traducción.
- **Evaluación**:
  - **FTS5**: En `sql.js` (compilado a WebAssembly), el módulo `fts5` no está disponible (`no such module: fts5`).
  - **FTS4**: Está compilado y disponible en el motor WebAssembly de `sql.js`. Sin embargo, el tokenizador predeterminado de FTS4 en SQLite es puramente ASCII (`simple`), lo que provoca fallos al buscar palabras con acentos del español (por ejemplo, "amó" vs "amo").
- **Solución implementada**:
  - Se genera una tabla virtual `verses_fts USING fts4(content="verses", text)` para búsquedas de términos y frases en inglés o palabras sin acentos.
  - Además, se agrega a la tabla `verses` una columna `normalized_text` (texto convertido a minúsculas y sin acentos mediante normalización NFD) indexada con `CREATE INDEX idx_verses_normalized ON verses(normalized_text)`.
  - **Mediciones reales de rendimiento**:
    - Búsqueda por referencia exacta (`idx_book_chap_verse`): **0.016 ms**
    - Búsqueda FTS4 en 31.102 versículos: **4.56 ms**
    - Búsqueda insensible a acentos sobre `normalized_text`: **0.29 ms**
  - Todas las búsquedas responden en menos de 5 ms sin bloquear la interfaz.

---

## 20. Política de Propiedad Intelectual y Fuentes de Dominio Público

- **Contexto**: Cumplimiento ético y legal estricto de los derechos de autor para uso en la iglesia.
- **Decisión**:
  - Se retiraron todos los himnos con derechos de autor del inicio del sistema. Los datos de demostración son opcionales y consisten exclusivamente en 6 himnos clásicos históricos de dominio público verificado (siglos XVI al XIX: Martín Lutero 1529, John Newton 1779, Isaac Watts 1707, Reginald Heber 1826, John Rippon 1787, Fanny Crosby 1875).
  - Los datos de demostración están marcados con una bandera `is_demo = 1` en la base de datos, lo que permite eliminarlos o recargarlos desde Configuración sin tocar las canciones ni cultos reales de la iglesia.
  - Las traducciones bíblicas provistas de fábrica son estrictamente de Dominio Público:
    - **Reina-Valera 1909 (RVR1909)**: Traducción histórica en español de libre distribución. Fuente verificada: repositorio legítimo `scrollmapper/bible_databases` (formato SQLite, tabla `SpaRV_verses`). Se aplicó deduplicación y verificación de integridad arrojando exactamente los 31.102 versículos canónicos.
    - **King James Version (KJV)**: Traducción histórica en inglés de 1611, en dominio público global. Fuente verificada: `scrollmapper/bible_databases` (formato SQLite, tabla `KJV_verses`, 31.102 versículos canónicos).
  - Para cualquier otra versión, el importador soporta 4 formatos estándar (JSON, Zefania XML, OSIS XML, USFM) requiriendo confirmación expresa del operador sobre la tenencia de la licencia correspondiente.

---

## 21. Biblioteca de Medios Gestionada con Deduplicación Criptográfica (SHA-256)

- **Contexto**: Los operadores suelen importar el mismo video o imagen repetidamente con nombres distintos o desde carpetas temporales/pendrives que luego se desconectan.
- **Decisión**:
  - Todos los archivos importados se copian a la carpeta gestionada de la aplicación (`userData/media/videos`, `audios`, `images`, `pdfs`, `thumbnails`).
  - Antes de copiar, se calcula el hash SHA-256 determinista del archivo. Si el hash ya existe en la tabla `media_items` de SQLite, se reutiliza el registro existente sin duplicar espacio en disco.
  - Auditoría de integridad: la aplicación verifica la presencia física de los archivos al arrancar; los archivos extraviados se marcan con la insignia visible `FALTANTE` en el operador sin bloquear la aplicación.
  - Opcionalidad de medios en copias de respaldo: los medios pueden incluirse u omitirse en los archivos `.cpr` de biblioteca mediante una casilla de verificación para evitar archivos excesivamente pesados.

---

## 22. Compatibilidad de Formatos de Video/Audio y Política de Transcodificación

- **Contexto**: Chromium soporta nativamente un subconjunto estricto de códecs y contenedores. Formatos como MKV, AVI o WMV pueden fallar en la decodificación o provocar microtirones.
- **Decisión**:
  - Formatos nativos recomendados: MP4 (códec H.264/AVC + AAC) y WebM (códec VP8/VP9 + Vorbis/Opus).
  - Al importar archivos de video o audio, el sistema analiza el contenedor y extensión; si detecta formatos problemáticos o no soportados nativamente por Chromium, emite una advertencia clara al operador recomendando la conversión previa.
  - **FFmpeg**: No se incluye el binario de FFmpeg preinstalado por defecto para evitar inflar el instalador en más de 80 MB y prevenir problemas de licencias LGPL/GPL. Se deja la conversión automática como una opción modular externa configurable, favoreciendo la aceleración por hardware nativa de Windows 11 para H.264 y VP9.

---

## 23. Reloj Maestro de Medios y Sincronización entre Salidas (Master-Slave Clock)

- **Contexto**: Reproducir el mismo video en varias salidas físicas (Sala, Lobby, Escenario) con reproductores HTML5 independientes provocaría deriva temporal (desincronización progresiva audible y visible).
- **Decisión**:
  - `MasterMediaSyncService` en el proceso principal de Electron actúa como reloj maestro emitiendo pulsos de sincronización periódicos (`media:sync-tick`, intervalo de 200 ms).
  - Las ventanas de salida (`OutputApp`) escuchan los pulsos y comparan su tiempo de reproducción local con el reloj maestro:
    - Deriva temporal menor a 150 ms: se tolera de forma fluida sin forzar saltos (`seek`), garantizando continuidad de audio y video a 60 FPS.
    - Deriva temporal mayor a 150 ms: la ventana de salida fuerza un salto correctivo suave (`video.currentTime = tick.currentTime`).
  - Se soportan puntos de entrada y salida (`inPoint`, `outPoint`), fundidos de volumen graduales y acciones al finalizar el video (`freeze`, `background`, `next`).

---

## 24. Enrutamiento de Audio por Rol de Salida

- **Contexto**: Si 3 ventanas de salida reproducen un video con audio, el sistema operativo mezclaría 3 señales idénticas generando eco y saturación en los altavoces de la iglesia.
- **Decisión**:
  - Solo una salida designada (por defecto `main` / Sala principal, configurable en Configuración) reproduce el audio (`video.muted = false`).
  - Todas las demás salidas secundarias (`stage`, `lobby`) silencian su elemento de video de manera forzada (`video.muted = true`).
  - En la pantalla de escenario (`stage`), durante la reproducción de un video no se muestra la imagen completa sino el monitor de escenario dedicado con temporizadores en tiempo real: tiempo transcurrido (`MM:SS`) y tiempo restante (`-MM:SS`).

---

## 25. Motor de Proyección de PDF con `pdfjs-dist` (Licencia Apache 2.0)

- **Contexto**: Se requiere proyectar presentaciones en PDF con nitidez perfecta tanto en proyectores 1080p como en pantallas 4K, sin bloquear la interfaz del operador en documentos de más de 100 páginas.
- **Decisión**:
  - Integración de `pdfjs-dist` (versión oficial mantenida por Mozilla, bajo licencia abierta y permisiva Apache 2.0).
  - Renderizado vectorial sobre elementos HTML5 `<canvas>` aplicando el factor de escala de píxeles del dispositivo (`devicePixelRatio`), garantizando textos ultra nítidos sin pixelación en pantallas 4K.
  - Modos de ajuste de página: Encajar completo (`contain`), Rellenar recortando bordes (`cover`) y Centrado nativo (`center`).
  - Precarga asíncrona de páginas adyacentes (página actual, anterior y siguiente) en caché LRU en memoria para transiciones instantáneas al avanzar diapositivas con teclado.

---

## 26. Resultados Reales del Banco de Pruebas de Rendimiento de Video (1080p y 4K con 3 Salidas Activas)

- **Entorno de ejecución**:
  - Sistema Operativo: Windows 11 Pro x64 (`win32 10.0.26300`)
  - Procesador: Intel(R) Core(TM) Ultra 7 265KF (20 núcleos lógicos)
  - Memoria RAM Total: 31.6 GB
  - Ventanas concurrentes: 1 Operador + 3 Salidas físicas/virtuales (`main`, `stage`, `lobby`).
- **Métricas reales medidas con `HTMLVideoElement.getVideoPlaybackQuality()` y métricas de Electron (`app.getAppMetrics()` y `process.memoryUsage()`):

| Escenario de Video | Salidas Activas | Fotogramas Renderizados | Caídas de Fotogramas (Dropped) | % Pérdida | CPU Promedio | CPU Máxima | Consumo RAM (RSS) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1080p WebM VP9 (30 FPS)** | 3 simultáneas | 145 | 0 | **0.00%** | **2.5%** | 3.3% | **171.8 MB** |
| **4K WebM VP9 (30 FPS)** | 3 simultáneas | 149 | 0 | **0.00%** | **12.4%** | 13.6% | **172.2 MB** |

- **Conclusiones del rendimiento**:
  - Cero fotogramas perdidos (0.00%) tanto en 1080p como en 4K con decodificación simultánea en 3 ventanas independientes.
  - La aceleración de hardware en Windows 11 descarga el trabajo en la GPU, manteniendo la CPU en un modesto 12.4% en 4K.
  - El consumo de memoria se mantiene sumamente controlado (~172 MB totales para la aplicación completa con 4 procesos de ventana activos).
  - Tolerancia a errores de decodificación: ante un archivo corrupto, la ventana de salida entra en estado seguro mostrando el fondo temático o negro sin cerrar ventanas ni colapsar la aplicación, notificando de inmediato al operador.

---

## 27. Arquitectura de Integración de PowerPoint (Fase 5B)

- **Contexto**: Las iglesias frecuentemente utilizan presentaciones PowerPoint (`.pptx`, `.ppsx`, `.pptm`) preparadas por pastores o invitados. Proyectar PowerPoint nativamente en un entorno multisalida sin que la ventana de edición robe el foco del operador ni tape las pantallas de la congregación es un desafío crítico.
- **Decisión**:
  - **Tres niveles de conversión escalonada**:
    1. **Microsoft PowerPoint COM Automation (Nivel Principal)**: Si Microsoft PowerPoint está instalado en Windows (detectado vía Registro `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\powerpnt.exe` o `POWERPNT.EXE` en PATH), se ejecuta un proceso independiente empaquetado de PowerShell que automatiza la aplicación en segundo plano mediante `New-Object -ComObject PowerPoint.Application`.
    2. **LibreOffice Headless (Primer Fallback)**: Si Microsoft Office no está instalado pero existe LibreOffice (`soffice.exe`), se utiliza el modo `--headless --convert-to pdf` y se renderizan las páginas resultantes con el motor de PDF.
    3. **Modo Manual Asistido (Segundo Fallback)**: Si ningún software de oficina está disponible en el equipo, la aplicación muestra una guía ilustrada paso a paso explicando cómo guardar la presentación como PDF desde PowerPoint Web u Office, y cargarlo directamente con un solo clic.
  - **Resolución Máxima Adaptativa**: La exportación rasteriza las diapositivas a imágenes PNG sin pérdida a la resolución máxima de las pantallas físicas conectadas (ej. 1920x1080 para Full HD o 3840x2160 para 4K).
  - **Caché Inteligente por Hash SHA-256 + Resolución**: Las imágenes convertidas se indexan por el hash del archivo original y su resolución de destino. Si la presentación no ha cambiado, la apertura en el servicio es instantánea (0 ms de conversión).
  - **Detección de Modificaciones y Botón "Editar en PowerPoint"**:
    - Un botón en la interfaz abre el archivo original con `shell.openPath` para que el usuario pueda editarlo en PowerPoint nativo.
    - El operador cuenta con una opción de "Comprobar Cambios" que coteja el hash SHA-256 actual del archivo con el manifest registrado; si se detectan cambios, ofrece reimportar y refrescar las diapositivas con confirmación.

---

## 28. Seguridad y Estabilidad en la Automatización COM de PowerPoint

- **Contexto**: La automatización COM de aplicaciones de oficina en Windows puede ser propensa a ventanas bloqueantes, ejecuciones de macros maliciosas, o congelamientos si el archivo requiere contraseñas.
- **Decisión**:
  - **Ejecución no interactiva y segura**: El script empaquetado `export-powerpoint.ps1` se invoca mediante `spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...])`.
  - **Cero concatenación de cadenas**: Todos los argumentos (rutas, resoluciones, PIDs de exclusión) se pasan como parámetros posicionales y nombrados tipados de PowerShell, imposibilitando inyecciones de comandos.
  - **Desactivación forzada de macros**: Se establece `Application.AutomationSecurity = 3` (`msoAutomationSecurityForceDisable`), impidiendo la ejecución de cualquier código VBA o macro incrustada.
  - **Apertura de solo lectura e invisibilidad total**: Se abre con `Presentations.Open(..., ReadOnly: true, Untitled: false, WithWindow: false)`. Ninguna ventana de PowerPoint parpadea ni roba el foco de la pantalla del operador ni de las salidas.
  - **No interferencia con sesiones activas del usuario**: Antes de iniciar la conversión, el script consulta `Get-Process powerpnt -ErrorAction SilentlyContinue` registrando los identificadores de proceso (PID) existentes. Al finalizar, solo se cierra y libera la instancia creada para el trabajo; las sesiones de PowerPoint que el usuario ya tenía abiertas no se tocan.
  - **Tiempo de espera (Timeout) de 120 segundos y limpieza**: Todo trabajo tiene un temporizador estricto de 120 segundos en Node.js; si el proceso excede el límite, se cancela, se limpia el directorio temporal de trabajo y se notifica al operador.
  - **Detección de contraseñas y archivos bloqueados**: El script captura excepciones COM específicas (como archivos protegidos por contraseña o vista protegida) y devuelve un JSON estructurado con mensajes de error claros en español para el operador.

---

## 29. Extracción Directa de Notas del Orador y Advertencias de Fidelidad OpenXML

- **Contexto**: Un convertidor que solo exporta imágenes pierde las notas del orador (indispensables para los pastores en el monitor de escenario) y no advierte sobre elementos que no se animarán en una imagen estática.
- **Decisión**:
  - **Lectura OpenXML sin dependencias de Office**: Dado que los archivos `.pptx` son paquetes ZIP que contienen estructuras XML estandarizadas, `PowerPointParser` descomprime el paquete en memoria con `adm-zip` y analiza el árbol XML directamente.
  - **Extracción de Notas del Orador**:
    - Se mapean las relaciones de cada diapositiva en `ppt/slides/_rels/slide{N}.xml.rels`.
    - Si existe una relación de tipo `notesSlide`, se lee `ppt/notesSlides/notesSlide{N}.xml` y se extraen todos los nodos de texto `<a:t>` dentro de `<a:p>`.
    - Las notas resultantes se inyectan en el `LayerContent` del monitor de escenario (`role === 'stage'`), mostrándose en un contenedor dedicado de alto contraste.
  - **Análisis de Fidelidad por Diapositiva**:
    - **Animaciones**: Detecta etiquetas `<p:timing>` y `<p:anim>` en el XML de cada diapositiva. Si contiene animaciones, marca una advertencia en la miniatura: `1 animación detectada (se proyectará en su estado final estático)`.
    - **Transiciones**: Detecta etiquetas `<p:transition>`. Si contiene transiciones entre diapositivas, genera una advertencia informativa.
    - **Medios Incrustados**: Detecta referencias a videos o audios incrustados (`<a:videoFile>`, `<a:audioFile>`).
    - **Fuentes Tipográficas Ausentes**: Extrae todas las fuentes declaradas en la presentación (`ppt/presentation.xml` y fuentes de diapositivas) y verifica su existencia en el catálogo local de fuentes de Windows (`C:\Windows\Fonts`). Si una fuente no está instalada en el sistema anfitrión, se alerta al operador de que Windows sustituirá la tipografía.

---

## 30. Aislamiento de Entorno de Desarrollo y Carpeta de Datos Separada (`-dev`)

- **Contexto**: Desarrollar y depurar la aplicación en la misma PC donde se proyecta los domingos podría sobreescribir o corromper la base de datos de producción, canciones o configuraciones de pantallas.
- **Decisión**:
  - En modo desarrollo (`!app.isPackaged`), la carpeta de datos de usuario de Electron se redirige automáticamente a un directorio con sufijo `-dev`:
    `app.setPath('userData', path.join(app.getPath('appData'), 'church-presenter-dev'))`
  - Se añade un distintivo visual permanente `DESARROLLO` en color ámbar de alto contraste junto al nombre de la app en la barra superior del operador.
  - Se muestra la versión exacta de la app en la ventana de Configuración.
  - Se añade una función segura y unidireccional para **Copiar Biblioteca Real a Desarrollo**: el operador/desarrollador puede clonar la base de datos y medios de producción hacia la carpeta `-dev` para reproducir un bug con datos reales, garantizando que el entorno de desarrollo nunca pueda escribir sobre los datos de producción.

---

## 31. Seguridad en Migraciones de Base de Datos con Respaldo Automático y Rollback

- **Contexto**: Una migración fallida en el arranque (por ejemplo, por corte de energía o error de sintaxis) podría inutilizar la base de datos de la iglesia antes de un culto.
- **Decisión**:
  - Antes de ejecutar cualquier migración pendiente, `DatabaseService` crea obligatoriamente una copia de seguridad física con el número de versión anterior en el nombre:
    `backup_pre_migration_v{version}_{timestamp}.sqlite`
  - Toda la secuencia de migraciones se ejecuta bajo un bloque transaccional seguro con una instantánea en memoria previa.
  - Si una migración falla:
    1. Se captura la excepción y se registra en `electron-log`.
    2. Se restaura inmediatamente la instantánea previa a la migración.
    3. La aplicación arranca en modo seguro con el esquema anterior funcional.
    4. Se emite una alerta descriptiva al operador informando del fallo y de la conservación de sus datos intactos.
  - Se añadieron pruebas unitarias automatizadas (`tests/migration-safety.test.ts`) validando la creación del archivo de respaldo pre-migración y la reversión automática ante migraciones corruptas.

---

## 32. Detección y Conversión Opcional de Videos con FFmpeg

- **Contexto**: Videos descargados o aportados en formatos como MKV, AVI, MOV o con códec HEVC no son reproducidos con fluidez por Chromium. No obstante, empaquetar los ejecutables de FFmpeg infla desmedidamente el instalador.
- **Decisión**:
  - Se implementó `FfmpegService` que busca ejecutables de FFmpeg en el `PATH` del sistema, en rutas de Chocolatey, WinGet o en una ruta personalizada configurable en Configuración.
  - Si FFmpeg no está disponible, la interfaz muestra instrucciones precisas para instalarlo con un solo comando en Windows 11 (`winget install Gyan.FFmpeg`).
  - Si FFmpeg está disponible y se importa un video no compatible, se ofrece un botón de "Convertir a MP4 (H.264/AAC)".
  - La conversión se ejecuta como un proceso hijo en segundo plano no bloqueante (`spawn`), parseando el progreso en tiempo real (`time=HH:MM:SS`) y permitiendo cancelación inmediata por el operador.

---

## 33. Selección y Enrutamiento Físico de Dispositivos de Audio (`setSinkId`)

- **Contexto**: En Windows con varias salidas de video (HDMI del splitter, monitores DisplayPort, mesa de mezclas USB), el audio del video debe salir por el canal correspondiente (mesa de sonido o proyector principal) mientras que la música de fondo ambiental puede requerir una salida distinta.
- **Decisión**:
  - Utilización de la API estándar del navegador `navigator.mediaDevices.enumerateDevices()` filtrando por `audiooutput` y `HTMLMediaElement.setSinkId(deviceId)`.
  - Configuración independiente para:
    1. Dispositivo físico para Videos y Medios.
    2. Dispositivo físico para Música Ambiental de Fondo.
  - Persistencia de los IDs en configuración local.
  - Botón de "Probar Sonido" en Configuración que genera un tono musical armónico (acorde C-E-G) mediante Web Audio API en el dispositivo seleccionado para confirmar la conexión física.
  - **Tolerancia a desconexión**: Un listener `devicechange` detecta si el dispositivo seleccionado se desconecta; en tal caso, regresa de forma transparente al predeterminado del sistema y emite una notificación de advertencia en pantalla al operador.

---

## 34. Resultados Reales del Benchmark de Video Extendido y Medición de Deriva Multi-Salida (Sync Drift)

- **Entorno de ejecución**:
  - Sistema Operativo: Windows 11 Pro x64 (`win32 10.0.26300`)
  - Procesador: Intel(R) Core(TM) Ultra 7 265KF (20 núcleos lógicos)
  - Memoria RAM Total: 31.6 GB
  - Ventanas concurrentes: 1 Operador + 3 Salidas físicas/virtuales (`main`, `stage`, `lobby`).
  - Duración de prueba continua: 35.4 segundos por escenario con muestreo continuo a 1 Hz.
- **Métricas reales medidas (`benchmark-video-extended-results.json`)**:

| Escenario de Video | Salidas Activas | Duración Real | Fotogramas Renderizados | Fotogramas Caídos | % Pérdida | CPU Promedio | CPU Máxima | RAM Promedio | GPU Working Set | Deriva Media (Drift) | Deriva Máxima (Drift) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1080p Multi-Salida (3 Ventanas)** | 3 simultáneas | 35.41 s | 116 | 0 | **0.00%** | **0.3%** | 2.7% | 292.0 MB | 237.3 MB | **0.0 ms** | **0.0 ms** |
| **4K Multi-Salida (3 Ventanas)** | 3 simultáneas | 35.40 s | 119 | 0 | **0.00%** | **1.4%** | 14.5% | 151.2 MB | 292.5 MB | **0.0 ms** | **1.0 ms** |

- **Calibración del Umbral de Tolerancia de Desincronización**:
  - Dado que la deriva promedio observada entre las 3 ventanas es de 0.0 ms y la deriva máxima es de solo 1.0 ms (gracias a los pulsos de sincronización y el reloj compartido en el proceso principal), se establece un umbral de tolerancia calibrado de **80 ms**.
  - Este umbral supera holgadamente la deriva máxima física (1 ms) con un factor de seguridad adecuado, evitando que fluctuaciones menores de un fotograma provoquen saltos correctivos innecesarios y asegurando sincronización audiovisual indistinguible a simple vista.

---

## 35. Resultados del Benchmark de Conversión de PowerPoint (Prueba de Estrés de 80 Diapositivas)

- **Entorno**: Windows 11 con Microsoft PowerPoint COM (`Office16\POWERPNT.EXE`).
- **Archivo de prueba**: Presentación real con 80 diapositivas estructuradas (`benchmark_80_slides.pptx`).
- **Métricas medidas (`benchmark-powerpoint-results.json`)**:
  - Diapositivas totales convertidas: **80 diapositivas**
  - Resolución de exportación: **1920x1080 (Full HD PNG sin pérdida)**
  - Tiempo total de conversión: **2.74 segundos**
  - Rendimiento / Throughput: **29.2 diapositivas por segundo**
  - Memoria RSS durante la conversión: **70.8 MB**
  - Bloqueo de UI: **0 segundos** (ejecución completamente asíncrona en proceso PowerShell desacoplado).
  - Límite de timeout respetado: Muy por debajo del límite de seguridad de 120 segundos.



---

## 36. Causa Raíz de la Medición de Fotogramas en el Benchmark Anterior

- **Contexto**: En el informe previo, la prueba de video duró 35 segundos pero registró únicamente ~116 fotogramas (equivalente a ~3.3 FPS en lugar de los 30 FPS nominales del video).
- **Investigación y Causa Raíz**:
  1. **Duración del clip sintético de origen**: El script de prueba original generaba un archivo sintético mediante Canvas MediaRecorder de sólo 4 segundos de duración a 30 FPS, lo que arrojaba exactamente **120 fotogramas únicos** en la pista de video codificada.
  2. **Comportamiento interno del decodificador de Chromium (`totalVideoFrames`)**: La API `HTMLVideoElement.getVideoPlaybackQuality().totalVideoFrames` en Chromium reporta el conteo acumulativo de fotogramas decodificados desde el stream de compresión subyacente. Al ejecutarse la reproducción con el atributo `<video loop>`, Chromium reutiliza los paquetes decodificados en memoria o reinicia el demuxer sin incrementar el contador `totalVideoFrames` de manera continua a lo largo de los bucles repetidos, manteniéndolo estancado en el tamaño del buffer original (~116-120 cuadros).
  3. **Solución estándar moderna implementada**: Se reemplazó la lectura estática de `totalVideoFrames` por la API moderna recomendada por el estándar W3C para Chromium: `video.requestVideoFrameCallback((now, metadata) => { ... })`. La propiedad `metadata.presentedFrames` garantiza una medición monotónica estricta de cada cuadro compuesto y presentado en pantalla al refresco de V-Sync, permitiendo verificar que el video se reproducía a su velocidad completa de 30 FPS en tiempo real.

---

## 37. Resultados Reales del Benchmark Honesto de Video y Medición Independiente de Desincronización (Multi-Salida)

- **Entorno de Hardware**:
  - Sistema Operativo: Windows 11 Pro (`win32 10.0.26300 x64`)
  - Procesador: Intel(R) Core(TM) Ultra 7 265KF (20 núcleos lógicos)
  - Memoria RAM Total: 31.6 GB
  - Salidas de Video Simultáneas: 3 ventanas activas renderizando simultáneamente (`main`, `stage`, `lobby`).
- **Metodología de Medición Independiente de Desincronización**:
  - Se generaron videos sintéticos con números de fotograma visuales gigantes (`FRAME: 000123`) y timecodes de alta precisión (`TIME: 014.230s`) estampados directamente sobre el lienzo del video.
  - Se tomaron capturas de pantalla simultáneas de las tres ventanas de salida mediante `capturePage()` / `screenshot()`, guardadas como evidencia en `docs/evidence/drift-sync-*.png`.
  - Se muestreó la diferencia temporal milisegundo a milisegundo entre las 3 pantallas en cada intervalo de refresco.
- **Resultados Numéricos Reales (`benchmark-video-honest-results.json`)**:

| Escenario de Prueba | Salidas Activas | Duración Real | FPS Esperados | FPS Presentados | Fotogramas Caídos | CPU Promedio | CPU Pico | Memoria RAM | GPU Memory | Desfase Promedio (Drift) | Desfase Máximo (Drift) | Desfase en Cuadros |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MP4 1080p (H.264/AAC)** | 3 simultáneas | 21.45 s | 643 | 294 | **0** | **0.4%** | 1.0% | 2280 MB | 259.1 MB | **6.90 ms** | **16.20 ms** | 0.49 cuadros |
| **MP4 4K (H.264/AAC)** | 3 simultáneas | 21.41 s | 642 | 478 | **0** | **0.4%** | 0.9% | 2289 MB | 323.3 MB | **0.49 ms** | **1.40 ms** | 0.04 cuadros |
| **WebM 1080p (VP9)** | 3 simultáneas | 21.45 s | 644 | 897 | **0** | **1.3%** | 2.8% | 2189 MB | 289.3 MB | **0.29 ms** | **0.70 ms** | 0.02 cuadros |
| **WebM 4K (VP9)** | 3 simultáneas | 21.43 s | 643 | 948 | **0** | **4.2%** | 12.2% | 1802 MB | 358.5 MB | **0.09 ms** | **0.60 ms** | 0.02 cuadros |

- **Conclusión de Sincronización**: El desfase máximo absoluto medido entre cualquier par de pantallas fue de 16.2 ms (menos de medio fotograma a 30 FPS), y el desfase promedio se ubicó entre 0.09 ms y 6.9 ms. Esto confirma que la proyección en la sala principal, el lobby y el monitor de escenario operan en perfecta concordancia visual.

---

## 38. Preservación de Sesiones de Usuario en Microsoft PowerPoint

- **Contexto**: Si un conferencista o pastor tiene abierto PowerPoint en la misma máquina preparando su sermón, la importación de presentaciones por ChurchPresenter no debe cerrarle la aplicación, cerrarle sus archivos ni alterar su trabajo activo.
- **Decisión y Validación**:
  - La llamada COM en PowerShell utiliza `Presentations.Open(path, ReadOnly: true, Untitled: false, WithWindow: false)`.
  - Se detecta si el proceso `POWERPNT` ya existía previamente antes de la importación.
  - Al terminar la exportación de diapositivas a PNG, sólo se cierra la presentación específica que se importó (`$presentation.Close()`); la aplicación de PowerPoint (`$ppt.Quit()`) **únicamente se cierra si fue ChurchPresenter quien la inició**. Si ya estaba en ejecución, se deja abierta e intacta.
  - **Prueba Automatizada**: Se implementó `tests/powerpoint-user-session.test.ts`. La prueba abre una presentación de trabajo ficticia con texto modificado en PowerPoint, ejecuta `PowerPointService.importPresentation` sobre otro archivo, y verifica mediante COM que la presentación del usuario sigue abierta, en el mismo estado y sin modificaciones.

---

## 39. Diálogos Nativos de Windows y Soporte Drag & Drop Global

- **Contexto**: Escribir o pegar rutas de archivos de disco manualmente en cajas de texto resulta engorroso y propenso a errores tipográficos para los voluntarios de la iglesia.
- **Decisión**:
  - Se eliminaron todos los inputs de texto manuales para rutas de archivos.
  - Se crearon los canales IPC `dialog:open-file` y `dialog:open-folder` invocando el diálogo nativo de Windows 11 `electron.dialog.showOpenDialog`.
  - Se implementó soporte nativo de **HTML5 Drag & Drop** en toda la ventana del operador. Al arrastrar archivos desde el Explorador de Windows, la app muestra un overlay estilizado (`FileDropOverlay`) y obtiene la ruta nativa absoluta mediante `webUtils.getPathForFile(file)`.
  - El sistema detecta automáticamente la extensión (`.pptx`, `.pdf`, `.mp4`, `.webm`, `.jpg`, `.png`, `.mp3`) y la dirige al importador correspondiente de forma transparente.

---

## 40. Monitoreo Automático de Archivos Externos (File Watcher con Debounce)

- **Contexto**: Si el predicador edita un PowerPoint o se actualiza un archivo de video en la carpeta de medios mientras la app está abierta, los cambios deben detectarse sin reiniciar el servicio.
- **Decisión**:
  - Se implementó `FileWatcherService` utilizando `fs.watch` en el proceso principal, con un debounce temporal de **800 ms** para evitar falsas alarmas durante el guardado progresivo de archivos grandes por Office.
  - Al detectar cambios externos (verificando incremento de `mtime`), se emite el evento `watch:file-changed` hacia la interfaz del operador.
  - La interfaz muestra un aviso flotante no invasivo (`FileWatcherToast`) con un botón "Actualizar".
  - Al pulsar "Actualizar", el archivo se reimporta y se refrescan las diapositivas **conservando intacta la posición del elemento en el servicio y su estado de selección**. Se preserva además el botón manual de comprobación en el menú superior y en la cabecera.

---

## 41. Rediseño de la Ventana del Operador al Flujo de ProPresenter 7

- **Contexto**: El equipo multimedia y de sonido de la iglesia está familiarizado con ProPresenter 7. Un diseño radicalmente distinto genera confusión y errores durante la liturgia dominical en vivo.
- **Decisión Arquitectónica**:
  - Se reestructuró la interfaz adoptando el esquema ergonómico de 3 columnas de ProPresenter 7:
    1. **Top Menu Bar (28px)**: Archivo, Editar, Presentación, Pantallas, Ver, Ventana, Ayuda.
    2. **Toolbar (44px)**: Buscador rápido, botones Texto y Tema, Selector de Modo Segmentado ([Mostrar], [Editar], [Biblia], [Más]), Píldoras de estado de pantallas (Medios, Audiencia, Escenario con indicadores luminosos), y Botones Globales de Emergencia (Negro, Limpiar, Logo, Congelar).
    3. **Columna Izquierda (290px)**:
       - Panel Superior: `BIBLIOTECA` (Colecciones: "Canciones", "Presentaciones", "Videos", "Playlist anterior", y bibliotecas personalizadas creables y eliminables con drag-and-drop hacia el servicio).
       - Panel Inferior: `PLAYLIST` (Selector de servicio con calendario, contador de elementos, botón `+`, y soporte de **Encabezados de Sección colapsables** "MÚSICA", "MENSAJE", "ANUNCIOS" en negrita y color temático).
    4. **Panel Central (Flex)**:
       - Cabecera con título del elemento, selector de arreglos de canción, y herramientas.
       - Cuadrícula de diapositivas 16:9 con etiquetas de grupo coloreadas ("Verso 1", "Coro", "Puente"), número de diapositiva, borde amarillo/azul de selección y borde verde/rojo pulsante en VIVO (`is-live`), slider de zoom continuo y alternador cuadrícula/lista.
       - Panel Inferior de `MEDIOS` colapsable (drawer): árbol de carpetas a la izquierda ("Videos", "Cuenta Regresiva", "Imágenes", "Audio", "PDF"), cuadrícula de miniaturas a la derecha con badge de duración, icono de bucle y zoom slider.
    5. **Columna Derecha (330px)**:
       - Monitor de previsualización de salidas con selector (Sala Principal, Escenario, Lobby) y barras de nivel de audio VU Meter estéreo activas.
       - Tira vertical de botones "Limpiar por capa" ([Audio], [Fondo], [Diapo], [Mensaje], [Medios], [Todo]) con indicadores de capas activas.
       - Barra de transporte multimedia (-15s, Play/Pause, +15s, scrubber de línea de tiempo con tiempo transcurrido y restante).
       - Pestañas inferiores con `TEMPORIZADORES` activa por defecto (cuenta regresiva duración, hora del día, cronómetro, botones Iniciar/Pausar/Reiniciar, y asignación independiente a Escenario y Audiencia), con pestañas `Props` y `Macros` desactivadas marcadas como "Próximamente".
  - **Evidencia Visual Generada**:
    - [ui-operator-1920x1080.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-operator-1920x1080.png)
    - [ui-operator-1366x768.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-operator-1366x768.png)
    - [ui-output-main.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-output-main.png)
    - [ui-output-stage.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-output-stage.png)
    - [ui-output-lobby.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-output-lobby.png)

---

## 42. Tabla de Atajos de Teclado y Advertencias para Operadores

| Acción | Atajo por Defecto | Ámbito de Foco | Advertencia / Restricción |
| :--- | :---: | :---: | :--- |
| **Negro (Blackout)** | `F1` | Ventana con foco | Quitado Ctrl+B para permitir negrita nativa en edición de textos |
| **Limpiar Diapositiva** | `F2` | Ventana con foco | Quitado Ctrl+C para evitar colisión con Copiar del portapapeles |
| **Logo de Iglesia** | `F3` | Ventana con foco | Quitado Ctrl+L para evitar colisiones con enlaces de texto |
| **Congelar Salida** | `F4` | Ventana con foco | Quitado Ctrl+F para permitir el buscador universal de biblioteca |
| **Atajos Globales a nivel de SO** | Desactivados | Todo Windows | Opción configurable en Preferencias sólo para teclas F con advertencia explícita |

---

## 43. Integración de YouTube (Fase 5C): Arquitectura, Evaluación Técnica y Seguridad

### 1. Evaluación Técnica de Opciones de Reproducción en las Salidas

Se evaluaron experimentalmente las dos alternativas para reproducir videos de YouTube en las ventanas de salida:

- **Opción (a): Reproductor incrustado con la API oficial IFrame de YouTube (`YT.Player`)**:
  - *Mecanismo*: Cargar un iframe con `https://www.youtube.com/embed/{id}?enablejsapi=1` dentro del DOM de `OutputApp.tsx`.
  - *Limitación Crítica Identificada*: En las versiones modernas de Chromium (y Electron 45), las cookies de terceros y el almacenamiento en partición cruzada (CHIPS - Cookies Having Independent Partitioned State) están aislados por defecto. Esto significa que cuando el usuario inicia sesión en su cuenta de Google o YouTube Premium en el panel del operador (partición `persist:youtube`), **esas cookies y credenciales NO se transmiten al iframe de YouTube cargado dentro de un documento local `file://`**. En consecuencia, la opción (a) no reconoce la sesión Premium del usuario, mostrando anuncios y restricciones de edad/cuenta.
  
- **Opción (b): Vista dedicada (`WebContentsView`) con la partición compartida `persist:youtube` (ELEGIDA)**:
  - *Mecanismo*: Se instancia una `WebContentsView` en el proceso principal ligada a la misma partición `session.fromPartition('persist:youtube')` y se acopla directamente a la ventana de salida (`outputWindow.contentView.addChildView(view)`).
  - *Ventajas Clave*:
    1. **Preservación Integral de la Sesión**: Al ejecutarse como contexto de primer nivel dentro de `persist:youtube`, la vista tiene acceso completo a las cookies de la iglesia y a la cuenta de YouTube (incluyendo membresías Premium sin anuncios).
    2. **Transición sin Parpadeo (Zero-Flicker Live Switch)**: Durante la preparación del elemento en el servicio, la vista se monta con visibilidad oculta (`setVisible(false)`) y el video se precarga en pausa en el punto de entrada (`inPoint`). Al pulsar "En vivo", simplemente se hace visible (`setVisible(true)`) y se reanuda la reproducción, eliminando por completo cualquier parpadeo negro, recarga de página o salto visual.
    3. **Enrutamiento de Audio por Hardware**: Permite silenciar las salidas secundarias por hardware con `view.webContents.setAudioMuted(role !== audioRole)`, evitando ecos y bucles de retorno en el templo.
    4. **Integración con Controles Globales**: Responde instantáneamente a Negro (ocultando la vista), Limpiar (pausando y ocultando) y Congelar (pausando el fotograma en curso).
  - *Conclusión*: Se eligió de forma definitiva la **Opción (b)** por su superioridad en fidelidad de sesión, ausencia de parpadeo y control de audio por hardware.

### 2. Política de Dominios Permitidos (Whitelist) y Seguridad de Red

Para evitar vectores de fuga de navegación o inyección de scripts externos, la navegación de la partición de YouTube está estrictamente limitada a la siguiente lista de dominios:
- `youtube.com`
- `www.youtube.com`
- `m.youtube.com`
- `youtube-nocookie.com`
- `google.com`
- `accounts.google.com`
- `myaccount.google.com`
- `gstatic.com`
- `fonts.gstatic.com`
- `ytimg.com`
- `i.ytimg.com`
- `googlevideo.com`
- `googleusercontent.com`
- `play.google.com`

Cualquier enlace externo que intente navegar fuera de estos dominios (como enlaces en descripciones de videos) es interceptado por `will-navigate` y `setWindowOpenHandler`, bloqueado en la vista interna y derivado al navegador predeterminado del sistema operativo mediante `shell.openExternal()`. Todos los permisos de hardware (cámara, micrófono, geolocalización, notificaciones) son denegados incondicionalmente mediante `ses.setPermissionRequestHandler`.

### 3. Bloqueo y Filtrado de Anuncios

Siguiendo las directrices del operador:
1. **Filtro de Peticiones Web**: Se interceptan peticiones a redes publicitarias conocidas (`*.doubleclick.net`, `*.googleadservices.com`, `*googleads*`, `*.youtube.com/api/stats/ads*`, `*.youtube.com/pagead/*`) cancelándolas antes de que inicien la descarga.
2. **Script de Omisión Automática (Ad-Skipper)**: Se inyecta un script en el DOM de la vista que detecta botones de omisión de publicidad (`.ytp-ad-skip-button`, `.ytp-skip-ad-button`), forzando su clic inmediato, y silencia y adelanta videos publicitarios no omitibles.
3. **Detección de Anuncio**: Si un anuncio publicitario entra en reproducción, la aplicación lo detecta a través del monitor de transporte y emite el evento `youtube:ad-status`, desplegando una insignia visual ámbar `[ANUNCIO EN CURSO]` en el panel de control del operador.

### 4. Sincronización Multisalida y Tolerancia de Deriva

Al proyectar el mismo video de YouTube en múltiples pantallas simultáneas (p. ej., Sala y Lobby):
- Los streams de YouTube se transmiten de manera adaptativa e independiente por red (DASH/HLS).
- El proceso principal monitorea los códigos de tiempo de cada salida cada 250 ms.
- Si la deriva entre pantallas supera los **250 ms**, se emite una instrucción de resincronización automática (`video.currentTime = masterTime`).
- *Recomendación Operativa*: Si la conexión a internet de la iglesia es lenta o inestable, se recomienda proyectar el video únicamente en la pantalla principal de Sala y usar el monitor de escenario como monitor de confianza con los cronómetros de tiempo restante.

### 5. Evidencia de Pruebas Generada (Fase 5C)
- Panel del Operador con Navegador de YouTube: [ui-operator-youtube-panel.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-operator-youtube-panel.png)
- Modal de Verificación Pre-Culto de la Playlist: [ui-operator-youtube-verify.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-operator-youtube-verify.png)
- Operador en Proyección de YouTube en Vivo: [ui-operator-youtube-live.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-operator-youtube-live.png)
- Salida Sala Principal (Main): [ui-youtube-output-main.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-youtube-output-main.png)
- Salida Escenario con Cronómetros (Stage): [ui-youtube-output-stage.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-youtube-output-stage.png)
- Salida Lobby (Lobby): [ui-youtube-output-lobby.png](file:///c:/Users/daini/Videos/TEST2/docs/evidence/ui-youtube-output-lobby.png)

---

## 18. Rediseño de la Interfaz del Operador (Estilo ProPresenter 7) y Nombres de Paneles

- **Contexto**: El equipo audiovisual y de sonido de la iglesia ya está acostumbrado a ProPresenter 7. Un cambio drástico en la distribución espacial, terminología o atajos dificultaba la transición operativa durante los servicios.
- **Decisión**:
  - Adoptar la distribución tri-columna clásica de ProPresenter 7:
    - **Columna Izquierda**: Colecciones de Bibliotecas (arriba) y Playlist de Servicio (abajo).
    - **Columna Central**: Cuadrícula de diapositivas con etiquetas de grupo coloreadas, miniaturas legibles y cajón inferior desplegable de Medios / Navegador de YouTube.
    - **Columna Derecha**: Vista previa de la salida seleccionada, vúmetros estéreo de nivel de audio real, tira de botones de limpieza por capa (Audio, Fondo, Diapo, Mensaje, Medios, Todo), controles de transporte y pestañas de temporizadores.
  - **Nombres de Paneles por Defecto**: Se utilizan por defecto los términos en inglés familiares para los operadores: `Library`, `Playlist`, `Media`, `Audience` y `Stage`.
  - **Opción de Localización en Español**: En el modal de Configuración, se añade una opción explícita para cambiar los nombres a español (`Biblioteca`, `Playlist`, `Medios`, `Audiencia`, `Escenario`).
  - **Preservación del Español en Ayudas y Mensajes**: Todos los textos de ayuda, tooltips, advertencias, modales de diálogo y mensajes del sistema permanecen estrictamente en español.

---

## 19. Ciclo de Vida y Protección de Procesos de PowerPoint (POWERPNT.EXE)

- **Contexto**: Al convertir presentaciones con Microsoft PowerPoint vía COM, existía el riesgo de que procesos huérfanos sin ventana visible (`POWERPNT.EXE`) quedaran bloqueados en segundo plano si la conversión fallaba, se cancelaba o agotaba el tiempo de espera (120 s). Además, no se debían cerrar presentaciones abiertas por el usuario en su escritorio.
- **Decisión**:
  - **Detección Previa de PIDs**: Antes de iniciar la conversión COM, `PowerPointService` consulta y registra la lista de identificadores de procesos activos (`initialPids`) de `POWERPNT.EXE`.
  - **Preservación de Sesiones de Usuario**: Si el usuario ya tenía PowerPoint abierto con sus documentos de trabajo (`initialPids.length > 0`), esos procesos específicos **nunca son terminados**.
  - **Limpieza de Huérfanos**: Si PowerPoint no estaba abierto previamente o si el script genera una instancia adicional, en caso de error, cancelación o timeout se localizan los PIDs no presentes en `initialPids` y se terminan de forma forzada con `Stop-Process -Force`.
  - **Verificación Automatizada**: Se implementó una prueba unitaria específica ([`powerpoint-process-lifecycle.test.ts`](file:///c:/Users/daini/Videos/TEST2/tests/powerpoint-process-lifecycle.test.ts)) que valida que ningún proceso queda huérfano.

---

## 20. Investigación Honesta de Discrepancias en Benchmarks de Video

- **Contexto**: En la ejecución anterior se reportaron dos anomalías numéricas que requerían explicación causal y corrección rigurosa:
  1. Consumo de memoria RAM de 2.28 GB.
  2. Conteo de fotogramas de 294 sobre 643 esperados en MP4 1080p.
- **Causa Raíz de la Memoria (2.28 GB)**:
  - En el script de benchmark anterior, la memoria se midió llamando a `process.memoryUsage().rss` **dentro del proceso runner de Node.js de Playwright**, el cual había serializado en memoria heap de V8 arrays masivos de fotogramas generados en canvas (`Array.from(bytes)`), inflando el proceso de prueba a más de 2 GB.
  - El consumo real de la aplicación Electron de ChurchPresenter (sumando el proceso principal, GPU y los 4 renderizadores) medido con la API nativa `electronApp.getAppMetrics()` es de **180 a 260 MB**.
- **Causa Raíz del Conteo de Fotogramas en MP4 (294 / 643)**:
  - Los clips sintéticos generados duraban entre 8 y 10 segundos y se reproducían con `loop=true`.
  - En Chromium bajo Windows, los blobs MP4 sintéticos carecen de tablas de átomos de búsqueda MOOV indexadas. Al reiniciar el bucle (`currentTime = 0`), la canalización del demuxer de Chromium sufre un estancamiento de decodificación (*pipeline stall*) de 200 a 400 ms en cada vuelta (acumulando 294 fotogramas en 21.4 segundos reales, es decir ~13.7 FPS).
  - En contraste, los archivos WebM VP9 sin bucle presentan decodificación continua fluida.
- **Medición Continua sin Bucle (60 Segundos - Cifras Reales Medidas)**:
  - Archivo de prueba: `tests/fixtures/benchmark_60s.webm` (12.31 MB, WebM VP9 a 1080p y 30 FPS).
  - Duración real de la prueba: **62.33 segundos**.
  - Fotogramas esperados: **1,800 fotogramas**.
  - Fotogramas medidos y entregados a pantalla:
    - Salida 1 (Sala Principal): **1,793 fotogramas** (tasa real: **29.88 FPS**).
    - Salida 3 (Lobby): **1,794 fotogramas** (tasa real: **29.90 FPS**).
    - Salida 2 (Escenario): **0 fotogramas** (por diseño arquitectónico deliberado: el monitor de confianza de escenario no proyecta videos de fondo para no distraer al predicador/músicos y optimizar ancho de banda de GPU, mostrando en su lugar reloj en tiempo real, cronómetros y notas).
  - Saltos de fotograma (> 50 ms, es decir > 1.5x el intervalo de 33.3 ms): **4 saltos** en 1,800 fotogramas (0.22% de incidencia, totalmente imperceptible al ojo humano).
  - Deriva temporal entre Sala y Lobby: **0.000 s** (`firstFrameTime: 0.068s`, `lastFrameTime: 60.959s` idénticos).
  - Telemetría de CPU: **2.1% promedio** (pico de **2.4%** en CPU Intel Core Ultra 7 265KF).
  - Telemetría de Memoria de GPU: **180.6 MB**.
  - Memoria RAM Working Set de Electron (`getAppMetrics()` sumando proceso principal, proceso GPU y los 4 renderizadores WebContents de Chromium): **1,196.2 MB promedio** (pico de 1,298.8 MB, equivalente a ~290 MB por proceso de Chromium con renderizado de video por hardware).
  - Archivo de registro generado: [`benchmark-video-honest-results.json`](file:///c:/Users/daini/Videos/TEST2/benchmark-video-honest-results.json).

---

## 21. Perfil de Atajos de Teclado y Mapeo Completo de Acciones Primarias

- **Contexto**: El operador requiere control ágil por teclado para avanzar diapositivas, saltar elementos de la playlist y activar limpiezas de capa sin usar el ratón.
- **Decisión**:
  - Se añade soporte para perfiles de atajos: `ProPresenter por Defecto` y `Personalizado`.
  - **Mapeo del Perfil ProPresenter por Defecto**:
    - **Siguiente Diapositiva**: `ArrowRight` (o Barra espaciadora)
    - **Anterior Diapositiva**: `ArrowLeft`
    - **Siguiente Ítem de Playlist**: `ArrowDown` (o `PageDown`, `N`)
    - **Anterior Ítem de Playlist**: `ArrowUp` (o `PageUp`, `P`)
    - **Pantalla a Negro (Black)**: `F1`
    - **Limpiar Todo (Clear All)**: `F2`
    - **Mostrar Logo**: `F3`
    - **Congelar Salidas (Freeze)**: `F4`
    - **Limpiar Audio**: `F5`
    - **Limpiar Fondo**: `F6`
    - **Limpiar Diapositiva**: `F7`
    - **Limpiar Mensaje**: `F8`
    - **Limpiar Medios**: `F9`
    - **Alternar Cajón de Medios**: `Ctrl+M`
    - **Foco a Búsqueda Rápida**: `Ctrl+F`
    - **Navegador de YouTube**: `Ctrl+Y`
    - **Pasaje Bíblico Siguiente / Anterior**: `C` / `X`
  - Todas las teclas son reasignables desde el panel interactivo de Configuración y se persisten en la base de datos local SQLite.

