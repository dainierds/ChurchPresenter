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
