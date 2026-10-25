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

