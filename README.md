# ChurchPresenter

Software de presentaciones para iglesias para Windows 11. Diseñado para entornos de producción con GPU NVIDIA multipantalla (hasta 5 pantallas físicas: operador, sala principal con splitter HDMI, escenario y vestíbulo/lobby).

---

## Características de la Versión Actual (Fase 1 y Fase 2)

- **Arquitectura de Procesos Segura**: Proceso principal en Node.js, `contextIsolation` activado, `nodeIntegration` desactivado y API tipada en Preload.
- **Persistencia SQLite con Migraciones**: Motor SQLite (`sql.js`) sin dependencias nativas de compilación C++, con almacenamiento persistente en la carpeta de datos de usuario.
- **Registro de Logs Rotativo**: Logs automáticos en `%APPDATA%\church-presenter\logs` con rotación configurada.
- **Detección Dinámica de Pantallas**: Soporte en vivo para conexión y desconexión de pantallas vía Electron `screen` API sin reinicios.
- **Roles de Salida Asignables**: Roles configurables (`operator`, `main`, `stage`, `lobby`), asignación persistida y detección de pantallas faltantes.
- **Ventanas de Salida Dedicadas**: Ventanas sin bordes, a pantalla completa por coordenadas exactas, sin cursor, sin barra de tareas y con autorrecuperación en caso de fallo.
- **Renderizado por Capas**: Fondo (`background`), Contenido (`content`), Superpuesto (`overlay`) y Mensaje (`message`).
- **Controles Globales Inmediatos**: Negro (F1 / Ctrl+B), Limpiar (F2 / Ctrl+C), Logo (F3 / Ctrl+L) y Congelar (F4 / Ctrl+F).
- **Panel del Operador**: Asignación de salidas, identificación visual de pantallas (3 segundos), control en vivo y cuadrícula de diapositivas de prueba.
- **Modo de Prueba de Estrés**: Animación de alta precisión para verificar sincronización, fotogramas por segundo (FPS) y ausencia de parpadeo.

---

## Requisitos Previos

- **Sistema Operativo**: Windows 11 (o Windows 10 x64).
- **Node.js**: Versión 18, 20 o superior (probado en Node 24).
- **npm** o **pnpm**.

---

## Instalación y Configuración

1. Clonar o abrir el repositorio en el directorio de trabajo:
   ```bash
   cd c:\Users\daini\Videos\TEST2
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

---

## Ejecución en Modo Desarrollo

Para iniciar la aplicación en caliente con Vite HMR y recarga automática del proceso principal:

```bash
npm run dev
```

Esto abrirá la ventana principal del Operador y, si hay roles de salida configurados con pantallas disponibles, sus correspondientes ventanas de salida.

---

## Verificación de Calidad y Pruebas

Para ejecutar la verificación completa (chequeo estricto de tipos con TypeScript, linter de código y pruebas automatizadas con Vitest):

```bash
npm run verify
```

También puedes ejecutar los comandos individualmente:
- Verificación de tipos: `npm run typecheck`
- Linter: `npm run lint`
- Pruebas unitarias: `npm run test`

---

## Compilación y Generación del Instalador de Windows

Para compilar la aplicación y generar el instalador ejecutable `.exe` de Windows para 64 bits (con NSIS):

```bash
npm run dist:win
```

El instalador final se generará en el directorio:
`dist/ChurchPresenter Setup 1.0.0.exe` (o portable según la configuración de electron-builder).

---

## Documentación Técnica Adicional

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Diagramas de ventanas, protocolo IPC y flujo de estado.
- [docs/DECISIONS.md](docs/DECISIONS.md): Justificación técnica de cada elección tecnológica.
- [docs/ROADMAP.md](docs/ROADMAP.md): Plan de desarrollo de las 10 fases del software.
