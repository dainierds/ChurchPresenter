/**
 * Remote Operator HTML Web App Template (Phase 12)
 *
 * Served at https://dominio-de-camaras:8443/operator
 * Responsive SPA for 13-15" laptops over Tailscale VPN.
 */

export function getRemoteOperatorHtml(options?: { churchIp?: string; tailscaleIp?: string }): string {
  const tailscaleIp = options?.tailscaleIp || '100.73.59.102'
  const _churchIp = options?.churchIp || '127.0.0.1'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChurchPresenter - Operador Remoto (Tailscale)</title>
  <style>
    :root {
      --bg-dark: #0B0F19;
      --bg-card: #111827;
      --bg-surface: #1E293B;
      --border-color: #334155;
      --text-main: #F3F4F6;
      --text-muted: #9CA3AF;
      --accent: #F97316;
      --accent-hover: #EA580C;
      --green: #10B981;
      --red: #EF4444;
      --blue: #3B82F6;
      --amber: #F59E0B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      overflow-x: hidden;
      font-size: 13px;
      line-height: 1.4;
      user-select: none;
    }
    /* Header Bar */
    header {
      background-color: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
      height: 48px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: -0.3px;
    }
    .brand-badge {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent);
      border: 1px solid rgba(249, 115, 22, 0.4);
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .top-status {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--red);
    }
    .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .status-dot.warn { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
    .top-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    button {
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: var(--bg-surface);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    }
    button:hover { background: #2D3748; border-color: #4A5568; }
    button:active { transform: translateY(1px); }
    button.primary { background: var(--accent); border-color: var(--accent); color: #FFF; }
    button.primary:hover { background: var(--accent-hover); }
    button.danger { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: var(--red); }
    button.danger:hover { background: var(--red); color: #FFF; }
    button.success { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: var(--green); }
    button.success:hover { background: var(--green); color: #FFF; }

    /* Main Dashboard Grid */
    .dashboard-container {
      display: grid;
      grid-template-columns: 310px 1fr 340px;
      gap: 12px;
      padding: 12px;
      height: calc(100vh - 48px);
      overflow: hidden;
    }
    @media (max-width: 1200px) {
      .dashboard-container {
        grid-template-columns: 280px 1fr;
        height: auto;
        overflow: visible;
      }
    }
    @media (max-width: 768px) {
      .dashboard-container {
        grid-template-columns: 1fr;
        height: auto;
      }
    }
    .panel-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-color);
      font-weight: 600;
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-body {
      padding: 12px;
      overflow-y: auto;
      flex: 1;
    }

    /* Left Panel: Presentation & Playlist */
    .emergency-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .emergency-btn {
      padding: 8px 4px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
    }
    .emergency-btn.active {
      box-shadow: 0 0 8px currentColor;
    }
    .nav-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }
    .playlist-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 220px;
      overflow-y: auto;
      margin-bottom: 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px;
      background: rgba(0, 0, 0, 0.2);
    }
    .playlist-item {
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      transition: background 0.15s;
    }
    .playlist-item:hover { background: rgba(255, 255, 255, 0.05); }
    .playlist-item.active {
      background: rgba(249, 115, 22, 0.15);
      border-left: 3px solid var(--accent);
      color: #FFF;
      font-weight: 600;
    }
    .slides-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      max-height: 260px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px;
      background: rgba(0, 0, 0, 0.2);
    }
    .slide-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      font-size: 11px;
      min-height: 60px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.15s;
    }
    .slide-card:hover { border-color: var(--accent); }
    .slide-card.active {
      border: 2px solid var(--red);
      background: rgba(239, 68, 68, 0.1);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
    }

    /* Center Panel: Program Monitor & Scenes */
    .center-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      overflow-y: auto;
    }
    .monitor-container {
      background: #000;
      border-radius: 6px;
      aspect-ratio: 16 / 9;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-color);
    }
    .monitor-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .air-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: var(--red);
      color: #FFF;
      font-weight: 700;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      display: none;
      animation: pulse 1.5s infinite;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
    }
    .air-badge.visible { display: block; }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
    }
    .monitor-info {
      position: absolute;
      bottom: 8px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      color: #D1D5DB;
    }
    .scenes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 8px;
    }
    .scene-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
      position: relative;
    }
    .scene-card:hover { border-color: var(--accent); }
    .scene-card.program {
      border: 2px solid var(--red);
      background: rgba(239, 68, 68, 0.1);
    }
    .scene-card.preview {
      border: 2px solid var(--green);
      background: rgba(16, 185, 129, 0.1);
    }
    .scene-tag {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
      margin-top: 4px;
      display: inline-block;
    }
    .tag-program { background: var(--red); color: #FFF; }
    .tag-preview { background: var(--green); color: #FFF; }
    .transition-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.02);
      padding: 8px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }

    /* Right Panel: Cameras & Broadcast Stats */
    .right-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      overflow-y: auto;
    }
    .camera-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .broadcast-stat-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
    }
    .broadcast-stat-row:last-child { border-bottom: none; }
    .stat-val { font-weight: 600; color: #FFF; }

    /* Modals */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal-box {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      width: 90%;
      max-width: 420px;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .modal-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pin-input {
      width: 100%;
      padding: 12px;
      font-size: 24px;
      text-align: center;
      letter-spacing: 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: #FFF;
      border-radius: 6px;
      margin: 14px 0;
      font-family: monospace;
    }
    .chip-btn {
      font-size: 10px;
      padding: 3px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      cursor: pointer;
    }
    .chip-btn:hover { background: rgba(255, 255, 255, 0.15); }
    .quick-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }
    .alert-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--red);
      color: #FCA5A5;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      margin-bottom: 10px;
      display: none;
    }
  </style>
</head>
<body>

  <!-- Top Bar -->
  <header>
    <div class="brand">
      <span style="color: var(--accent);">ChurchPresenter</span>
      <span>Operador Remoto</span>
      <span class="brand-badge">Tailscale</span>
    </div>
    <div class="top-status">
      <div class="status-badge">
        <div id="connDot" class="status-dot"></div>
        <span id="connText">Conectando...</span>
        <span id="latencyBadge" style="color: var(--text-muted); font-size: 11px; margin-left: 4px;">-- ms</span>
      </div>
      <div style="color: var(--text-muted); font-size: 11px;">
        <span id="churchClock">Iglesia: --:--:--</span>
        <span style="margin: 0 4px;">|</span>
        <span id="localClock">Local: --:--:--</span>
      </div>
      <div id="operatorsCount" style="color: #9CA3AF; font-size: 11px;">
        🟢 1 operador local
      </div>
    </div>
    <div class="top-actions">
      <button id="reconnectBtn" style="display: none;" onclick="initWebSocket()">Reconectar</button>
      <button class="danger" onclick="handleLogout()">Cerrar Sesión</button>
    </div>
  </header>

  <!-- Dashboard Container -->
  <div class="dashboard-container">

    <!-- Left Column: Playlist & Presentation -->
    <div class="panel-card">
      <div class="panel-header">
        <span>Presentación y Playlist</span>
        <span id="activeItemBadge" style="color: var(--accent); font-size: 11px;">Culto Dominical</span>
      </div>
      <div class="panel-body">
        <!-- Emergency Controls -->
        <div class="emergency-grid">
          <button id="btnBlack" class="emergency-btn danger" onclick="sendAction('global-control', { action: 'black' })">Negro</button>
          <button id="btnClear" class="emergency-btn" onclick="sendAction('global-control', { action: 'clear' })">Limpiar</button>
          <button id="btnLogo" class="emergency-btn" onclick="sendAction('global-control', { action: 'logo' })">Logo</button>
          <button id="btnFreeze" class="emergency-btn" onclick="sendAction('global-control', { action: 'freeze' })">Congelar</button>
        </div>

        <!-- Navigation Arrows -->
        <div class="nav-buttons">
          <button onclick="sendAction('prev-slide')">◀ Diap. Ant.</button>
          <button class="primary" onclick="sendAction('next-slide')">Diap. Sig. ▶</button>
          <button onclick="sendAction('next-item')">Sig. Elemento ⏭</button>
        </div>

        <!-- Playlist Items -->
        <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">ORDEN DE CULTO</div>
        <div id="playlistContainer" class="playlist-list">
          <div style="padding: 10px; color: var(--text-muted); text-align: center;">Cargando lista de servicio...</div>
        </div>

        <!-- Slides Grid -->
        <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">DIAPOSITIVAS DEL ELEMENTO</div>
        <div id="slidesContainer" class="slides-grid">
          <div style="grid-column: span 2; padding: 20px; color: var(--text-muted); text-align: center;">Seleccione un elemento</div>
        </div>

        <!-- Messages & Timers -->
        <div style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">MENSAJES RÁPIDOS</div>
          <div class="quick-chips">
            <span class="chip-btn" onclick="setQuickMsg('Pastor, quedan 5 minutos')">5 minutos</span>
            <span class="chip-btn" onclick="setQuickMsg('Vehículo mal estacionado')">Vehículo</span>
            <span class="chip-btn" onclick="setQuickMsg('Bienvenido a Casa')">Bienvenida</span>
            <span class="chip-btn" onclick="setQuickMsg('Favor acercarse a la cuna')">Cuna</span>
          </div>
          <div style="display: flex; gap: 6px; margin-bottom: 6px;">
            <input id="customMsgInput" type="text" placeholder="Escribir mensaje..." style="flex: 1; padding: 6px; background: var(--bg-surface); border: 1px solid var(--border-color); color: #FFF; border-radius: 4px; font-size: 11px;">
            <select id="msgTarget" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: #FFF; border-radius: 4px; font-size: 11px; padding: 0 4px;">
              <option value="stage">Escenario</option>
              <option value="audience">Audiencia</option>
              <option value="both">Ambos</option>
            </select>
            <button class="primary" style="padding: 4px 8px;" onclick="sendCustomMessage()">Enviar</button>
            <button class="danger" style="padding: 4px 8px;" onclick="sendAction('clear-message')">✕</button>
          </div>

          <!-- Timers -->
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin: 8px 0 4px 0;">TEMPORIZADORES</div>
          <div id="timersList" style="display: flex; flex-direction: column; gap: 4px;">
            <div style="padding: 4px; color: var(--text-muted); font-size: 11px;">Sin temporizadores activos</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Center Column: Monitor & Studio Scenes -->
    <div class="center-column">
      <!-- Program Monitor -->
      <div class="panel-card" style="flex: 1; min-height: 280px;">
        <div class="panel-header">
          <span>Monitor de Programa (Salida Principal)</span>
          <span id="monitorStatusText" style="color: var(--green); font-size: 11px;">EN LÍNEA</span>
        </div>
        <div class="panel-body" style="padding: 8px; display: flex; flex-direction: column;">
          <div class="monitor-container">
            <div id="airBadge" class="air-badge">🔴 EN AIRE</div>
            <img id="programImg" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect fill='%23111827' width='320' height='180'/%3E%3Ctext fill='%239CA3AF' font-family='sans-serif' font-size='12' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EEsperando se%C3%B1al de la iglesia...%3C/text%3E%3C/svg%3E" alt="Monitor de Programa">
            <div id="monitorLatency" class="monitor-info">Latencia: ~0.8s | 320x180 JPEG</div>
          </div>
        </div>
      </div>

      <!-- Studio Scenes -->
      <div class="panel-card" style="height: 220px;">
        <div class="panel-header">
          <span>Escenas de Transmisión (Estudio)</span>
          <span style="color: var(--text-muted); font-size: 11px;">Clic para cambiar en Programa</span>
        </div>
        <div class="panel-body">
          <div id="scenesContainer" class="scenes-grid">
            <!-- Scene cards dynamically generated -->
          </div>
          <div class="transition-bar">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">TRANSICIÓN:</span>
            <button id="btnTransCut" class="primary" style="padding: 4px 8px;" onclick="setTransitionMode('cut')">Corte</button>
            <button id="btnTransFade" style="padding: 4px 8px;" onclick="setTransitionMode('fade')">Fundido</button>
            <input id="transDuration" type="range" min="200" max="1500" step="100" value="500" style="flex: 1;" oninput="updateDurationLabel(this.value)">
            <span id="transDurationLabel" style="font-size: 11px; min-width: 45px;">500ms</span>
            <button class="success" style="padding: 6px 14px; font-weight: 700;" onclick="triggerStudioTransition()">TRANSMISIÓN ▶</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Sources, Cameras & Broadcast -->
    <div class="right-column">
      <!-- Phone Cameras -->
      <div class="panel-card" style="flex: 1; min-height: 220px;">
        <div class="panel-header">
          <span>Cámaras Móviles Conectadas</span>
          <span id="camerasCountBadge" style="color: var(--accent); font-size: 11px;">0/4</span>
        </div>
        <div class="panel-body" id="camerasContainer">
          <div style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 11px;">
            No hay teléfonos móviles conectados en /cam
          </div>
        </div>
      </div>

      <!-- Streaming & Recording -->
      <div class="panel-card" style="flex: 1;">
        <div class="panel-header">
          <span>Transmisión y Grabación</span>
          <span id="broadcastEncoderBadge" style="color: var(--green); font-size: 11px;">NVENC ACTIVO</span>
        </div>
        <div class="panel-body">
          <div id="netAlertBanner" class="alert-banner">
            ⚠️ Alerta: El bitrate de la transmisión bajó de 1500 kbps o la conexión Wi-Fi es inestable.
          </div>

          <!-- Streaming Box -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 12px;">Transmisión en Vivo</span>
              <span id="streamStatusBadge" class="status-badge" style="color: var(--red); font-size: 10px;">DETENIDO</span>
            </div>
            <div class="broadcast-stat-row">
              <span style="color: var(--text-muted);">Tiempo:</span>
              <span id="streamDuration" class="stat-val">00:00:00</span>
            </div>
            <div class="broadcast-stat-row">
              <span style="color: var(--text-muted);">Bitrate:</span>
              <span id="streamBitrate" class="stat-val">0 kbps</span>
            </div>
            <div class="broadcast-stat-row">
              <span style="color: var(--text-muted);">FPS / Cuadros:</span>
              <span id="streamFps" class="stat-val">30 fps (0 caídos)</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 10px;">
              <button id="btnStartStream" class="danger" style="flex: 1;" onclick="confirmAction('stream_start')">Iniciar Transmisión</button>
              <button id="btnStopStream" style="flex: 1; display: none;" onclick="confirmAction('stream_stop')">Detener</button>
            </div>
          </div>

          <!-- Recording Box -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 12px;">Grabación Local (Disco)</span>
              <span id="recordStatusBadge" class="status-badge" style="color: var(--green); font-size: 10px;">LISTO</span>
            </div>
            <div class="broadcast-stat-row">
              <span style="color: var(--text-muted);">Tiempo:</span>
              <span id="recordDuration" class="stat-val">00:00:00</span>
            </div>
            <div class="broadcast-stat-row">
              <span style="color: var(--text-muted);">Espacio Libre:</span>
              <span id="diskSpaceFree" class="stat-val">~450 GB libres</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 10px;">
              <button id="btnStartRecord" class="primary" style="flex: 1;" onclick="confirmAction('record_start')">Iniciar Grabación</button>
              <button id="btnStopRecord" class="danger" style="flex: 1; display: none;" onclick="confirmAction('record_stop')">Detener Grabación</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PIN Modal -->
  <div id="pinModal" class="modal-overlay">
    <div class="modal-box">
      <div class="modal-title">
        <span>🔒 Acceso de Operador Remoto</span>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
        Ingrese el PIN de 6 dígitos configurado en la PC de la iglesia (Sección Acceso Remoto) para conectar vía Tailscale.
      </p>
      <input id="pinInput" class="pin-input" type="password" maxlength="6" inputmode="numeric" placeholder="••••••" autofocus>
      <div id="pinError" style="color: var(--red); font-size: 11px; margin-bottom: 10px; display: none;"></div>
      <div style="display: flex; gap: 8px;">
        <button id="btnDiag" style="flex: 1;" onclick="showDiagModal()">Diagnóstico de Conexión</button>
        <button class="primary" style="flex: 1; font-weight: 700;" onclick="submitPin()">Entrar</button>
      </div>
    </div>
  </div>

  <!-- Confirmation Modal -->
  <div id="confirmModal" class="modal-overlay" style="display: none;">
    <div class="modal-box">
      <div class="modal-title" style="color: var(--amber);">
        <span>⚠️ Confirmación Requerida</span>
      </div>
      <p id="confirmMessage" style="font-size: 13px; margin: 12px 0;">
        ¿Está seguro que desea realizar esta acción?
      </p>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
        <button onclick="closeConfirmModal()">Cancelar</button>
        <button id="confirmOkBtn" class="danger" onclick="executeConfirmedAction()">Confirmar</button>
      </div>
    </div>
  </div>

  <!-- Diagnostic Modal -->
  <div id="diagModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 480px;">
      <div class="modal-title">
        <span>🛠 Diagnóstico de Conexión Tailscale</span>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
        Si la página no conecta con la PC de la iglesia, verifique la siguiente lista de verificación:
      </p>
      <ul style="font-size: 12px; line-height: 1.6; padding-left: 20px; margin-bottom: 16px;">
        <li><strong>Tailscale activo:</strong> Verifique que Tailscale esté conectado tanto en su laptop como en la PC de la iglesia.</li>
        <li><strong>IP de la iglesia:</strong> Asegúrese de usar la IP Tailscale correcta (actual: <code>${tailscaleIp}</code>).</li>
        <li><strong>PC encendida y ChurchPresenter abierto:</strong> El programa ChurchPresenter debe estar en ejecución en la PC de la iglesia.</li>
        <li><strong>Servidor remoto activo:</strong> En ChurchPresenter -> Ajustes -> Acceso Remoto, verifique que el servidor esté "Activo" en el puerto 8443.</li>
        <li><strong>Firewall de Windows:</strong> Permita conexiones entrantes para ChurchPresenter o el puerto 8443 en la red de Tailscale.</li>
      </ul>
      <div style="text-align: right;">
        <button class="primary" onclick="closeDiagModal()">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- Main JavaScript Logic -->
  <script>
    let ws = null
    let token = localStorage.getItem('cp_remote_operator_token') || ''
    let reconnectTimer = null
    let pingInterval = null
    let churchTimeOffset = 0
    let currentState = null
    let activeScenes = []
    let activeCameras = []
    let activeTimers = []
    let currentTransition = 'fade'
    let pendingAction = null

    // Initialize on load
    window.addEventListener('DOMContentLoaded', () => {
      startClocks()
      if (token) {
        initWebSocket()
      } else {
        document.getElementById('pinModal').style.display = 'flex'
      }
    })

    function startClocks() {
      setInterval(() => {
        const now = new Date()
        document.getElementById('localClock').innerText = 'Local: ' + now.toLocaleTimeString()
        const churchTime = new Date(Date.now() + churchTimeOffset)
        document.getElementById('churchClock').innerText = 'Iglesia: ' + churchTime.toLocaleTimeString()
      }, 1000)
    }

    async function submitPin() {
      const pin = document.getElementById('pinInput').value.trim()
      const errEl = document.getElementById('pinError')
      if (pin.length !== 6) {
        errEl.innerText = 'El PIN debe contener 6 dígitos.'
        errEl.style.display = 'block'
        return
      }

      errEl.style.display = 'none'
      try {
        const res = await fetch('/api/operator-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, deviceName: 'Laptop Operador (Tailscale)' })
        })
        const data = await res.json()
        if (data.success && data.token) {
          token = data.token
          localStorage.setItem('cp_remote_operator_token', token)
          document.getElementById('pinModal').style.display = 'none'
          initWebSocket()
        } else {
          errEl.innerText = data.error || 'PIN incorrecto. Verifique el código en la PC de la iglesia.'
          errEl.style.display = 'block'
        }
      } catch (err) {
        errEl.innerText = 'No se pudo conectar con el servidor. Verifique Tailscale y la IP.'
        errEl.style.display = 'block'
      }
    }

    function initWebSocket() {
      if (!token) return
      if (ws) {
        try { ws.close(); } catch {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = protocol + '//' + host + '/operator-ws?token=' + encodeURIComponent(token)

      setConnStatus('connecting', 'Conectando...')

      try {
        ws = new WebSocket(wsUrl)
      } catch (err) {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        setConnStatus('online', 'Conectado')
        document.getElementById('pinModal').style.display = 'none'
        document.getElementById('reconnectBtn').style.display = 'none'
        if (reconnectTimer) clearTimeout(reconnectTimer)
        startPing()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          handleServerMessage(msg)
        } catch {}
      }

      ws.onclose = (event) => {
        stopPing()
        setConnStatus('offline', 'Desconectado')
        document.getElementById('reconnectBtn').style.display = 'inline-flex'
        if (event.code === 4001 || event.code === 4003) {
          // Token expired or invalid
          localStorage.removeItem('cp_remote_operator_token')
          token = ''
          document.getElementById('pinModal').style.display = 'flex'
          document.getElementById('pinError').innerText = 'Sesión expirada o revocada. Ingrese el PIN de nuevo.'
          document.getElementById('pinError').style.display = 'block'
        } else {
          scheduleReconnect()
        }
      }

      ws.onerror = () => {
        setConnStatus('offline', 'Error de red')
      }
    }

    function scheduleReconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        initWebSocket()
      }, 3000)
    }

    function startPing() {
      stopPing()
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', t0: Date.now() }))
        }
      }, 2500)
    }

    function stopPing() {
      if (pingInterval) clearInterval(pingInterval)
    }

    function setConnStatus(status, text) {
      const dot = document.getElementById('connDot')
      const txt = document.getElementById('connText')
      dot.className = 'status-dot ' + (status === 'online' ? 'online' : status === 'warn' ? 'warn' : '')
      txt.innerText = text
    }

    function handleServerMessage(msg) {
      if (msg.type === 'pong') {
        const latency = Date.now() - msg.t0
        document.getElementById('latencyBadge').innerText = latency + ' ms'
        if (latency > 200) {
          document.getElementById('connDot').className = 'status-dot warn'
          document.getElementById('connText').innerText = 'Latencia Alta'
        } else {
          document.getElementById('connDot').className = 'status-dot online'
          document.getElementById('connText').innerText = 'Conectado'
        }
        return
      }

      if (msg.type === 'init' || msg.type === 'state-update') {
        if (msg.state) updatePresenterState(msg.state)
        if (msg.scenes) updateScenesList(msg.scenes)
        if (msg.cameras) updateCamerasList(msg.cameras)
        if (msg.timers) updateTimersList(msg.timers)
        if (msg.broadcastStatus) updateBroadcastStatus(msg.broadcastStatus)
        if (msg.operatorCount !== undefined) {
          document.getElementById('operatorsCount').innerText =
            msg.operatorCount > 1 ? '👥 ' + msg.operatorCount + ' operadores activos' : '🟢 1 operador conectado'
        }
        return
      }

      if (msg.type === 'program-frame') {
        if (msg.frame) {
          document.getElementById('programImg').src = 'data:image/jpeg;base64,' + msg.frame
        }
        return
      }

      if (msg.type === 'broadcast-status') {
        updateBroadcastStatus(msg.status)
        return
      }

      if (msg.type === 'cameras-update') {
        updateCamerasList(msg.cameras)
        return
      }

      if (msg.type === 'scenes-update') {
        updateScenesList(msg.scenes)
        return
      }
    }

    function updatePresenterState(state) {
      currentState = state
      // Global emergency buttons
      const ctrl = state.controls || {}
      setBtnActive('btnBlack', ctrl.black)
      setBtnActive('btnClear', ctrl.clear)
      setBtnActive('btnLogo', ctrl.logo)
      setBtnActive('btnFreeze', ctrl.freeze)

      // Active Air badge
      const isLive = state.activeBroadcastStatus?.isStreaming || false
      const badge = document.getElementById('airBadge')
      if (isLive) {
        badge.classList.add('visible')
      } else {
        badge.classList.remove('visible')
      }

      // Render playlist items
      if (state.activePlaylistItems && Array.isArray(state.activePlaylistItems)) {
        renderPlaylist(state.activePlaylistItems, state.activePlaylistItemId)
      }

      // Render slides of active item
      if (state.currentSlide) {
        renderSlides([state.currentSlide], 0)
      }
    }

    function setBtnActive(id, active) {
      const btn = document.getElementById(id)
      if (btn) {
        if (active) btn.classList.add('active')
        else btn.classList.remove('active')
      }
    }

    function renderPlaylist(items, activeId) {
      const container = document.getElementById('playlistContainer')
      if (!items || items.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--text-muted); text-align: center;">Sin elementos en la playlist</div>'
        return
      }

      container.innerHTML = items.map((it, idx) => {
        const isActive = it.id === activeId || it.isLive
        return \`<div class="playlist-item \${isActive ? 'active' : ''}" onclick="sendAction('select-item', { index: \${idx}, id: '\${it.id}' })">
          <span>\${idx + 1}. \${it.title || 'Elemento'}</span>
          <span style="font-size: 10px; opacity: 0.8;">\${it.type || ''}</span>
        </div>\`
      }).join('')
    }

    function renderSlides(slides, activeIndex) {
      const container = document.getElementById('slidesContainer')
      if (!slides || slides.length === 0) {
        container.innerHTML = '<div style="grid-column: span 2; padding: 20px; color: var(--text-muted); text-align: center;">Sin diapositivas disponibles</div>'
        return
      }

      container.innerHTML = slides.map((s, idx) => {
        const isActive = idx === activeIndex
        const bodyPreview = (s.body || s.content || '').substring(0, 60)
        return \`<div class="slide-card \${isActive ? 'active' : ''}" onclick="sendAction('select-slide', { index: \${idx} })">
          <div style="font-weight: 700; color: var(--accent); margin-bottom: 2px;">#\${idx + 1}</div>
          <div style="color: #D1D5DB; overflow: hidden; text-overflow: ellipsis;">\${bodyPreview || '(En blanco)'}</div>
        </div>\`
      }).join('')
    }

    function updateScenesList(scenes) {
      activeScenes = scenes || []
      const container = document.getElementById('scenesContainer')
      if (!scenes || scenes.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">No hay escenas configuradas en el estudio</div>'
        return
      }

      const progId = currentState?.activeStudioProgramSceneId || (scenes[0] && scenes[0].id)
      const prevId = currentState?.activeStudioPreviewSceneId || (scenes[1] && scenes[1].id) || progId

      container.innerHTML = scenes.map(s => {
        const isProg = s.id === progId
        const isPrev = s.id === prevId
        return \`<div class="scene-card \${isProg ? 'program' : isPrev ? 'preview' : ''}" onclick="selectStudioScene('\${s.id}')">
          <div style="font-weight: 600; font-size: 11px;">\${s.name}</div>
          \${isProg ? '<span class="scene-tag tag-program">PROGRAMA</span>' : isPrev ? '<span class="scene-tag tag-preview">PREVIO</span>' : ''}
        </div>\`
      }).join('')
    }

    function updateCamerasList(cameras) {
      activeCameras = cameras || []
      document.getElementById('camerasCountBadge').innerText = (cameras?.length || 0) + '/4'
      const container = document.getElementById('camerasContainer')
      if (!cameras || cameras.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 11px;">No hay teléfonos móviles conectados en /cam</div>'
        return
      }

      container.innerHTML = cameras.map(cam => {
        const isMuted = cam.audioMuted !== false
        const batt = cam.batteryLevel !== null && cam.batteryLevel !== undefined ? Math.round(cam.batteryLevel * 100) + '%' : '--'
        return \`<div class="camera-card">
          <div>
            <div style="font-weight: 700; font-size: 11px;">\${cam.name} <span style="font-size: 10px; color: var(--text-muted);">(\${cam.ip})</span></div>
            <div style="font-size: 10px; color: var(--text-muted);">
              \${cam.actualFps || 30} fps | \${cam.bitrateKbps || 2500} kbps | 🔋 \${batt}
            </div>
          </div>
          <div>
            <button class="\${isMuted ? '' : 'primary'}" style="padding: 3px 8px; font-size: 10px;" onclick="toggleCameraMic('\${cam.id}', \${!isMuted})">
              \${isMuted ? '🔇 Mute' : '🎤 On'}
            </button>
          </div>
        </div>\`
      }).join('')
    }

    function updateTimersList(timers) {
      activeTimers = timers || []
      const container = document.getElementById('timersList')
      if (!timers || timers.length === 0) {
        container.innerHTML = '<div style="padding: 4px; color: var(--text-muted); font-size: 11px;">Sin temporizadores configurados</div>'
        return
      }

      container.innerHTML = timers.map(t => {
        const secs = t.currentSeconds !== undefined ? t.currentSeconds : t.durationSeconds || 0
        const m = Math.floor(secs / 60)
        const s = secs % 60
        const timeStr = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
        return \`<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 4px 6px; border-radius: 4px;">
          <span style="font-size: 11px; font-weight: 500;">\${t.name}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-family: monospace; font-weight: 700; color: var(--accent);">\${timeStr}</span>
            <button style="padding: 2px 6px; font-size: 10px;" onclick="sendAction('control-timer', { timerId: '\${t.id}', action: '\${t.isRunning ? 'pause' : 'start'}' })">
              \${t.isRunning ? '⏸' : '▶'}
            </button>
            <button style="padding: 2px 6px; font-size: 10px;" onclick="sendAction('control-timer', { timerId: '\${t.id}', action: 'reset' })">🔄</button>
          </div>
        </div>\`
      }).join('')
    }

    function updateBroadcastStatus(status) {
      if (!status) return
      // Stream
      const isStreaming = status.isStreaming || false
      const badgeS = document.getElementById('streamStatusBadge')
      badgeS.innerText = isStreaming ? 'EN DIRECTO' : 'DETENIDO'
      badgeS.style.color = isStreaming ? 'var(--green)' : 'var(--red)'
      document.getElementById('streamDuration').innerText = status.formattedTime || '00:00:00'
      document.getElementById('streamBitrate').innerText = (status.bitrateKbps || 0) + ' kbps'
      document.getElementById('streamFps').innerText = (status.fps || 30) + ' fps (' + (status.droppedFrames || 0) + ' caídos)'
      document.getElementById('btnStartStream').style.display = isStreaming ? 'none' : 'block'
      document.getElementById('btnStopStream').style.display = isStreaming ? 'block' : 'none'

      // Record
      const isRecording = status.isRecording || false
      const badgeR = document.getElementById('recordStatusBadge')
      badgeR.innerText = isRecording ? 'GRABANDO' : 'DETENIDO'
      badgeR.style.color = isRecording ? 'var(--red)' : 'var(--green)'
      document.getElementById('recordDuration').innerText = status.formattedTime || '00:00:00'
      document.getElementById('btnStartRecord').style.display = isRecording ? 'none' : 'block'
      document.getElementById('btnStopRecord').style.display = isRecording ? 'block' : 'none'

      // Bitrate warning
      const alertEl = document.getElementById('netAlertBanner')
      if (isStreaming && status.bitrateKbps > 0 && status.bitrateKbps < 1500) {
        alertEl.style.display = 'block'
      } else {
        alertEl.style.display = 'none'
      }
    }

    function sendAction(type, payload = {}) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type, ...payload }))
    }

    function setQuickMsg(text) {
      document.getElementById('customMsgInput').value = text
    }

    function sendCustomMessage() {
      const text = document.getElementById('customMsgInput').value.trim()
      const target = document.getElementById('msgTarget').value
      if (!text) return
      sendAction('send-message', { text, target, durationSeconds: 15 })
      document.getElementById('customMsgInput').value = ''
    }

    function selectStudioScene(sceneId) {
      sendAction('studio-set-scene', { sceneId, target: 'program', transition: currentTransition })
    }

    function setTransitionMode(mode) {
      currentTransition = mode
      document.getElementById('btnTransCut').className = mode === 'cut' ? 'primary' : ''
      document.getElementById('btnTransFade').className = mode === 'fade' ? 'primary' : ''
    }

    function updateDurationLabel(val) {
      document.getElementById('transDurationLabel').innerText = val + 'ms'
    }

    function triggerStudioTransition() {
      const dur = parseInt(document.getElementById('transDuration').value, 10) || 500
      sendAction('studio-transition', { transition: currentTransition, duration: dur })
    }

    function toggleCameraMic(deviceId, audioMuted) {
      sendAction('camera-mute-device', { deviceId, audioMuted })
    }

    // Confirmations
    function confirmAction(actionKey) {
      pendingAction = actionKey
      const modal = document.getElementById('confirmModal')
      const msgEl = document.getElementById('confirmMessage')
      if (actionKey === 'stream_start') {
        msgEl.innerText = '¿Está seguro de iniciar la transmisión en vivo a YouTube?'
      } else if (actionKey === 'stream_stop') {
        msgEl.innerText = '¿Está seguro de detener la transmisión en vivo?'
      } else if (actionKey === 'record_start') {
        msgEl.innerText = '¿Iniciar grabación local del culto en la PC de la iglesia?'
      } else if (actionKey === 'record_stop') {
        msgEl.innerText = '¿Detener la grabación local en disco?'
      }
      modal.style.display = 'flex'
    }

    function closeConfirmModal() {
      pendingAction = null
      document.getElementById('confirmModal').style.display = 'none'
    }

    function executeConfirmedAction() {
      if (!pendingAction) return
      if (pendingAction === 'stream_start') sendAction('studio-start-stream')
      else if (pendingAction === 'stream_stop') sendAction('studio-stop-stream')
      else if (pendingAction === 'record_start') sendAction('studio-start-record')
      else if (pendingAction === 'record_stop') sendAction('studio-stop-record')
      closeConfirmModal()
    }

    function handleLogout() {
      localStorage.removeItem('cp_remote_operator_token')
      token = ''
      if (ws) {
        try { ws.close() } catch {}
      }
      document.getElementById('pinModal').style.display = 'flex'
      document.getElementById('pinInput').value = ''
    }

    function showDiagModal() {
      document.getElementById('diagModal').style.display = 'flex'
    }

    function closeDiagModal() {
      document.getElementById('diagModal').style.display = 'none'
    }
  </script>
</body>
</html>`
}
