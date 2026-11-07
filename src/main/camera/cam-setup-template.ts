import { OctoStreamSlot } from '../../shared/types'

export function getCamSetupHtml(slot: OctoStreamSlot, localIp: string, tailscaleIp: string): string {
  const rtmpServerLocal = `rtmp://${localIp}:${slot.rtmpPort}/live`
  const rtmpServerTailscale = `rtmp://${tailscaleIp}:${slot.rtmpPort}/live`
  const streamKey = slot.rtmpStreamKey || slot.id

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Configurar ${slot.name} - ChurchPresenter</title>
  <link rel="icon" type="image/png" href="/icon.png">
  <link rel="apple-touch-icon" href="/icon.png">
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      margin: 0;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .header {
      text-align: center;
      padding: 12px 0;
    }
    .badge {
      display: inline-block;
      background: rgba(255, 122, 0, 0.15);
      color: #ff7a00;
      border: 1px solid rgba(255, 122, 0, 0.4);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 6px 0;
      color: #ffffff;
    }
    p.subtitle {
      margin: 0;
      font-size: 13px;
      color: #8b949e;
      line-height: 1.4;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #ff7a00;
      color: #000;
      font-weight: 800;
      font-size: 12px;
      margin-right: 6px;
    }
    .step-title {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #8b949e;
      letter-spacing: 0.5px;
    }
    .input-row {
      display: flex;
      gap: 8px;
    }
    .value-box {
      flex: 1;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 10px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: #58a6ff;
      word-break: break-all;
      user-select: all;
    }
    .btn-copy {
      background: #238636;
      border: none;
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      padding: 0 14px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-copy:active {
      transform: scale(0.97);
    }
    .btn-copy.copied {
      background: #1f6feb;
    }
    .tabs {
      display: flex;
      background: #0d1117;
      border-radius: 8px;
      padding: 3px;
      gap: 4px;
    }
    .tab {
      flex: 1;
      padding: 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #8b949e;
      cursor: pointer;
    }
    .tab.active {
      background: #21262d;
      color: #ffffff;
    }
    .btn-appstore {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #ff7a00;
      color: #000000;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      padding: 12px;
      border-radius: 10px;
      margin-top: 4px;
    }
    .help-box {
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
      color: #93c5fd;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/icon.png" style="width: 48px; height: 48px; border-radius: 10px; margin-bottom: 8px; display: inline-block;" alt="ChurchPresenter" />
      <div class="badge">ChurchPresenter Conexión Directa</div>
      <h1>${slot.name}</h1>
      <p class="subtitle">Copia estos parámetros y pégalos en la app <strong>OctoStream</strong> en tu iPhone.</p>
    </div>

    <!-- Mode Selector for Network -->
    <div class="tabs">
      <button class="tab active" id="tabLocal" onclick="switchNetwork('local')">Wi-Fi de la Iglesia</button>
      <button class="tab" id="tabTailscale" onclick="switchNetwork('tailscale')">Remoto (Tailscale)</button>
    </div>

    <!-- Step 1: Complete URL for OctoStream -->
    <div class="card" style="border-color: #38bdf8;">
      <div class="step-title" style="color: #38bdf8;">
        <span class="step-num" style="background: #38bdf8; color: #000;">1</span> URL para OctoStream (Pega aquí)
      </div>
      <div class="field-group">
        <div class="field-label" style="color: #7dd3fc;">Dirección Completa de Transmisión:</div>
        <div class="input-row">
          <div class="value-box" id="fullUrlBox" style="color: #38bdf8; font-weight: 700;">${rtmpServerLocal}/${streamKey}</div>
          <button class="btn-copy" id="btnCopyFull" style="background: #0284c7;" onclick="copyText('fullUrlBox', 'btnCopyFull')">Copiar</button>
        </div>
      </div>
      <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
        👉 En OctoStream, pulsa <strong>Settings / Servidores</strong>, añade un servidor RTMP y pega esta URL completa directamente.
      </div>
    </div>

    <!-- Step 2: Separate Server & Key (Optional for OBS / Larix) -->
    <details class="card" style="padding: 12px; font-size: 12px; color: #8b949e;">
      <summary style="cursor: pointer; font-weight: 600; color: #cbd5e1;">
        ⚙️ Si tu app pide Servidor y Clave por separado (ej. OBS / Larix)
      </summary>
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
        <div class="field-group">
          <div class="field-label">Servidor RTMP:</div>
          <div class="input-row">
            <div class="value-box" id="serverUrlBox">${rtmpServerLocal}</div>
            <button class="btn-copy" id="btnCopyServer" onclick="copyText('serverUrlBox', 'btnCopyServer')">Copiar</button>
          </div>
        </div>

        <div class="field-group">
          <div class="field-label">Clave (Stream Key):</div>
          <div class="input-row">
            <div class="value-box" id="streamKeyBox">${streamKey}</div>
            <button class="btn-copy" id="btnCopyKey" onclick="copyText('streamKeyBox', 'btnCopyKey')">Copiar</button>
          </div>
        </div>
      </div>
    </details>

    <!-- Step 3: Transmit -->
    <div class="card">
      <div class="step-title">
        <span class="step-num">2</span> Iniciar Transmisión
      </div>
      <div class="help-box">
        En <strong>OctoStream</strong>, pulsa el botón rojo <strong>Start / Transmitir</strong>. La PC de la iglesia detectará el video de tu iPhone al instante en vivo.
      </div>
      <a href="https://apps.apple.com/app/id6474640167" class="btn-appstore" target="_blank">
        Abrir OctoStream en App Store ↗
      </a>
    </div>
  </div>

  <script>
    const localFullUrl = "${rtmpServerLocal}/${streamKey}";
    const tailscaleFullUrl = "${rtmpServerTailscale}/${streamKey}";
    const localServer = "${rtmpServerLocal}";
    const tailscaleServer = "${rtmpServerTailscale}";

    function switchNetwork(type) {
      const fullBox = document.getElementById('fullUrlBox');
      const srvBox = document.getElementById('serverUrlBox');
      const tabL = document.getElementById('tabLocal');
      const tabT = document.getElementById('tabTailscale');
      if (type === 'local') {
        if (fullBox) fullBox.innerText = localFullUrl;
        if (srvBox) srvBox.innerText = localServer;
        tabL.classList.add('active');
        tabT.classList.remove('active');
      } else {
        if (fullBox) fullBox.innerText = tailscaleFullUrl;
        if (srvBox) srvBox.innerText = tailscaleServer;
        tabT.classList.add('active');
        tabL.classList.remove('active');
      }
    }

    function copyText(elementId, btnId) {
      const text = document.getElementById(elementId).innerText.trim();
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(btnId);
        const originalText = btn.innerText;
        btn.innerText = '¡Copiado! ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerText = originalText;
          btn.classList.remove('copied');
        }, 2000);
      }).catch(() => {
        // Fallback for older WebViews
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        const btn = document.getElementById(btnId);
        btn.innerText = '¡Copiado! ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerText = 'Copiar';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`
}
