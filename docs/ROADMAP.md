# ChurchPresenter - Roadmap de Desarrollo

Este documento define la planificación oficial de las 10 fases de desarrollo de **ChurchPresenter**, software de presentaciones para iglesias para uso interno en Windows 11.

---

## Fases del Proyecto

### Fase 0: Preparación
- Definición de requisitos de hardware (PC Windows 11, GPU NVIDIA 4 salidas + splitter HDMI).
- Selección de stack tecnológico (Electron + Vite + React + TypeScript + SQLite).
- Diseño de arquitectura de procesos y aislamiento de seguridad.

### Fase 1: Cimientos (En curso / Implementada)
- Estructura limpia modular: `main`, `preload`, `renderer/operator`, `renderer/output`, `shared`.
- Documentación técnica inicial: `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `README.md`.
- Configuración de linting, tipado estricto (`tsc`), pruebas unitarias (`vitest`) y script `npm run verify`.
- Base de datos local SQLite con soporte de migraciones automáticas para configuraciones.
- Sistema de logs rotativos persistentes en disco (`electron-log`).

### Fase 2: Motor de salidas multipantalla (En curso / Implementada)
- Detección en vivo de pantallas físicas con Electron `screen` API (`display-added`, `display-removed`, `display-metrics-changed`).
- Modelo de roles de salida (`operator`, `main`, `stage`, `lobby`) extensible y asignable dinámicamente.
- Persistencia y restauración de asignación de pantallas; tolerancia a pantallas desconectadas.
- Ventanas de salida dedicadas: fullscreen exacto por coordenadas de pantalla, sin bordes, sin cursor (`cursor: none`), sin barra de tareas.
- Renderizado por capas: fondo (`background`), contenido (`content`), superpuesto (`overlay`) y mensaje (`message`).
- Controles globales inmediatos para el operador: Negro (Black), Limpiar (Clear), Logo y Congelar (Freeze) con atajos de teclado.
- Panel mínimo del operador con identificación visual de pantallas (overlay de 3 segundos) y cuadrícula de diapositivas de prueba.
- Modo de prueba de estrés animado (contador de fotogramas, reloj en ms, monitor de resolución y registro de bajadas de FPS).
- Tolerancia a fallos: autorrecuperación de ventanas de salida en caso de cierre anómalo.

### Fase 3: Contenido y canciones
- Biblioteca de canciones, estrofas, coros y acordes.
- Formato de temas, plantillas visuales, tipografías y alineación.
- Búsqueda instantánea y transiciones suaves.

### Fase 4: Biblia
- Múltiples versiones bíblicas locales (RVR1960, NVI, etc.).
- Búsqueda rápida por libro, capítulo y versículo.
- Modos de visualización de versículos en capas de contenido y superposición.

### Fase 5: PowerPoint/PDF/video/YouTube
- Integración y renderizado de presentaciones externas.
- Reproductor acelerado por hardware para fondos dinámicos y clips de video.
- Integración de streams o videos en línea.

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
