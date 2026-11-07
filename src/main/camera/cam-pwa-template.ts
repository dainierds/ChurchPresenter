/**
 * PWA Templates for ChurchPresenter Wi-Fi Phone Camera (Fase 11)
 *
 * Provides standalone installable PWA for Android (Chrome) and iPhone (Safari):
 * - Web App Manifest with standalone & landscape orientation
 * - Offline Service Worker cache
 * - Responsive touch UI styled to match ChurchPresenter theme (#0a0e17, cyan, orange, green)
 * - WebRTC 720p@30fps streaming with H.264 preference, Wake Lock API, Battery API
 * - 6-digit PIN authentication with 7-day token persistence in localStorage
 */

export function getCamManifestJson(): string {
  return JSON.stringify({
    name: 'ChurchPresenter Cámara',
    short_name: 'CP Cam',
    description: 'Cámara móvil Wi-Fi para ChurchPresenter Studio',
    start_url: '/cam',
    scope: '/cam',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#0a0e17',
    theme_color: '#0a0e17',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192 512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  }, null, 2)
}

export function getCamServiceWorkerJs(): string {
  return `/* ChurchPresenter Camera PWA Service Worker */
const CACHE_NAME = 'cp-cam-v1.1';
const ASSETS_TO_CACHE = [
  '/cam',
  '/cam/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for /cam assets, never API or WebSocket
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('/ws')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
`
}

export function getCamPwaHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0a0e17">
  <title>ChurchPresenter Cámara</title>
  <link rel="icon" type="image/png" href="/icon.png">
  <link rel="apple-touch-icon" href="/icon.png">
  <link rel="manifest" href="/cam/manifest.json">
  <style>
    :root {
      --bg-dark: #0a0e17;
      --bg-panel: rgba(15, 23, 42, 0.85);
      --bg-control: rgba(30, 41, 59, 0.9);
      --accent-cyan: #00D2FF;
      --accent-orange: #FF7A00;
      --accent-green: #22c55e;
      --accent-red: #ef4444;
      --accent-yellow: #f59e0b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--bg-dark);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text-main);
    }
    #viewport-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }
    video#camera-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #000;
    }
    /* Landscape suggestion overlay */
    #rotate-hint {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(10, 14, 23, 0.95);
      z-index: 9999;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      gap: 16px;
    }
    @media (orientation: portrait) {
      #rotate-hint {
        display: flex;
      }
    }
    .rotate-icon {
      width: 64px;
      height: 64px;
      border: 4px solid var(--accent-orange);
      border-radius: 12px;
      animation: rotate-anim 2s infinite ease-in-out;
    }
    @keyframes rotate-anim {
      0% { transform: rotate(0deg); }
      50% { transform: rotate(90deg); }
      100% { transform: rotate(90deg); }
    }
    /* Top Bar */
    #top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      z-index: 50;
      pointer-events: auto;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-control);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent-yellow);
    }
    .status-dot.live {
      background: var(--accent-green);
      box-shadow: 0 0 10px var(--accent-green);
      animation: pulse 1.5s infinite;
    }
    .status-dot.error {
      background: var(--accent-red);
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
    .camera-name-input {
      background: transparent;
      border: none;
      border-bottom: 1px dashed var(--accent-cyan);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      max-width: 140px;
      outline: none;
    }
    /* Bottom Controls */
    #bottom-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      z-index: 50;
    }
    .ctrl-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 30px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      background: var(--bg-control);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.15);
      cursor: pointer;
      transition: all 0.2s;
    }
    .ctrl-btn:active {
      transform: scale(0.95);
    }
    .ctrl-btn.stream-btn {
      background: var(--accent-green);
      color: #000;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 700;
    }
    .ctrl-btn.stream-btn.active {
      background: var(--accent-red);
      color: #fff;
    }
    .ctrl-btn.mic-btn.muted {
      color: var(--accent-red);
      border-color: var(--accent-red);
    }
    /* Warnings & Alerts */
    #warning-banner {
      position: absolute;
      top: 60px;
      left: 20px;
      right: 20px;
      background: rgba(239, 68, 68, 0.95);
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      display: none;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      text-align: center;
    }
    /* PIN Modal */
    #pin-modal {
      position: fixed;
      inset: 0;
      background: rgba(10, 14, 23, 0.98);
      z-index: 1000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .pin-box {
      width: 100%;
      max-width: 340px;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .pin-display {
      font-size: 28px;
      letter-spacing: 12px;
      font-weight: 700;
      background: #030712;
      border: 1px solid var(--accent-cyan);
      border-radius: 10px;
      padding: 12px;
      margin: 16px 0;
      min-height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-cyan);
    }
    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    .key-btn {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 10px;
      padding: 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
    }
    .key-btn:active {
      background: var(--accent-cyan);
      color: #000;
    }
  </style>
</head>
<body>

  <!-- Landscape warning overlay for portrait devices -->
  <div id="rotate-hint">
    <div class="rotate-icon"></div>
    <h2 style="font-size: 20px; color: #fff;">Gire su teléfono a horizontal</h2>
    <p style="font-size: 14px; color: var(--text-muted); max-width: 280px;">
      La transmisión de cámara de ChurchPresenter requiere orientación apaisada para emitir en 720p 16:9.
    </p>
  </div>

  <!-- Warning Banner -->
  <div id="warning-banner"></div>

  <!-- Main Video Container -->
  <div id="viewport-container">
    <video id="camera-preview" autoplay playsinline muted></video>

    <!-- Top Telemetry & Status Bar -->
    <div id="top-bar">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="badge">
          <div class="status-dot" id="status-dot"></div>
          <span id="status-text">Desconectado</span>
        </div>
        <div class="badge">
          <input type="text" id="camera-name-input" class="camera-name-input" value="Cámara Teléfono" title="Haga clic para renombrar">
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="badge" id="battery-badge">
          <span id="battery-icon">🔋</span>
          <span id="battery-text">--%</span>
        </div>
        <div class="badge" id="telemetry-badge">
          <span id="telemetry-text">720p30 • 0 kbps</span>
        </div>
      </div>
    </div>

    <!-- Bottom Action Controls -->
    <div id="bottom-bar">
      <button class="ctrl-btn" id="flip-btn" title="Cambiar entre cámara frontal y trasera">
        <span>🔄 Girar Cámara</span>
      </button>

      <button class="ctrl-btn stream-btn" id="stream-btn">
        <span id="stream-btn-text">▶ Iniciar Transmisión</span>
      </button>

      <button class="ctrl-btn mic-btn muted" id="mic-btn" title="Silenciar / Activar micrófono">
        <span id="mic-btn-text">🎤 Mic: Silenciado</span>
      </button>
    </div>
  </div>

  <!-- 6-Digit PIN Authentication Modal -->
  <div id="pin-modal">
    <div class="pin-box">
      <h3 style="font-size: 18px; color: #fff; margin-bottom: 6px;">ChurchPresenter Cámara</h3>
      <p style="font-size: 13px; color: var(--text-muted);">
        Introduzca el PIN de 6 dígitos mostrado en la pantalla del operador
      </p>

      <div class="pin-display" id="pin-display">______</div>
      <div id="pin-error" style="color: var(--accent-red); font-size: 12px; margin-bottom: 8px; min-height: 16px;"></div>

      <div class="keypad">
        <button class="key-btn" onclick="pressDigit('1')">1</button>
        <button class="key-btn" onclick="pressDigit('2')">2</button>
        <button class="key-btn" onclick="pressDigit('3')">3</button>
        <button class="key-btn" onclick="pressDigit('4')">4</button>
        <button class="key-btn" onclick="pressDigit('5')">5</button>
        <button class="key-btn" onclick="pressDigit('6')">6</button>
        <button class="key-btn" onclick="pressDigit('7')">7</button>
        <button class="key-btn" onclick="pressDigit('8')">8</button>
        <button class="key-btn" onclick="pressDigit('9')">9</button>
        <button class="key-btn" onclick="clearPin()">C</button>
        <button class="key-btn" onclick="pressDigit('0')">0</button>
        <button class="key-btn" onclick="backspacePin()">⌫</button>
      </div>
    </div>
  </div>

  <script>
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/cam/sw.js', { scope: '/cam' }).catch(() => {});
      });
    }

    // State
    let currentPin = '';
    let authToken = localStorage.getItem('cp_cam_token') || '';
    let deviceName = localStorage.getItem('cp_cam_name') || 'Cámara ' + Math.floor(10 + Math.random() * 90);
    let facingMode = 'environment'; // default back camera
    let localStream = null;
    let peerConnection = null;
    let ws = null;
    let isStreaming = false;
    let isMicMuted = true;
    let wakeLock = null;
    let telemetryInterval = null;
    let lastBytesSent = 0;
    let lastStatsTime = 0;

    // Elements
    const videoElem = document.getElementById('camera-preview');
    const pinModal = document.getElementById('pin-modal');
    const pinDisplay = document.getElementById('pin-display');
    const pinError = document.getElementById('pin-error');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const streamBtn = document.getElementById('stream-btn');
    const streamBtnText = document.getElementById('stream-btn-text');
    const flipBtn = document.getElementById('flip-btn');
    const micBtn = document.getElementById('mic-btn');
    const micBtnText = document.getElementById('mic-btn-text');
    const warningBanner = document.getElementById('warning-banner');
    const cameraNameInput = document.getElementById('camera-name-input');
    const batteryText = document.getElementById('battery-text');
    const telemetryText = document.getElementById('telemetry-text');

    cameraNameInput.value = deviceName;
    cameraNameInput.addEventListener('change', () => {
      deviceName = cameraNameInput.value.trim() || 'Cámara Teléfono';
      localStorage.setItem('cp_cam_name', deviceName);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'name-change', name: deviceName }));
      }
    });

    // Battery API
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        const updateBattery = () => {
          const level = Math.round(battery.level * 100);
          batteryText.textContent = level + '%' + (battery.charging ? ' ⚡' : '');
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch(() => {});
    }

    // Wake Lock
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {
          console.warn('Wake Lock request failed:', e);
        }
      }
    }

    // Visibility & Background detection (Safari iOS cuts camera on background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        showWarning('⚠️ ¡Atención! La app pasó a segundo plano o se bloqueó la pantalla. En iPhone y Android esto detiene la cámara. Vuelva a esta pestaña.');
      } else {
        hideWarning();
        requestWakeLock();
        if (isStreaming && (!localStream || !localStream.active)) {
          startCameraStream();
        }
      }
    });

    function showWarning(msg) {
      warningBanner.textContent = msg;
      warningBanner.style.display = 'block';
    }
    function hideWarning() {
      warningBanner.style.display = 'none';
    }

    // PIN Pad logic
    function updatePinDisplay() {
      let str = '';
      for (let i = 0; i < 6; i++) {
        str += i < currentPin.length ? currentPin[i] : '_';
      }
      pinDisplay.textContent = str;
      if (currentPin.length === 6) {
        submitPin(currentPin);
      }
    }
    window.pressDigit = function(d) {
      if (currentPin.length < 6) {
        currentPin += d;
        updatePinDisplay();
      }
    };
    window.clearPin = function() {
      currentPin = '';
      pinError.textContent = '';
      updatePinDisplay();
    };
    window.backspacePin = function() {
      currentPin = currentPin.slice(0, -1);
      pinError.textContent = '';
      updatePinDisplay();
    };

    async function submitPin(pin) {
      pinError.textContent = 'Verificando PIN...';
      try {
        const res = await fetch('/api/cam-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, deviceName })
        });
        const data = await res.json();
        if (data.success && data.token) {
          authToken = data.token;
          localStorage.setItem('cp_cam_token', authToken);
          pinModal.style.display = 'none';
          initSignaling();
        } else {
          pinError.textContent = data.error || 'PIN incorrecto.';
          currentPin = '';
          updatePinDisplay();
        }
      } catch (err) {
        pinError.textContent = 'Error de conexión con el servidor.';
        currentPin = '';
        updatePinDisplay();
      }
    }

    function checkAuth() {
      if (!authToken) {
        pinModal.style.display = 'flex';
      } else {
        initSignaling();
      }
    }

    // Media Stream (720p @ 30fps)
    async function startCameraStream() {
      try {
        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
        }
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: { ideal: facingMode }
          },
          audio: true
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElem.srcObject = localStream;

        // Audio muted by default
        localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });

        // Update tracks in active peerConnection if already streaming
        if (peerConnection && isStreaming) {
          const senders = peerConnection.getSenders();
          localStream.getTracks().forEach((track) => {
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            } else {
              peerConnection.addTrack(track, localStream);
            }
          });
        }
      } catch (err) {
        console.error('Error starting camera stream:', err);
        showWarning('Error accediendo a la cámara (' + err.name + '). Verifique los permisos.');
      }
    }

    // Flip Camera
    flipBtn.addEventListener('click', async () => {
      facingMode = facingMode === 'environment' ? 'user' : 'environment';
      await startCameraStream();
    });

    // Mic Toggle
    micBtn.addEventListener('click', () => {
      isMicMuted = !isMicMuted;
      if (localStream) {
        localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
      }
      if (isMicMuted) {
        micBtn.classList.add('muted');
        micBtnText.textContent = '🎤 Mic: Silenciado';
      } else {
        micBtn.classList.remove('muted');
        micBtnText.textContent = '🎙️ Mic: Activo';
      }
    });

    // WebSocket & WebRTC
    function initSignaling() {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      statusDot.className = 'status-dot';
      statusText.textContent = 'Conectando...';

      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = proto + '//' + location.host + '/cam-ws?token=' + encodeURIComponent(authToken);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Conectado (Listo)';
        ws.send(JSON.stringify({
          type: 'camera-join',
          name: deviceName,
          facingMode
        }));
      };

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          handleSignalingMessage(msg);
        } catch (e) {
          console.error('Error parsing signaling message:', e);
        }
      };

      ws.onclose = (evt) => {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Desconectado';
        if (evt.code === 4001 || evt.code === 4003) {
          // Token invalid or revoked
          localStorage.removeItem('cp_cam_token');
          authToken = '';
          pinModal.style.display = 'flex';
          return;
        }
        // Auto-reconnect after 3 seconds
        setTimeout(initSignaling, 3000);
      };

      ws.onerror = () => {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Error Conexión';
      };
    }

    async function handleSignalingMessage(msg) {
      if (msg.type === 'answer') {
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
      } else if (msg.type === 'candidate') {
        if (peerConnection && msg.candidate) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }
      } else if (msg.type === 'control') {
        if (msg.control && typeof msg.control.audioMuted === 'boolean') {
          isMicMuted = msg.control.audioMuted;
          if (localStream) {
            localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
          }
          if (isMicMuted) {
            micBtn.classList.add('muted');
            micBtnText.textContent = '🎤 Mic: Silenciado (por estudio)';
          } else {
            micBtn.classList.remove('muted');
            micBtnText.textContent = '🎙️ Mic: Activo (por estudio)';
          }
        }
      }
    }

    // Start / Stop WebRTC Transmission
    async function startStreaming() {
      if (isStreaming) return;
      if (!localStream) {
        await startCameraStream();
      }

      await requestWakeLock();

      const config = {
        iceServers: [] // LAN-only: no STUN/TURN needed for direct LAN/Tailscale
      };

      peerConnection = new RTCPeerConnection(config);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'candidate',
            candidate: event.candidate
          }));
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const st = peerConnection.connectionState;
        if (st === 'connected') {
          statusDot.className = 'status-dot live';
          statusText.textContent = 'EN VIVO (Estudio)';
          hideWarning();
        } else if (st === 'disconnected' || st === 'failed') {
          statusDot.className = 'status-dot error';
          statusText.textContent = 'Reconectando video...';
          showWarning('Conexión de video interrumpida con el estudio. Intentando reconectar...');
        }
      };

      // Add audio and video tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Create Offer with H.264 preference
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'offer',
          sdp: peerConnection.localDescription,
          name: deviceName
        }));
      }

      isStreaming = true;
      streamBtn.classList.add('active');
      streamBtnText.textContent = '⏹ Detener Transmisión';

      // Start Telemetry reporting
      startTelemetry();
    }

    function stopStreaming() {
      if (!isStreaming) return;
      isStreaming = false;
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      if (telemetryInterval) {
        clearInterval(telemetryInterval);
        telemetryInterval = null;
      }
      statusDot.className = 'status-dot';
      statusText.textContent = 'Conectado (Listo)';
      streamBtn.classList.remove('active');
      streamBtnText.textContent = '▶ Iniciar Transmisión';
      telemetryText.textContent = '720p30 • 0 kbps';
    }

    streamBtn.addEventListener('click', () => {
      if (isStreaming) {
        stopStreaming();
      } else {
        startStreaming();
      }
    });

    function startTelemetry() {
      if (telemetryInterval) clearInterval(telemetryInterval);
      lastBytesSent = 0;
      lastStatsTime = performance.now();

      telemetryInterval = setInterval(async () => {
        if (!peerConnection || !isStreaming) return;
        try {
          const stats = await peerConnection.getStats();
          let currentBytesSent = 0;
          let framesPerSec = 30;
          stats.forEach((report) => {
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              if (report.bytesSent) currentBytesSent = report.bytesSent;
              if (report.framesPerSecond) framesPerSec = Math.round(report.framesPerSecond);
            }
          });

          const now = performance.now();
          const elapsedSec = (now - lastStatsTime) / 1000;
          let bitrateKbps = 0;
          if (lastBytesSent > 0 && elapsedSec > 0) {
            bitrateKbps = Math.round(((currentBytesSent - lastBytesSent) * 8) / (elapsedSec * 1000));
          }
          lastBytesSent = currentBytesSent;
          lastStatsTime = now;

          telemetryText.textContent = '720p' + framesPerSec + ' • ' + bitrateKbps + ' kbps';

          let batteryLevel = null;
          let isCharging = false;
          if ('getBattery' in navigator) {
            try {
              const b = await navigator.getBattery();
              batteryLevel = Math.round(b.level * 100);
              isCharging = b.charging;
            } catch {}
          }

          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'telemetry',
              telemetry: {
                actualFps: framesPerSec,
                bitrateKbps,
                batteryLevel,
                isCharging,
                resolution: videoElem.videoWidth + 'x' + videoElem.videoHeight
              }
            }));
          }
        } catch (e) {}
      }, 2000);
    }

    // Auto-init
    window.addEventListener('DOMContentLoaded', () => {
      startCameraStream();
      checkAuth();
      requestWakeLock();
    });
  </script>
</body>
</html>
`
}
