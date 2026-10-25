# Matriz de Funcionalidades y Cobertura de Interfaz (ChurchPresenter)

Esta matriz documenta el estado real, los puntos de entrada en la interfaz de usuario, y la verificación técnica de cada modo y función tras el rediseño al estilo ProPresenter 7 y la corrección de regresiones.

---

## 1. Modos de la Barra de Herramientas Principal (ProToolbar)

| Modo | Botón en UI | Atajo | Componente Activo en Centro | Estado | Verificación |
|---|---|---|---|---|---|
| **Mostrar (Show)** | `[Tv] Mostrar` | Automático al iniciar | `SlideGridPanel` | Operativo | Verificado con pruebas unitarias y e2e (`tests/e2e-all-modes.test.ts`). |
| **Editar (Edit)** | `[Edit3] Editar` | Clic o encabezado | Modal `SongEditorModal` / `PresentationEditorModal` o `pro-edit-mode-hub` si no hay elemento | Operativo | Corregido: nunca queda en blanco. Si hay canción la abre; si no, abre creador de canción o centro de edición. |
| **Biblia (Bible)** | `[BookOpen] Biblia` | Clic | `BibleBrowserPanel` | Operativo | Corregido: panel completo con "Ir a", búsqueda de texto, selector de traducción, doble traducción, favoritos, historial, "En Vivo" y "Al Servicio". |
| **YouTube** | `[Logo] YouTube` | Ctrl+Y | `YouTubeBrowserPanel` | Operativo | Sesión aislada (`persist:youtube`), bloqueo de ads, espejo a salidas, corrección de bucle de buffering eliminando `seekTo` continuo. |
| **Más (More)** | `[Sliders] Más` | Clic | `pro-more-mode-hub` / `SettingsModal` | Operativo | Corregido: acceso directo a Preferencias, Pantallas, Temas, Biblias y Atajos. |

---

## 2. Gestión de Pantallas y Salidas Físicas

| Función | Entrada en UI | Acción | Estado | Verificación |
|---|---|---|---|---|
| **Configurar Asignación de Roles** | `Menú Pantallas > Configurar Asignación de Roles...` | Abre `isDisplaysModalOpen` | Operativo | Verificado: mapea roles a monitores físicos (`standard-roles.ts`). |
| **Botón Toolbar Pantallas** | `ProToolbar > [Monitor] Pantallas` | Abre `isDisplaysModalOpen` | Operativo | Verificado: acceso directo junto a indicadores de Audiencia y Escenario. |
| **Clic en Indicador Audience** | `ProToolbar > Audience` (si no asignado) | Abre `isDisplaysModalOpen` | Operativo | Si está asignado, abre ventana previa; si no está asignado, abre configuración. |
| **Clic en Indicador Stage** | `ProToolbar > Stage` (si no asignado) | Abre `isDisplaysModalOpen` | Operativo | Si está asignado, abre ventana previa; si no está asignado, abre configuración. |
| **Botón Flotante de Cierre (Hover)** | Esquina superior de pantalla Audiencia y Escenario | Botón flotante translúcido que aparece solo al pasar el mouse | Operativo | Cierra la ventana de proyección/retorno de forma intencional sin recreación automática. |
| **Identificar Pantallas Físicas** | `Menú Pantallas > Identificar Pantallas Físicas` | Muestra overlay numerado en cada monitor | Operativo | Llama a `window.churchPresenterApi.identifyDisplays()`. |

---

## 3. Sagradas Escrituras (Biblia)

| Función | Entrada en UI | Acción | Estado | Verificación |
|---|---|---|---|---|
| **Ir a Referencia** | `BibleBrowserPanel > Campo "Ir a"` | Presionar Enter o clic en "Ir a Pasaje" | Operativo | Parser de referencias en español y generación de diapositivas (`bible-service.test.ts`). |
| **Navegación de Capítulos** | `Botones ◄ y ►` | Avanza o retrocede de capítulo | Operativo | Mantiene libro y ajusta número de capítulo. |
| **Búsqueda por Texto** | `Pestaña Búsqueda de Texto` | Búsqueda por palabra clave con resaltado `<mark>` | Operativo | Filtros por Todos, AT y NT (`tests/e2e-all-modes.test.ts`). |
| **Doble Traducción** | `Checkbox "Doble traducción"` | Combina dos versiones (ej. RVR1909 + KJV) | Operativo | Soporta disposición Apilada (Stacked) y Lado a Lado (SideBySide). |
| **Administrar / Importar** | `Botón Administrar Biblias...` | Abre `BibleManagerModal` y `BibleImportModal` | Operativo | Soporte para formatos Zefania XML, OSIS, USFM y JSON. |
| **Agregar al Servicio** | `Botón [Plus] Al Servicio` | Agrega elemento `scripture` a la playlist | Operativo | Se inserta con referencia y traducción seleccionada. |
| **Proyectar En Vivo** | `Botón [Play] En Vivo` / Doble clic | Envía directamente a Audience y Stage | Operativo | Llama a `handleGoLive(slide, nextSlide)`. |

---

## 4. YouTube y Proyección Limpia

| Característica | Estado | Verificación |
|---|---|---|
| **Eliminación de bucle spinner/pausa** | Corregido | Se eliminó el `seekTo` spam continuo cada 600ms durante la reproducción. Ahora solo se sincroniza play/pause en cambios de estado, y `seekTo` solo ocurre en scrub manual o desfase > 2.5s. |
| **Salida de proyección limpia** | Corregido | Parámetros de iframe embed: `controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0`. |
| **Visibilidad de Modales sobre YouTube** | Corregido | El `WebContentsView` nativo de YouTube se oculta y desplaza fuera de pantalla al abrir cualquier modal (Configuración de pantallas, Ajustes, etc.) para que los diálogos React no queden tapados. La reproducción y sincronización en salidas continúa activa. |
| **Muteo de audio selectivo** | Corregido | El iframe de salida se mutea cuando la fuente es el navegador interactivo o cuando el rol no coincide con `audioOutputRole`. |

---

## 5. Resiliencia y Tolerancia a Fallos (Error Boundaries)

| Contenedor | Componente Protector | Comportamiento ante Fallo |
|---|---|---|
| **Panel Izquierdo** | `<ErrorBoundary panelName="Biblioteca y Playlist">` | Si ocurre error en árbol de react, muestra tarjeta de error con botón "Reintentar" sin tumbar el área central ni la salida. |
| **Columna Central** | `<ErrorBoundary panelName="Área Central">` | Si falla el renderizado del SlideGrid o Bible, muestra tarjeta informativa en español y permite reintentar. |
| **Panel Derecho** | `<ErrorBoundary panelName="Monitores y Salidas">` | Aísla temporizadores y vista previa; la proyección real en pantallas físicas continúa intacta. |
| **Cajón de Medios** | `<ErrorBoundary panelName="Cajón de Medios">` | Aísla la cuadrícula de medios. |

---

## 6. Registro de Pruebas Automatizadas

- **Total Archivos de Test**: 28 archivos
- **Total Tests Automatizados**: 135 pruebas pasando limpiamente (`npm test`)
- **Compilación de Tipos**: TypeScript 5.7.2 (`tsc --noEmit`) sin errores.
- **Linter**: ESLint 8.57.1 sin errores.
