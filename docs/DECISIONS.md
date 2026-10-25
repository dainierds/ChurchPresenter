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
  - *Criterios para migrar a un motor nativo (ej. LibSQL o better-sqlite3 compilado)*:
    1. Cuando la biblioteca de canciones, versiones bíblicas completas o metadatos de medios multimedia supere los 20,000 registros o un archivo de base de datos mayor a 100 MB.
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
