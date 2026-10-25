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
- **Decisión**: Seleccionar `sql.js` (SQLite compilado oficialmente a WebAssembly) con persistencia periódica y en salida hacia archivo `.sqlite` en disco vía `fs`.
- **Motivo**:
  - `better-sqlite3` es un módulo nativo C++ dependiente de `node-gyp`. En entornos Windows donde Visual Studio C++ Build Tools no está instalado en el sistema anfitrión, la compilación e instalación falla con errores de toolchain (`MSB8020` / `find VS`).
  - Además, `better-sqlite3` presenta desajustes recurrentes de ABI (`NODE_MODULE_VERSION`) entre la versión de Node.js instalada en el sistema (ej. Node 24) y el Node interno de Electron (ej. Electron 33 / Node 20), requiriendo recompilaciones nativas complejas que pueden romper empaquetados de producción en `electron-builder`.
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
  - Cero carga de contenido remoto; todos los recursos se cargan desde el bundle local (`file://` o dev server local con CSP estricta).
  - API de preload mínima, tipada y expuesta selectivamente mediante `contextBridge.exposeInMainWorld('churchPresenterApi', ...)`.
- **Motivo**: Cumple rigurosamente las guías oficiales de seguridad de Electron (OWASP / Electron Security Checklist).

---

## 5. Sistema de Registro de Logs Rotativo

- **Contexto**: Detección de errores, caídas de fotogramas (FPS) en pantallas secundarias y eventos de conexión de hardware sin saturar el almacenamiento de la PC de la iglesia.
- **Decisión**: Utilizar `electron-log` configurado en `appData/ChurchPresenter/logs`.
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
  - Una instancia `BrowserWindow` separada por cada rol físico asignado (`main`, `stage`, `lobby`).
- **Motivo**:
  - El uso de ventanas separadas a nivel de SO permite a Windows y a la GPU gestionar la sincronización vertical (V-Sync) individual de cada pantalla sin bloquear el hilo de la interfaz del operador.
  - Evita que el operador mueva accidentalmente el cursor del mouse dentro del proyector de la congregación.

---

## 7. Pruebas Automatizadas con Vitest

- **Contexto**: Se requiere validar la lógica pura de asignación de pantallas, resolución de conflictos de roles y mutaciones de estado de capas.
- **Decisión**: Utilizar `vitest` ejecutando pruebas unitarias directas en TypeScript.
- **Motivo**:
  - Velocidad extrema de ejecución gracias a la integración nativa con Vite.
  - Pruebas aisladas sin necesidad de instanciar ventanas Chromium completas para lógica de dominio y matemáticas de coordenadas.
