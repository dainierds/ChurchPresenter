# Guía de Inicio Rápido: Panel de Operador Remoto (Tailscale)

Bienvenido al manual operativo para el control remoto de **ChurchPresenter** desde su laptop en casa. Este panel le permite operar la presentación del culto, conmutar las escenas del estudio de transmisión, controlar cámaras móviles y gestionar la transmisión en vivo a YouTube sin estar físicamente en la iglesia.

---

## 1. Requisitos Previos y Cómo Conectarse la Primera Vez

### Requisitos:
1. **Laptop con navegador moderno** (Google Chrome, Microsoft Edge, Brave o Safari en macOS).
2. **Tailscale instalado y conectado** en su laptop personal y en la PC de la iglesia.
3. **PC de la iglesia encendida** con ChurchPresenter en ejecución.
4. **PIN de Operador Remoto** (6 dígitos numéricos configurados en ChurchPresenter -> Ajustes -> Acceso Remoto).

### Pasos de Conexión:
1. Abra su aplicación **Tailscale** y verifique que el estado sea **Conectado** (*Connected*).
2. Abra su navegador web e ingrese a la dirección segura:
   ```text
   https://100.73.59.102:8443/operator
   ```
   *(O reemplace `100.73.59.102` por la IP de Tailscale de la PC de la iglesia o su dominio configurado).*
3. **Aviso de certificado:** Si utiliza el certificado de pruebas inicial, el navegador mostrará una advertencia de seguridad. Haga clic en *Configuración avanzada* -> *Continuar a 100.73.59.102 (no seguro)*.
4. En la pantalla aparecerá el cuadro **Acceso de Operador Remoto**. Ingrese el **PIN de 6 dígitos**.
5. ¡Listo! El navegador guardará su sesión en almacenamiento local. Las próximas veces entrará automáticamente mientras su sesión de 8 horas permanezca activa.

---

## 2. Diagnóstico: Qué hacer si no conecta

Si el panel muestra *"No se puede conectar con la PC de la iglesia"* o la página no carga:

| Causa Probable | Solución Paso a Paso |
| :--- | :--- |
| **Tailscale desconectado** | Verifique el icono de Tailscale en la barra de tareas de Windows o menú de macOS. Asegúrese de que ambos equipos estén en la misma red privada de Tailscale. |
| **PC de la iglesia apagada / suspendida** | Solicite al equipo local de la iglesia que verifique que la PC principal esté encendida y que la suspensión de energía esté desactivada. |
| **ChurchPresenter cerrado** | La app ChurchPresenter debe estar abierta y activa en la PC de la iglesia. Si se cierra, los servidores web se detienen. |
| **Servidor Remoto inactivo** | En la app de la iglesia, verifique en *Ajustes -> Acceso Remoto* que la casilla *"Activar Servidor Remoto"* esté marcada. |
| **Bloqueo de Firewall de Windows** | El puerto `8443` (TCP) debe estar permitido en las reglas de entrada del Firewall de Windows en la interfaz de red de Tailscale. |

---

## 3. Cómo Iniciar y Detener la Transmisión desde Casa

El control de transmisión en vivo cuenta con doble confirmación de seguridad para evitar emisiones accidentales:

1. **Iniciar Transmisión en Vivo:**
   - En la esquina inferior derecha, ubique la tarjeta **Transmisión en Vivo**.
   - Haga clic en el botón rojo **"Iniciar Transmisión"**.
   - Aparecerá un diálogo modal: *"¿Está seguro de iniciar la transmisión en vivo a YouTube?"*.
   - Haga clic en **"Confirmar"**.
   - El estado cambiará a `EN DIRECTO`, el contador de tiempo comenzará a avanzar y el indicador `🔴 EN AIRE` se iluminará en el monitor de programa.

2. **Detener Transmisión en Vivo:**
   - Al finalizar el culto, haga clic en el botón **"Detener Transmisión"**.
   - Confirme en pantalla la finalización del servicio.

3. **Grabación Local en Disco:**
   - Puede iniciar la grabación local con el botón **"Iniciar Grabación"** (se almacena directamente en el disco duro NVMe de la iglesia en formato MP4 de alta fidelidad).

---

## 4. Qué Puede y Qué NO Puede Hacer desde este Panel

### ✅ Lo que SÍ puede hacer:
- **Avanzar y retroceder diapositivas** de canciones, sermones y pasajes bíblicos.
- **Botones de emergencia:** Poner la pantalla en Negro (F1), Limpiar capas, proyectar el Logotipo o Congelar la salida.
- **Conmutar escenas del estudio:** Cambiar entre escena de predicador, diapositiva completa, planos divididos, etc., con transiciones por corte o fundido suave.
- **Monitoreo de programa en vivo:** Ver la salida principal en tiempo real con baja latencia (capturas JPEG periódicas a 320x180).
- **Monitorear cámaras móviles:** Supervisar FPS, bitrate, nivel de batería y activar/silenciar micrófonos de los teléfonos conectados vía `/cam`.
- **Enviar mensajes rápidos:** Avisar al predicador ("Quedan 5 minutos") o alertar a la congregación ("Vehículo mal estacionado").
- **Controlar temporizadores:** Iniciar, pausar y reiniciar la cuenta regresiva del culto o del mensaje.

### ❌ Lo que NO puede hacer (Restricciones de Seguridad):
- **No puede editar la biblioteca de canciones ni Biblias:** El panel es exclusivamente para operación en vivo. La edición de letras se realiza en la iglesia.
- **No puede cambiar los códigos PIN** de acceso ni revocar dispositivos emparejados.
- **No puede gestionar certificados SSL ni eliminar archivos** del sistema operativo de la iglesia.

---

## 5. Protocolo de Comunicación ante Fallas

Si durante el servicio ocurre una incidencia técnica (corte de energía en la iglesia, pérdida de internet local o fallo de audio):

1. **Observe los indicadores superiores:**
   - Punto Verde = Enlace óptimo.
   - Punto Ámbar = Latencia superior a 200 ms (la tasa de cuadros del monitor se reducirá automáticamente para dar prioridad a los comandos).
   - Punto Rojo = Conexión perdida con la iglesia.
2. **Pase a escena segura:** Si una cámara móvil se corta, el sistema conmuta automáticamente al logotipo de la iglesia.
3. **Canal de respaldo:** Comuníquese de inmediato vía WhatsApp o llamada telefónica con el operador presencial o el encargado de sonido en la cabina de la iglesia.
