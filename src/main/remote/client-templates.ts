/**
 * Embedded Web Client Templates for ChurchPresenter Remote Control & Tablet Stage Monitor.
 * Completely self-contained: zero external CDNs required for intranet / LAN environments.
 * Built with Dark UI Professional styling: Carbon (#121212), Neon Green (#22c55e), Orange (#f97316), Cyan (#38bdf8).
 */

export function getRemoteControlHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="icon" type="image/png" href="/icon.png">
  <link rel="apple-touch-icon" href="/icon.png">
  <title>ChurchPresenter Remote</title>
  <style>
    :root {
      --bg-main: #121212;
      --bg-panel: #181818;
      --bg-card: #222222;
      --bg-card-hover: #2a2a2a;
      --border-subtle: #2d2d2d;
      --border-strong: #3e3e3e;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent-orange: #f97316;
      --accent-green: #22c55e;
      --accent-cyan: #38bdf8;
      --accent-red: #ef4444;
      --accent-yellow: #fbbf24;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-main);
      color: var(--text-main);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }
    /* Header */
    header {
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border-subtle);
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .brand { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
    .brand span { color: var(--accent-orange); }
    .status-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 12px;
      background: #1e293b;
      color: var(--accent-cyan);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-green); }
    .status-dot.disconnected { background: var(--accent-red); }

    /* Emergency Layer Action Bar */
    .emergency-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 8px 12px;
      background: #151515;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .clear-layers-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
      padding: 6px 12px;
      background: #181818;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .btn-action {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 9px 4px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }
    .btn-action:active { transform: scale(0.96); }
    .btn-action.active-black { background: #b91c1c; border-color: #ef4444; color: #fff; }
    .btn-action.active-clear { background: #d97706; border-color: #f59e0b; color: #fff; }
    .btn-action.active-logo { background: #0284c7; border-color: #38bdf8; color: #fff; }
    .btn-action.active-freeze { background: #0d9488; border-color: #14b8a6; color: #fff; }

    .btn-layer-clear {
      background: #1f1f1f;
      border: 1px solid #333;
      color: #94a3b8;
      padding: 6px 2px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      text-align: center;
    }
    .btn-layer-clear:active { background: #333; color: #fff; }

    /* Navigation Quick Controls */
    .quick-nav {
      display: grid;
      grid-template-columns: 1fr 1.2fr 1.2fr 1fr;
      gap: 6px;
      padding: 8px 12px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .btn-nav {
      background: #202020;
      border: 1px solid var(--border-strong);
      color: var(--text-main);
      padding: 12px 4px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
    }
    .btn-nav:active { background: #2e2e2e; }
    .btn-nav.primary { background: #262626; border-color: var(--accent-orange); color: var(--accent-orange); }

    /* Main Scrollable Content */
    main {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      -webkit-overflow-scrolling: touch;
    }

    /* Live Preview Card */
    .preview-card {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px;
      border-left: 4px solid var(--accent-green);
    }
    .preview-label { font-size: 11px; text-transform: uppercase; color: var(--accent-green); font-weight: 700; margin-bottom: 6px; }
    .preview-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .preview-body { font-size: 15px; line-height: 1.4; color: #e5e7eb; white-space: pre-wrap; }

    /* Next Slide Card */
    .next-card {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px;
      border-left: 4px solid var(--accent-orange);
    }
    .next-label { font-size: 11px; text-transform: uppercase; color: var(--accent-orange); font-weight: 700; margin-bottom: 4px; }
    .next-body { font-size: 13px; color: var(--text-muted); white-space: pre-wrap; line-height: 1.3; }

    /* Tabs Bar */
    .tab-bar {
      display: flex;
      background: #161616;
      border-top: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 12px 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      border-top: 2px solid transparent;
    }
    .tab-btn.active {
      color: var(--accent-orange);
      border-top-color: var(--accent-orange);
      background: #1c1c1c;
    }

    /* Slides Grid */
    .slides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
    }
    .slide-item {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 10px;
      min-height: 90px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.15s;
    }
    .slide-item:active { transform: scale(0.97); }
    .slide-item.active {
      border-color: var(--accent-green);
      box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4);
      background: #142217;
    }
    .slide-item-title { font-size: 11px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 4px; }
    .slide-item-text { font-size: 12px; color: #d1d5db; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.25; }

    /* Playlist Items List */
    .playlist-list { display: flex; flex-direction: column; gap: 6px; }
    .playlist-item {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .playlist-item:active { background: var(--bg-card-hover); }
    .playlist-item.active { border-color: var(--accent-orange); background: #261b14; }
    .playlist-item-name { font-size: 14px; font-weight: 600; }
    .playlist-item-type { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }

    /* Timers & Messages Section */
    .box-section {
      background: var(--bg-panel);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px;
    }
    .box-title { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; }

    /* Auth Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.88);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }
    .modal-card {
      background: #1c1c1c;
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      padding: 24px;
      width: 100%;
      max-width: 360px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.9);
    }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .modal-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.4; }
    .pin-input {
      width: 100%;
      background: #111;
      border: 1px solid var(--border-strong);
      color: #fff;
      font-size: 28px;
      letter-spacing: 8px;
      text-align: center;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 14px;
      font-family: monospace;
      outline: none;
    }
    .pin-input:focus { border-color: var(--accent-orange); }
    .btn-submit {
      width: 100%;
      background: var(--accent-orange);
      color: #fff;
      border: none;
      padding: 14px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
    }
    .modal-error { color: var(--accent-red); font-size: 12px; margin-top: 10px; min-height: 18px; }
  </style>
</head>
<body>

  <!-- Auth Modal -->
  <div id="authModal" class="modal-overlay">
    <div class="modal-card">
      <div class="modal-title">Control Remoto ChurchPresenter</div>
      <div class="modal-desc">Ingrese el PIN numérico de 6 dígitos mostrado en la configuración del operador.</div>
      <input type="password" id="pinInput" class="pin-input" maxlength="6" inputmode="numeric" placeholder="••••••" autofocus />
      <button id="btnAuth" class="btn-submit" onclick="submitAuth()">Conectar</button>
      <div id="authError" class="modal-error"></div>
    </div>
  </div>

  <!-- Header -->
  <header>
    <div class="brand">CHURCH<span>PRESENTER</span></div>
    <div class="status-badge">
      <div id="statusDot" class="status-dot"></div>
      <span id="latencyDisplay">Conectando...</span>
    </div>
  </header>

  <!-- Emergency Actions (Negro, Limpiar, Logo, Congelar) -->
  <div class="emergency-bar">
    <button id="btnBlack" class="btn-action" onclick="toggleControl('black')">NEGRO</button>
    <button id="btnClear" class="btn-action" onclick="toggleControl('clear')">LIMPIAR</button>
    <button id="btnLogo" class="btn-action" onclick="toggleControl('logo')">LOGO</button>
    <button id="btnFreeze" class="btn-action" onclick="toggleControl('freeze')">CONGELAR</button>
  </div>

  <!-- Clear Individual Layers Strip -->
  <div class="clear-layers-bar">
    <button class="btn-layer-clear" onclick="clearLayer('background')">✕ Fondo</button>
    <button class="btn-layer-clear" onclick="clearLayer('slide')">✕ Diapo</button>
    <button class="btn-layer-clear" onclick="clearLayer('audio')">✕ Audio</button>
    <button class="btn-layer-clear" onclick="clearLayer('message')">✕ Mensaje</button>
  </div>

  <!-- Navigation Bar (Item Anterior, Diapo Anterior, Diapo Siguiente, Item Siguiente) -->
  <div class="quick-nav">
    <button class="btn-nav" onclick="prevItem()">⏮ Item</button>
    <button class="btn-nav" onclick="prevSlide()">◀ Diapo</button>
    <button class="btn-nav primary" onclick="nextSlide()">Diapo ▶</button>
    <button class="btn-nav" onclick="nextItem()">Item ⏭</button>
  </div>

  <!-- Main Content Tab Views -->
  <main id="mainContainer">
    <!-- View 1: En Vivo -->
    <div id="viewLive" style="display: flex; flex-direction: column; gap: 12px;">
      <div class="preview-card">
        <div class="preview-label">En Pantalla de Audiencia</div>
        <div id="liveTitle" class="preview-title">Sin diapositiva en vivo</div>
        <div id="liveBody" class="preview-body">Toque una diapositiva o presione Siguiente para proyectar.</div>
      </div>
      <div class="next-card">
        <div class="next-label">Próxima Diapositiva</div>
        <div id="nextBody" class="next-body">--</div>
      </div>
    </div>

    <!-- View 2: Diapositivas Grid -->
    <div id="viewSlides" style="display: none;">
      <div id="slidesGrid" class="slides-grid"></div>
    </div>

    <!-- View 3: Playlist -->
    <div id="viewPlaylist" style="display: none;">
      <div id="playlistList" class="playlist-list"></div>
    </div>

    <!-- View 4: Herramientas (Mensajes, Temporizadores, Video) -->
    <div id="viewTools" style="display: none; display: flex; flex-direction: column; gap: 12px;">
      <!-- Video Player Controls -->
      <div class="box-section">
        <div class="box-title">Control de Reproducción de Video</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px;">
          <button class="btn-action" onclick="controlVideoSeekRel(-15)">⏪ -15s</button>
          <button class="btn-action" style="background: var(--accent-green); color: #000;" onclick="controlVideoPlay()">▶ Play</button>
          <button class="btn-action" onclick="controlVideoPause()">⏸ Pausa</button>
          <button class="btn-action" onclick="controlVideoSeekRel(15)">⏩ +15s</button>
        </div>
      </div>

      <!-- Messages Section with Quick Library Presets -->
      <div class="box-section">
        <div class="box-title">Enviar Mensaje / Alerta</div>
        <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
          <button class="btn-layer-clear" onclick="setPresetMessage('Silencio en la sala por favor')">Silencio</button>
          <button class="btn-layer-clear" onclick="setPresetMessage('Vehículo mal estacionado')">Vehículo</button>
          <button class="btn-layer-clear" onclick="setPresetMessage('Aviso para los padres de niños')">Padres</button>
          <button class="btn-layer-clear" onclick="setPresetMessage('Culto de oración hoy a las 19:00')">Oración</button>
        </div>
        <input type="text" id="msgTextInput" placeholder="Escribir mensaje personalizado..." style="width: 100%; background: #111; border: 1px solid var(--border-subtle); color: #fff; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 14px;" />
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
          <select id="msgTargetSelect" style="background: #202020; border: 1px solid var(--border-subtle); color: #fff; padding: 8px; border-radius: 6px; font-size: 13px;">
            <option value="stage">Solo Escenario</option>
            <option value="audience">Solo Audiencia</option>
            <option value="both">Escenario y Audiencia</option>
          </select>
          <select id="msgDurationSelect" style="background: #202020; border: 1px solid var(--border-subtle); color: #fff; padding: 8px; border-radius: 6px; font-size: 13px;">
            <option value="0">Permanente (Manual)</option>
            <option value="15">15 segundos</option>
            <option value="30">30 segundos</option>
            <option value="60">60 segundos</option>
          </select>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-action" style="flex: 2; background: var(--accent-orange); color: #fff;" onclick="sendCustomMessage()">Publicar</button>
          <button class="btn-action" style="flex: 1;" onclick="clearActiveMessage()">Quitar</button>
        </div>
      </div>

      <!-- Timers Section -->
      <div class="box-section">
        <div class="box-title">Temporizador Activo</div>
        <div id="timerDisplay" style="font-size: 32px; font-weight: 700; font-family: monospace; color: var(--accent-green); text-align: center; margin-bottom: 10px;">00:00</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
          <button class="btn-action" onclick="controlTimer('start')">Iniciar</button>
          <button class="btn-action" onclick="controlTimer('pause')">Pausa</button>
          <button class="btn-action" onclick="controlTimer('reset')">Reiniciar</button>
        </div>
      </div>
    </div>
  </main>

  <!-- Bottom Navigation Tabs -->
  <div class="tab-bar">
    <button class="tab-btn active" onclick="switchTab('live')">En Vivo</button>
    <button class="tab-btn" onclick="switchTab('slides')">Diapositivas</button>
    <button class="tab-btn" onclick="switchTab('playlist')">Playlist</button>
    <button class="tab-btn" onclick="switchTab('tools')">Herramientas</button>
  </div>

  <script>
    let token = localStorage.getItem('cp_remote_token') || '';
    let ws = null;
    let pingInterval = null;
    let state = null;
    let currentPlaylist = [];
    let currentSlideItems = [];

    // Check token on load
    if (token) {
      connectWebSocket();
    } else {
      document.getElementById('authModal').style.display = 'flex';
    }

    async function submitAuth() {
      const pin = document.getElementById('pinInput').value.trim();
      const errBox = document.getElementById('authError');
      errBox.innerText = '';
      if (pin.length !== 6) {
        errBox.innerText = 'El PIN debe ser de 6 dígitos.';
        return;
      }
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, deviceName: navigator.userAgent.slice(0, 30) })
        });
        const data = await res.json();
        if (data.success && data.token) {
          token = data.token;
          localStorage.setItem('cp_remote_token', token);
          document.getElementById('authModal').style.display = 'none';
          connectWebSocket();
        } else {
          errBox.innerText = data.error || 'Autenticación fallida.';
        }
      } catch (err) {
        errBox.innerText = 'Error al conectar con el servidor.';
      }
    }

    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/ws?token=' + encodeURIComponent(token);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        document.getElementById('statusDot').className = 'status-dot';
        document.getElementById('authModal').style.display = 'none';
        startPing();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {}
      };

      ws.onclose = (event) => {
        document.getElementById('statusDot').className = 'status-dot disconnected';
        document.getElementById('latencyDisplay').innerText = 'Desconectado';
        stopPing();
        if (event.code === 4001) {
          localStorage.removeItem('cp_remote_token');
          token = '';
          document.getElementById('authModal').style.display = 'flex';
          document.getElementById('authError').innerText = 'Sesión revocada o PIN cambiado.';
        } else {
          setTimeout(connectWebSocket, 2000);
        }
      };
    }

    function startPing() {
      stopPing();
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const t0 = Date.now();
          ws.send(JSON.stringify({ type: 'ping', t0 }));
        }
      }, 3000);
    }

    function stopPing() {
      if (pingInterval) clearInterval(pingInterval);
    }

    function handleMessage(msg) {
      if (msg.type === 'pong') {
        const latency = Date.now() - (msg.t0 || Date.now());
        document.getElementById('latencyDisplay').innerText = latency + ' ms';
        return;
      }
      if (msg.type === 'init' || msg.type === 'state-update') {
        renderState(msg);
      }
    }

    function renderState(data) {
      if (data.state) {
        state = data.state;
        const c = state.controls || {};
        document.getElementById('btnBlack').className = 'btn-action ' + (c.black ? 'active-black' : '');
        document.getElementById('btnClear').className = 'btn-action ' + (c.clear ? 'active-clear' : '');
        document.getElementById('btnLogo').className = 'btn-action ' + (c.logo ? 'active-logo' : '');
        document.getElementById('btnFreeze').className = 'btn-action ' + (c.freeze ? 'active-freeze' : '');

        const cs = state.currentSlide;
        if (cs) {
          document.getElementById('liveTitle').innerText = cs.title || cs.subtitle || 'Sin título';
          document.getElementById('liveBody').innerText = cs.body || '';
          document.getElementById('nextBody').innerText = cs.nextSlideBody || '--';
        } else {
          document.getElementById('liveTitle').innerText = 'Sin diapositiva en vivo';
          document.getElementById('liveBody').innerText = 'Presione Siguiente para proyectar.';
          document.getElementById('nextBody').innerText = '--';
        }
      }

      if (data.currentSlideItems) {
        currentSlideItems = data.currentSlideItems;
        renderSlideGrid();
      }

      if (data.playlist) {
        currentPlaylist = data.playlist;
        renderPlaylist();
      }

      if (data.activeTimer) {
        document.getElementById('timerDisplay').innerText = data.activeTimer.formattedTime || '00:00';
      }
    }

    function renderSlideGrid() {
      const container = document.getElementById('slidesGrid');
      container.innerHTML = '';
      currentSlideItems.forEach((s, idx) => {
        const div = document.createElement('div');
        div.className = 'slide-item ' + (state && state.currentSlide && state.currentSlide.id === s.id ? 'active' : '');
        div.onclick = () => sendCommand({ type: 'send-slide', slide: s });
        div.innerHTML = '<div class="slide-item-title">' + (s.label || ('#' + (idx + 1))) + '</div><div class="slide-item-text">' + (s.body || '') + '</div>';
        container.appendChild(div);
      });
    }

    function renderPlaylist() {
      const container = document.getElementById('playlistList');
      container.innerHTML = '';
      currentPlaylist.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'playlist-item ' + (state && state.currentSlide && state.currentSlide.sourceId === item.id ? 'active' : '');
        div.onclick = () => sendCommand({ type: 'select-item', itemId: item.id });
        div.innerHTML = '<div class="playlist-item-name">' + item.title + '</div><div class="playlist-item-type">' + item.type + '</div>';
        container.appendChild(div);
      });
    }

    function sendCommand(cmd) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(cmd));
      }
    }

    function toggleControl(ctrl) { sendCommand({ type: 'global-control', action: ctrl }); }
    function clearLayer(layer) { sendCommand({ type: 'clear-layer', layer: layer }); }
    function nextSlide() { sendCommand({ type: 'next-slide' }); }
    function prevSlide() { sendCommand({ type: 'prev-slide' }); }
    function nextItem() { sendCommand({ type: 'next-item' }); }
    function prevItem() { sendCommand({ type: 'prev-item' }); }

    function controlVideoPlay() { sendCommand({ type: 'control-video', action: 'play' }); }
    function controlVideoPause() { sendCommand({ type: 'control-video', action: 'pause' }); }
    function controlVideoStop() { sendCommand({ type: 'control-video', action: 'stop' }); }
    function controlVideoSeekRel(sec) { sendCommand({ type: 'control-video', action: 'seek-rel', seconds: sec }); }

    function controlTimer(action) { sendCommand({ type: 'control-timer', action: action }); }
    function setPresetMessage(txt) { document.getElementById('msgTextInput').value = txt; }
    function sendCustomMessage() {
      const text = document.getElementById('msgTextInput').value.trim();
      const target = document.getElementById('msgTargetSelect').value;
      const durationSeconds = parseInt(document.getElementById('msgDurationSelect').value, 10);
      if (text) {
        sendCommand({ type: 'send-message', text, target, durationSeconds });
        document.getElementById('msgTextInput').value = '';
      }
    }
    function clearActiveMessage() { sendCommand({ type: 'clear-message' }); }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('viewLive').style.display = tabId === 'live' ? 'flex' : 'none';
      document.getElementById('viewSlides').style.display = tabId === 'slides' ? 'block' : 'none';
      document.getElementById('viewPlaylist').style.display = tabId === 'playlist' ? 'block' : 'none';
      document.getElementById('viewTools').style.display = tabId === 'tools' ? 'flex' : 'none';
    }
  </script>
</body>
</html>`;
}

export function getStageViewerHtml(options?: { requirePin?: boolean }): string {
  const requirePin = Boolean(options?.requirePin)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="icon" type="image/png" href="/icon.png">
  <link rel="apple-touch-icon" href="/icon.png">
  <title>ChurchPresenter Stage Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #000000;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      user-select: none;
    }
    #stageCanvas {
      position: relative;
      width: 100vw;
      height: 100vh;
      background-color: #000000;
    }
    .stage-element {
      position: absolute;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .stage-label {
      font-size: 1.8vmin;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 0.5vmin;
    }
    .stage-content {
      flex: 1;
      display: flex;
      white-space: pre-wrap;
      line-height: 1.25;
      word-break: break-word;
    }
    .stage-message-overlay {
      position: fixed;
      top: 2vmin;
      left: 5vw;
      right: 5vw;
      background: #dc2626;
      color: #ffffff;
      padding: 1.5vmin 3vmin;
      border-radius: 8px;
      font-size: 3.5vmin;
      font-weight: 800;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      z-index: 9999;
      display: none;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }

    /* Auth modal for PIN requirement */
    .stage-auth-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }
    .stage-auth-card {
      background: #181818;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 360px;
      text-align: center;
      color: #fff;
    }
    .stage-pin-input {
      width: 100%;
      background: #101010;
      border: 1px solid #444;
      color: #fff;
      font-size: 28px;
      letter-spacing: 8px;
      text-align: center;
      padding: 10px;
      border-radius: 8px;
      margin: 16px 0;
      font-family: monospace;
    }
    .btn-stage-auth {
      width: 100%;
      background: #f97316;
      color: #fff;
      border: none;
      padding: 12px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  ${requirePin ? `
  <div id="stageAuthModal" class="stage-auth-modal">
    <div class="stage-auth-card">
      <h2 style="font-size: 18px; margin-bottom: 6px;">Monitor de Escenario</h2>
      <p style="font-size: 13px; color: #9ca3af;">Ingrese el PIN del operador para habilitar el monitor en esta tableta.</p>
      <input type="password" id="stagePinInput" class="stage-pin-input" maxlength="6" inputmode="numeric" placeholder="••••••" autofocus />
      <button class="btn-stage-auth" onclick="submitStageAuth()">Acceder al Escenario</button>
      <div id="stageAuthError" style="color: #ef4444; font-size: 12px; margin-top: 8px;"></div>
    </div>
  </div>
  ` : ''}

  <div id="stageMessageOverlay" class="stage-message-overlay"></div>
  <div id="stageCanvas"></div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token') || localStorage.getItem('cp_stage_token') || '';
    const layoutParam = urlParams.get('layout') || '';

    let ws = null;
    let layout = null;
    let currentSlide = null;
    let activeTimers = [];
    let activeMessage = null;

    async function submitStageAuth() {
      const pin = document.getElementById('stagePinInput').value.trim();
      const errBox = document.getElementById('stageAuthError');
      errBox.innerText = '';
      if (pin.length !== 6) {
        errBox.innerText = 'El PIN debe ser de 6 dígitos.';
        return;
      }
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, role: 'stage-viewer', deviceName: 'Tableta Escenario' })
        });
        const data = await res.json();
        if (data.success && data.token) {
          token = data.token;
          localStorage.setItem('cp_stage_token', token);
          const modal = document.getElementById('stageAuthModal');
          if (modal) modal.style.display = 'none';
          connect();
        } else {
          errBox.innerText = data.error || 'Autenticación fallida.';
        }
      } catch {
        errBox.innerText = 'Error al conectar con el servidor.';
      }
    }

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = protocol + '//' + window.location.host + '/ws?role=stage-viewer';
      if (token) wsUrl += '&token=' + encodeURIComponent(token);
      if (layoutParam) wsUrl += '&layout=' + encodeURIComponent(layoutParam);

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const modal = document.getElementById('stageAuthModal');
        if (modal) modal.style.display = 'none';
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init' || msg.type === 'state-update') {
            if (msg.stageLayout) layout = msg.stageLayout;
            if (msg.state) currentSlide = msg.state.currentSlide;
            if (msg.activeTimer) activeTimers = [msg.activeTimer];
            if (msg.activeMessage !== undefined) activeMessage = msg.activeMessage;
            render();
          }
        } catch (e) {}
      };

      ws.onclose = (event) => {
        if (event.code === 4001 || event.code === 401) {
          localStorage.removeItem('cp_stage_token');
          token = '';
          const modal = document.getElementById('stageAuthModal');
          if (modal) modal.style.display = 'flex';
        } else {
          setTimeout(connect, 2000);
        }
      };
    }

    function render() {
      renderMessage();
      if (!layout) return;

      const canvas = document.getElementById('stageCanvas');
      canvas.style.backgroundColor = layout.backgroundColor || '#000000';
      canvas.innerHTML = '';

      (layout.elements || []).filter(e => e.visible).forEach(el => {
        const div = document.createElement('div');
        div.className = 'stage-element';
        div.style.left = el.x + '%';
        div.style.top = el.y + '%';
        div.style.width = el.width + '%';
        div.style.height = el.height + '%';

        let innerContent = '';
        let labelHtml = el.showLabel && el.label ? '<div class="stage-label">' + el.label + '</div>' : '';

        if (el.type === 'current-slide') {
          innerContent = currentSlide ? (currentSlide.body || '') : '';
        } else if (el.type === 'next-slide') {
          innerContent = currentSlide ? (currentSlide.nextSlideBody || '') : '';
        } else if (el.type === 'clock') {
          const now = new Date();
          innerContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (el.type === 'timers') {
          innerContent = activeTimers.length > 0 ? activeTimers[0].formattedTime : '00:00';
        } else if (el.type === 'notes') {
          innerContent = currentSlide && currentSlide.speakerNotes ? currentSlide.speakerNotes : '';
        } else if (el.type === 'messages') {
          innerContent = activeMessage && (activeMessage.target === 'stage' || activeMessage.target === 'both') ? activeMessage.text : '';
        }

        const alignStyle = el.alignment === 'center' ? 'center' : (el.alignment === 'right' ? 'flex-end' : 'flex-start');
        div.innerHTML = labelHtml + '<div class="stage-content" style="font-size: ' + (el.fontSizeVmin || 5) + 'vmin; color: ' + (el.fontColor || '#ffffff') + '; font-weight: ' + (el.fontWeight || '700') + '; justify-content: ' + alignStyle + '; text-align: ' + (el.alignment || 'left') + ';">' + innerContent + '</div>';
        canvas.appendChild(div);
      });
    }

    function renderMessage() {
      const overlay = document.getElementById('stageMessageOverlay');
      if (activeMessage && (activeMessage.target === 'stage' || activeMessage.target === 'both')) {
        overlay.innerText = activeMessage.text;
        overlay.style.display = 'block';
      } else {
        overlay.style.display = 'none';
      }
    }

    setInterval(() => {
      render();
    }, 1000);

    if (!${requirePin} || token) {
      connect();
    }
  </script>
</body>
</html>`;
}

/**
 * OBS Browser Source HTML template for ChurchPresenter outputs.
 * Designed for OBS Studio / vMix / Wirecast Browser Source.
 * Supports alpha channel transparency (?transparent=true) for direct overlay on camera.
 */
export function getObsBrowserSourceHtml(options: {
  role: string
  transparent?: boolean
  requirePin?: boolean
}): string {
  const { role, transparent = false, requirePin = false } = options
  const bgColor = transparent ? 'transparent' : '#000000'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080, initial-scale=1.0">
  <link rel="icon" type="image/png" href="/icon.png">
  <title>ChurchPresenter - OBS Browser Source (${role})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: ${bgColor} !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      user-select: none;
    }
    #viewport {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      transition: opacity 0.25s ease;
    }
    .slide-container {
      width: 90%;
      max-width: 1720px;
      margin: 0 auto;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .slide-body {
      font-size: 5.2vmin;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
      text-shadow: 0 3px 12px rgba(0, 0, 0, 0.95), 0 0 4px #000000, 0 1px 3px rgba(0, 0, 0, 0.8);
    }
    .slide-meta {
      margin-top: 2vmin;
      font-size: 2.4vmin;
      font-weight: 600;
      color: #38bdf8;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9), 0 0 3px #000000;
    }
    /* Props Overlay Layer */
    #propsLayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 50;
    }
    .prop-item {
      position: absolute;
      pointer-events: auto;
      transition: all 0.3s ease;
    }
    .prop-lower-third {
      background: rgba(18, 18, 18, 0.92);
      border-left: 6px solid #FF7A00;
      border-radius: 6px;
      padding: 1.5vmin 2.5vmin;
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    }
    .prop-lower-third-title {
      font-size: 2.6vmin;
      font-weight: 800;
      color: #FF7A00;
      margin-bottom: 0.4vmin;
    }
    .prop-lower-third-body {
      font-size: 2vmin;
      font-weight: 500;
      color: #f3f4f6;
      white-space: pre-wrap;
    }
    .prop-logo img {
      max-width: 15vmin;
      max-height: 15vmin;
      object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6));
    }
    .prop-countdown {
      background: rgba(10, 10, 10, 0.88);
      border: 1px solid #FF7A00;
      border-radius: 8px;
      padding: 1vmin 2vmin;
      font-size: 3.5vmin;
      font-weight: 800;
      font-family: monospace;
      color: #22c55e;
      box-shadow: 0 6px 18px rgba(0,0,0,0.8);
    }
    /* Message Overlay */
    #messageOverlay {
      position: absolute;
      top: 3vmin;
      left: 8vw;
      right: 8vw;
      background: rgba(220, 38, 38, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      color: #ffffff;
      padding: 1.5vmin 3vmin;
      font-size: 3.2vmin;
      font-weight: 800;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      z-index: 100;
      display: none;
      animation: msgPulse 1.5s infinite;
    }
    @keyframes msgPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
    .hidden { opacity: 0 !important; visibility: hidden !important; }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="slideBox" class="slide-container">
      <div id="slideBody" class="slide-body"></div>
      <div id="slideMeta" class="slide-meta"></div>
    </div>
    <div id="propsLayer"></div>
    <div id="messageOverlay"></div>
  </div>

  <script>
    const targetRole = "${role}";
    const isTransparent = ${transparent};
    const requirePin = ${requirePin};
    let token = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('cp_remote_token') || '';
    if (requirePin && !token) {
      console.warn('Authentication token required for OBS Browser Source connection');
    }
    let ws = null;
    let state = null;
    let activeProps = [];
    let activeMessage = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/ws' + (token ? '?token=' + encodeURIComponent(token) : '');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Connected
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {}
      };

      ws.onclose = () => {
        setTimeout(connect, 2000);
      };
    }

    function handleMessage(msg) {
      if (msg.type === 'init' || msg.type === 'state-update') {
        if (msg.state) state = msg.state;
        if (msg.activeProps) activeProps = msg.activeProps;
        if (msg.activeMessage !== undefined) activeMessage = msg.activeMessage;
        render();
      } else if (msg.type === 'slide-update') {
        if (state) state.currentSlide = msg.slide;
        render();
      } else if (msg.type === 'props-update') {
        activeProps = msg.activeProps || [];
        render();
      } else if (msg.type === 'message-update') {
        activeMessage = msg.message;
        render();
      }
    }

    function render() {
      const viewport = document.getElementById('viewport');
      const slideBox = document.getElementById('slideBox');
      const slideBody = document.getElementById('slideBody');
      const slideMeta = document.getElementById('slideMeta');
      const propsLayer = document.getElementById('propsLayer');
      const messageOverlay = document.getElementById('messageOverlay');

      if (!state) return;

      const c = state.controls || {};
      const isBlack = Boolean(c.black);
      const isClear = Boolean(c.clear);

      // Blackout hides everything
      if (isBlack) {
        viewport.className = 'hidden';
        return;
      } else {
        viewport.className = '';
      }

      // Slide Layer
      if (isClear || !state.currentSlide) {
        slideBox.className = 'slide-container hidden';
        slideBody.innerText = '';
        slideMeta.innerText = '';
      } else {
        slideBox.className = 'slide-container';
        const s = state.currentSlide;
        slideBody.innerText = s.body || '';
        slideMeta.innerText = s.title || s.subtitle || s.reference || '';
      }

      // Props Layer (respects targetRoles and Blackout/Clear)
      propsLayer.innerHTML = '';
      if (!isClear && Array.isArray(activeProps)) {
        activeProps.forEach((p) => {
          const roles = p.targetRoles || ['audience', 'main', 'program'];
          const matchesRole = roles.includes('all') || roles.includes(targetRole) || (targetRole === 'program' && roles.includes('audience')) || (targetRole === 'audience' && roles.includes('main'));
          if (!matchesRole) return;

          const propDiv = document.createElement('div');
          propDiv.className = 'prop-item';
          const pos = p.position || {};
          if (pos.alignment === 'bottomCenter' || pos.alignment === 'bottomLeft') {
            propDiv.style.bottom = (pos.offsetY || 5) + '%';
            propDiv.style.left = (pos.offsetX || 5) + '%';
          } else if (pos.alignment === 'topRight') {
            propDiv.style.top = (pos.offsetY || 5) + '%';
            propDiv.style.right = (pos.offsetX || 5) + '%';
          } else {
            propDiv.style.top = (pos.offsetY || 5) + '%';
            propDiv.style.left = (pos.offsetX || 5) + '%';
          }
          if (pos.widthPercent) propDiv.style.width = pos.widthPercent + '%';

          if (p.type === 'lower_third') {
            propDiv.className += ' prop-lower-third';
            const c = p.content || {};
            propDiv.innerHTML = '<div class="prop-lower-third-title">' + (c.title || '') + '</div><div class="prop-lower-third-body">' + (c.text || '') + '</div>';
          } else if (p.type === 'logo') {
            propDiv.className += ' prop-logo';
            const c = p.content || {};
            if (c.imageUrl) propDiv.innerHTML = '<img src="' + c.imageUrl + '" alt="Logo" />';
          } else if (p.type === 'countdown') {
            propDiv.className += ' prop-countdown';
            propDiv.innerText = p.content?.text || '05:00';
          } else if (p.type === 'text') {
            propDiv.style.color = '#ffffff';
            propDiv.style.fontSize = '3vmin';
            propDiv.style.fontWeight = '700';
            propDiv.innerText = p.content?.text || '';
          }
          propsLayer.appendChild(propDiv);
        });
      }

      // Message Overlay
      if (activeMessage && (activeMessage.target === 'audience' || activeMessage.target === 'both')) {
        messageOverlay.innerText = activeMessage.text;
        messageOverlay.style.display = 'block';
      } else {
        messageOverlay.style.display = 'none';
      }
    }

    connect();
  </script>
</body>
</html>`;
}

export function getSubtitlesSenderHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="icon" type="image/png" href="/icon.png">
  <link rel="apple-touch-icon" href="/icon.png">
  <title>Transcriptor en Vivo - ChurchPresenter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0A0A0A;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 650px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #262626;
      padding-bottom: 12px;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #38BDF8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 9999px;
      font-weight: 600;
      background: #262626;
      color: #94A3B8;
    }
    .status-badge.connected {
      background: rgba(34, 197, 94, 0.2);
      color: #22C55E;
      border: 1px solid #22C55E;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #94A3B8;
    }
    textarea, input[type="text"], input[type="number"] {
      width: 100%;
      background: #171717;
      border: 1px solid #333333;
      color: #FFFFFF;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.2s;
    }
    textarea:focus, input[type="text"]:focus, input[type="number"]:focus {
      border-color: #38BDF8;
    }
    textarea {
      min-height: 90px;
      resize: vertical;
    }
    .row {
      display: flex;
      gap: 12px;
    }
    .row > div {
      flex: 1;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    button {
      flex: 1;
      padding: 12px 16px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: opacity 0.2s, transform 0.1s;
    }
    button:active {
      transform: scale(0.98);
    }
    .btn-send {
      background: #22C55E;
      color: #0A0A0A;
    }
    .btn-clear {
      background: #FF7A00;
      color: #0A0A0A;
      flex: 0 0 140px;
    }
    .history-card {
      background: #141414;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 220px;
      overflow-y: auto;
    }
    .history-item {
      padding: 8px 10px;
      background: #1E1E1E;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      border-left: 3px solid #38BDF8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .history-item:hover {
      background: #262626;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>💬</span> Transcriptor en Vivo</h1>
      <span id="statusBadge" class="status-badge">Desconectado</span>
    </header>

    <div class="field-group">
      <label for="subText">Texto del Subtítulo (Español u Original)</label>
      <textarea id="subText" placeholder="Escriba el texto que se proyectará en vivo..." autofocus></textarea>
    </div>

    <div class="field-group">
      <label for="subTrans">Traducción Simultánea (Opcional)</label>
      <input type="text" id="subTrans" placeholder="Ej: For God so loved the world..." />
    </div>

    <div class="row">
      <div class="field-group">
        <label for="subDuration">Duración visible (segundos)</label>
        <input type="number" id="subDuration" value="5" min="2" max="60" />
      </div>
      <div class="field-group">
        <label>Destino de Pantallas</label>
        <div style="display: flex; gap: 10px; padding-top: 8px; font-size: 0.85rem;">
          <label><input type="checkbox" id="roleMain" checked /> Audiencia</label>
          <label><input type="checkbox" id="roleProgram" checked /> Transmisión</label>
          <label><input type="checkbox" id="roleStage" /> Escenario</label>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-send" id="btnSend">Enviar Subtítulo</button>
      <button class="btn-clear" id="btnClear">Limpiar</button>
    </div>

    <div class="field-group" style="margin-top: 12px;">
      <label>Historial de Frases Recientes (Tocar para re-enviar)</label>
      <div class="history-card" id="historyList">
        <div style="color: #64748B; font-size: 0.85rem; text-align: center; padding: 12px;">No hay frases enviadas recientemente</div>
      </div>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/ws' + (token ? '?token=' + encodeURIComponent(token) : '');

    let ws = null;
    const history = [];

    function connect() {
      const badge = document.getElementById('statusBadge');
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        badge.innerText = 'Error de conexión';
        badge.className = 'status-badge';
        return;
      }

      ws.onopen = () => {
        badge.innerText = 'En Línea';
        badge.className = 'status-badge connected';
      };

      ws.onclose = () => {
        badge.innerText = 'Reconectando...';
        badge.className = 'status-badge';
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        badge.innerText = 'Error';
        badge.className = 'status-badge';
      };
    }

    function sendSubtitle() {
      const text = document.getElementById('subText').value.trim();
      const translation = document.getElementById('subTrans').value.trim();
      const durationSec = parseInt(document.getElementById('subDuration').value, 10) || 5;

      if (!text) return;

      const targetRoles = [];
      if (document.getElementById('roleMain').checked) targetRoles.push('main', 'audience');
      if (document.getElementById('roleProgram').checked) targetRoles.push('program');
      if (document.getElementById('roleStage').checked) targetRoles.push('stage');

      const payload = {
        type: 'subtitle',
        text,
        translation: translation || undefined,
        targetRoles: targetRoles.length > 0 ? targetRoles : ['main', 'lobby'],
        durationSec
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }

      // Add to history
      history.unshift({ text, translation });
      if (history.length > 15) history.pop();
      renderHistory();

      // Clear input and focus
      document.getElementById('subText').value = '';
      document.getElementById('subTrans').value = '';
      document.getElementById('subText').focus();
    }

    function clearSubtitle() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'clear_subtitle' }));
      }
    }

    function renderHistory() {
      const list = document.getElementById('historyList');
      if (history.length === 0) return;
      list.innerHTML = '';
      history.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = '<span>' + item.text + (item.translation ? ' <small style="color: #38BDF8">(' + item.translation + ')</small>' : '') + '</span><span style="color:#64748B; font-size:0.75rem;">Re-enviar</span>';
        div.onclick = () => {
          document.getElementById('subText').value = item.text;
          document.getElementById('subTrans').value = item.translation || '';
          sendSubtitle();
        };
        list.appendChild(div);
      });
    }

    document.getElementById('btnSend').onclick = sendSubtitle;
    document.getElementById('btnClear').onclick = clearSubtitle;
    document.getElementById('subText').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendSubtitle();
      }
    };

    connect();
  </script>
</body>
</html>`;
}
