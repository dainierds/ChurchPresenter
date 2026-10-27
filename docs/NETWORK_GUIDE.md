# Guía de Red y Seguridad AV para ChurchPresenter (Ambientes de Iglesia)

Esta guía describe las mejores prácticas y recomendaciones de infraestructura de red para operar ChurchPresenter en un entorno de iglesia o auditorio, protegiendo tanto la estabilidad de la transmisión/proyección como la seguridad de los equipos.

---

## 1. Segmentación de Red y VLANs Dedicadas

### El Riesgo de una Red Única Compartida
En muchas congregaciones, la misma red Wi-Fi o segmento de red es utilizado por la congregación general (invitados), la administración de la iglesia, el equipo pastoral y el equipo técnico de sonido y video (AV).
- **Problema de congestión:** Cuando cientos de asistentes conectan sus teléfonos móviles al inicio del servicio, el tráfico de fondo (actualizaciones automáticas, redes sociales, copias de seguridad en la nube) agota el ancho de banda y llena las tablas ARP de los conmutadores/routers.
- **Riesgo de intrusión y colisión:** Cualquier dispositivo conectado a la misma red puede escanear puertos abiertos, enviar paquetes de difusión masiva (broadcast storms) o intentar adivinar contraseñas/PINes de los servidores de presentación y mesas de audio digital (Dante, Behringer X32/Wing, Allen&Heath).

### Recomendación de Topología: VLAN AV Aislada
Se recomienda crear al menos tres redes virtuales (VLANs) independientes:
1. **VLAN AV / Producción (Recomendada para ChurchPresenter):**
   - Exclusiva para la computadora de proyección, consolas de sonido digitales, cámaras PTZ, streamers de video (OBS/vMix) y las tabletas/móviles autorizados (pastor, directores de alabanza, operadores técnicos).
   - SSID Wi-Fi oculto o exclusivo (p. ej., `Iglesia_Produccion_5G`) con cifrado WPA3 o WPA2-Enterprise.
   - Aislamiento respecto a la red pública de invitados.
2. **VLAN Administrativa:**
   - Computadoras de oficina, contabilidad y sistemas pastorales.
3. **VLAN Invitados (Guest):**
   - Con aislamiento de clientes (*Client Isolation* activado) para impedir que los dispositivos se vean entre sí. Ancho de banda limitado por dispositivo.

---

## 2. Configuración del Firewall de Windows (Host)

Cuando ChurchPresenter activa el módulo de **Control Remoto** en el puerto TCP `8080` (o el puerto configurado):
1. **Regla de Firewall Inbound (Entrante):**
   - Windows Defender Firewall debe permitir el tráfico entrante para el binario de la aplicación o específicamente para el puerto TCP configurado (`8080`).
2. **Perfil de Red en Windows:**
   - En Windows 10 y Windows 11, la conexión de red (Wi-Fi o Ethernet) debe establecerse en **"Red privada"** (*Private network*).
   - En perfiles marcados como **"Red pública"**, Windows bloquea de manera predeterminada todas las conexiones entrantes no solicitadas, impidiendo que los teléfonos o tablets alcancen la interfaz web de ChurchPresenter.
   - ChurchPresenter detecta automáticamente si la conexión activa se encuentra en perfil "Público" y muestra una advertencia en la pestaña de Configuración.
3. **Comando de verificación en PowerShell (Administrador):**
   ```powershell
   Get-NetConnectionProfile
   # Para cambiar el perfil a Privada si está en Pública:
   Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
   ```

---

## 3. Direccionamiento IP Estático y Reserva DHCP

Para garantizar que los códigos QR y los accesos directos guardados en los dispositivos móviles no queden obsoletos semana a semana:
- **Reserva DHCP en el Router:** En el panel del router de la iglesia, vincule la dirección física MAC de la computadora de proyección a una dirección IP fija (por ejemplo, `192.168.1.150`).
- **Ventaja:** Evita que el servidor cambie de dirección IP cada vez que la máquina se reinicia o reconecta a la red.

---

## 4. Riesgos de HTTP en Redes Locales y Mitigación

El servidor web integrado de ChurchPresenter opera sobre HTTP en texto claro en el puerto de red local.
- **Riesgo:** En una red Wi-Fi no cifrada o pública, los tokens de sesión y el tráfico de diapositivas podrían ser interceptados mediante técnicas de captura de paquetes (*sniffing*).
- **Medidas de Mitigación implementadas en ChurchPresenter:**
  1. **Control de Origen en WebSockets:** Se rechazan conexiones que no provengan explícitamente del propio servidor local o de direcciones IP LAN de confianza.
  2. **Tokens Efímeros y Expiración:** Cada sesión autenticada tiene un tiempo de vida máximo (TTL de 24 horas). Al regenerar el PIN desde el panel del operador, todas las sesiones activas son expulsadas de inmediato con el código de cierre `4001`.
  3. **Protección contra Fuerza Bruta:** Bloqueo automático por dirección IP tras múltiples intentos fallidos de PIN. El bloqueo afecta únicamente a la dirección atacante y **nunca** interrumpe el uso de la aplicación por parte del operador local.
  4. **Separación de Privilegios:** Los clientes conectados por la interfaz web remota solo tienen acceso a comandos de proyección en vivo (diapositiva siguiente/anterior, salto a elemento de playlist, capas, temporizadores). Tienen **estrictamente prohibido** alterar configuraciones del sistema, eliminar canciones, importar/exportar bibliotecas o gestionar dispositivos.
  5. **Visor de Escenario (/stage):** Por defecto exige autenticación de solo lectura mediante token o PIN. La opción para permitir acceso sin PIN debe habilitarse conscientemente por el operador.

---

## 5. Recomendaciones de Frecuencia Wi-Fi (2.4 GHz vs 5 GHz)

- **Priorizar 5 GHz:** Las bandas de 2.4 GHz suelen estar saturadas por microondas, teléfonos de los asistentes y dispositivos Bluetooth. Para las tablets de escenario y teléfonos del equipo pastoral, utilice un punto de acceso (AP) con banda de **5 GHz**, garantizando latencias inferiores a 50 milisegundos para el cambio de diapositivas y avisos de retorno.
- **Ethernet para el Servidor:** La computadora principal que corre ChurchPresenter debe conectarse preferentemente por cable Ethernet (Cat 6 / Cat 6a) directo al conmutador principal de la red AV.
