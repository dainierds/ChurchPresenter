# Guía de Operación y Manual de Usuario para el Templo

Este manual está diseñado para el equipo de multimedia y operadores de proyección de la iglesia. Explica paso a paso cómo operar **ChurchPresenter**, preparar el culto dominical, gestionar imprevistos y utilizar los atajos rápidos de teclado.

---

## 1. Encendido y Arranque del Sistema

1. **Orden de encendido físico**:
   - Enciende primero los proyectores y televisores de la sala y del escenario.
   - Enciende el splitter HDMI y el switch de red audiovisual.
   - Finalmente, enciende la PC principal de transmisión/proyección.
2. **Inicio de ChurchPresenter**:
   - Abre la aplicación desde el acceso directo del escritorio.
   - Si la aplicación se cerró abruptamente en una sesión previa (por corte eléctrico o reinicio forzado), aparecerá el diálogo **"Recuperación Tras Cierre Inesperado"**.
   - Haz clic en **"Reanudar Sesión Anterior"**: esto cargará la lista y la última diapositiva seleccionada en el monitor de previo, **sin proyectar nada en vivo** hasta que tú lo ordenes.

---

## 2. Preparación del Culto: "Verificar Servicio"

Antes de que inicie la reunión de alabanza o el culto general:
1. En la barra de herramientas superior, haz clic en el botón verde con escudo: **`[✓] Verificar`** (o en el menú `Ayuda > Verificar Servicio Previo al Culto...`).
2. La ventana de inspección comprobará automáticamente 9 puntos críticos:
   - **Monitores físicos**: Verifica que las pantallas de Audiencia y Escenario estén conectadas y asignadas.
   - **Archivos de medios**: Confirma que los videos, imágenes y pistas de audio de la lista existan en el disco y se puedan leer.
   - **Videos de YouTube**: Revalida que los enlaces o IDs tengan formato correcto y conexión a internet.
   - **PowerPoint**: Comprueba que las diapositivas convertidas coincidan con el archivo `.pptx` original.
   - **Biblias**: Verifica que las traducciones bíblicas (RVR1909, KJV, etc.) estén cargadas.
   - **Espacio en disco**: Revisa que queden al menos 5 GB libres para evitar bloqueos del sistema operativo.
   - **Copia de seguridad**: Asegura que exista un respaldo de la base de datos de menos de 24 horas.
3. Si algún elemento aparece en **Aviso (Ámbar)** o **Error (Rojo)**, pulsa el botón de acción correspondiente (ej. *"Crear Copia Ahora"*, *"Reintentar Detección"*, etc.) hasta que el banner muestre **TODO LISTO PARA EL CULTO**.

---

## 3. Operación en Vivo Durante el Culto

- **Monitores Duales**:
  - **Previo (Izquierda)**: Muestra la diapositiva que estás preparando. Ninguna persona en la congregación la está viendo aún.
  - **En Vivo (Derecha)**: Muestra exactamente lo que se proyecta en la pantalla del templo.
- **Enviar a Vivo**:
  - Pulsa **Espacio** o haz doble clic en cualquier diapositiva de la cuadrícula para enviarla inmediatamente a las salidas.
- **Avanzar y Retroceder**:
  - Tecla **Flecha Derecha (→)** o **AvPág**: Siguiente diapositiva.
  - Tecla **Flecha Izquierda (←)** o **RePág**: Diapositiva anterior.
- **Módulo Bíblico**:
  - Presiona el botón `[BookOpen] Biblia` en la barra superior.
  - Escribe la referencia en el recuadro (ej. `Juan 3:16`, `Salmos 23:1-4`, `1 Co 13:4`) y presiona **Enter**.
  - Pulsa **"En Vivo"** para proyectarlo inmediatamente sobre el fondo activo.

---

## 4. Gestión de Imprevistos y Acciones Rápidas

### A. Botón de Pánico / Modo de Emergencia
Si ocurre un imprevisto grave en la plataforma (micrófono abierto, video inapropiado, caída de streaming, error de predicador):
- Presiona inmediatamente el botón rojo **`[!] Emergencia`** en la esquina superior derecha.
- **Efecto instantáneo**:
  - Todas las salidas (congregación y escenario) se protegen mostrando el logo oficial de la iglesia o fondo seguro.
  - Se congelan y silencian todos los videos y pistas de audio de forma inmediata.
  - Tu lista de trabajo, notas y selección de diapositivas permanecen intactas en la pantalla del operador.
- Para restablecer la proyección una vez resuelto el incidente, pulsa **"Reanudar Salidas"** en el banner rojo superior.

### B. Controles Rápidos de Salida (F1 - F4)
- **F1 (Negro / Blackout)**: Pantalla completamente en negro.
- **F2 (Limpiar / Clear)**: Quita el texto manteniendo el video o fondo animado.
- **F3 (Logo)**: Muestra el logotipo de la iglesia.
- **F4 (Congelar / Freeze)**: Congela la imagen actual para que puedas buscar otro contenido sin que la congregación vea lo que haces.

### C. Desconexión o Parpadeo de un Cable HDMI / TV
- ChurchPresenter cuenta con autorrecuperación automática de pantallas.
- Si un proyector o televisor se apaga o se afloja el cable HDMI, la app mantendrá la ventana en espera y la restaurará en la posición correcta en menos de 1 segundo tan pronto como el monitor vuelva a reportarse a Windows.
- Puedes verificar el estado en tiempo real pulsando el botón **`Salud`** en la barra superior.

### D. Modo Seguro para Diagnóstico
Si la aplicación alguna vez presentara un fallo al iniciar, puedes abrirla con el argumento `--safe-mode`:
- Desactiva el servidor web remoto, los vigilantes de carpetas externas y YouTube para aislar el problema y permitirte proyectar las canciones y versículos bíblicos de manera 100% segura.

---

## 5. Modo Ensayo

Para ensayar antes del culto o probar presentaciones sin alterar la rutina oficial:
1. Haz clic en el botón **`Ensayo`** en la barra superior.
2. La insignia cambiará a **`[ENSAYO]`** en color naranja brillante.
3. Todas las transiciones, reproducciones y posibles bajas de FPS se registrarán en un archivo de auditoría independiente (`rehearsal-<fecha>.log`).
4. Al hacer clic nuevamente en `[ENSAYO]` para apagarlo, se abrirá un **Resumen del Ensayo** indicando la duración total, número de diapositivas presentadas y si hubo algún incidente.

---

## 6. Atajos Rápidos de Teclado

| Atajo | Función |
|---|---|
| **Espacio** | Enviar diapositiva seleccionada En Vivo |
| **Flecha Derecha (→) / AvPág** | Siguiente diapositiva |
| **Flecha Izquierda (←) / RePág** | Diapositiva anterior |
| **F1** | Pantalla a Negro (Blackout) |
| **F2** | Limpiar Capa de Texto (Clear) |
| **F3** | Mostrar Logotipo Oficial (Logo) |
| **F4** | Congelar Salida Actual (Freeze) |
| **F5** | Iniciar Presentación desde el principio |
| **Ctrl + F** | Búsqueda rápida en biblioteca de canciones |
| **Ctrl + Y** | Abrir navegador de YouTube |
| **Escape (ESC)** | Cerrar cualquier ventana secundaria / salida flotante |
| **Ctrl + Z** | Deshacer edición en canciones (Undo) |
| **Ctrl + Y (en editor)** | Rehacer edición (Redo) |
