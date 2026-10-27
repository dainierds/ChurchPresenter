# Procedimiento de Actualización y Reversión (Rollback)

Este documento describe el protocolo oficial para realizar actualizaciones del software **ChurchPresenter** en la computadora principal del templo, así como el procedimiento de reversión inmediata en caso de imprevistos.

---

## 1. Reglas Fundamentales de Mantenimiento

1. **Nunca actualizar el mismo día de un culto**: Las actualizaciones deben realizarse preferentemente los lunes o martes, permitiendo que el equipo de alabanza ensaye con la nueva versión antes del domingo.
2. **Copia de seguridad obligatoria previa**: Antes de ejecutar cualquier instalador o actualización de código, se debe respaldar la carpeta de datos del usuario (`%APPDATA%\church-presenter` o `%APPDATA%\church-presenter-dev`).
3. **Validación con el botón "Verificar"**: Tras cada actualización, se debe ejecutar la lista de comprobación de culto para asegurar que las salidas y medios sigan operativos.

---

## 2. Pasos para Aplicar una Actualización

### Paso A: Generar Copia de Seguridad Previa
1. Abre **ChurchPresenter**.
2. En la barra de menús, ve a `Ayuda > Visor de Registros y Diagnóstico...` y pulsa **"Exportar Diagnóstico (.ZIP)"** para guardar un estado del sistema en tu memoria USB o carpeta de descargas.
3. Cierra la aplicación completamente.
4. Abre el Explorador de Archivos de Windows y dirígete a:
   ```text
   C:\Users\<Usuario>\AppData\Roaming\church-presenter
   ```
5. Copia el archivo `database.sqlite` y la carpeta `backups` a una carpeta de respaldo externa, por ejemplo:
   ```text
   D:\Respaldos_Culto\Pre_Actualizacion_<FECHA>\
   ```

### Paso B: Instalación de la Nueva Versión
- **Si se utiliza el instalador ejecutable (`.exe`)**:
  1. Ejecuta el nuevo instalador `ChurchPresenter-Setup-x.x.x.exe`.
  2. El instalador actualizará los archivos binarios sin alterar la base de datos existente.
  3. Al terminar, marca "Iniciar ChurchPresenter".
- **Si se actualiza desde repositorio de código**:
  ```powershell
  git pull origin main
  npm install
  npm run build
  npm test
  ```

### Paso C: Comprobación Inmediata de Arranque
1. Al iniciar la aplicación, comprueba que las canciones y listas de culto anteriores sigan presentes en la columna izquierda.
2. Haz clic en el botón verde **`Verificar`** de la barra superior.
3. Confirma que los 9 puntos de la lista previa al culto estén en estado **OK (Verde)**.
4. Conecta las salidas de proyector y escenario y valida que la proyección funcione con normalidad.

---

## 3. Procedimiento de Reversión Inmediata (Rollback)

Si tras actualizar se detecta un comportamiento anómalo o inestabilidad que comprometa el culto:

### Paso 1: Cerrar la Aplicación
Cierra **ChurchPresenter**. Si la ventana no responde, abre el Administrador de Tareas de Windows (`Ctrl + Shift + Esc`), busca `church-presenter.exe` y pulsa **Finalizar tarea**.

### Paso 2: Revertir la Base de Datos al Respaldo Seguro
1. Dirígete a la carpeta de datos:
   ```text
   C:\Users\<Usuario>\AppData\Roaming\church-presenter
   ```
2. Si la base de datos se alteró, sustituye `database.sqlite` por la copia guardada en el **Paso A** (`D:\Respaldos_Culto\Pre_Actualizacion_<FECHA>\database.sqlite`), o por la copia automática más reciente en la subcarpeta `backups/`.

### Paso 3: Reinstalar la Versión Anterior Estable
1. Ejecuta el instalador de la versión anterior (mantenido en `D:\Respaldos_Culto\Instaladores_Estables\`).
2. Completa la instalación.
3. Inicia **ChurchPresenter** y valida que todo opere con normalidad.

---

## 4. Registro de Cambios y Contacto Técnico
Cualquier incidente ocurrido durante una actualización debe ser exportado con el botón **"Exportar Diagnóstico (.ZIP)"** y enviado al responsable técnico para su análisis en los registros (`logs/church-presenter.log`).
