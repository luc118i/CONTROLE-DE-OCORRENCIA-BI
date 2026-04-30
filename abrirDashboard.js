// ------------------------
// ABRIR DASHBORD
// ------------------------
function abrirDashboard() {
  const urlDashboard = ScriptApp.getService().getUrl();
  const urlApresentacao = urlDashboard + "?view=apresentacao";

  const html = HtmlService.createHtmlOutput(`
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'DM Sans', sans-serif;
            background: #080e1a;
            color: #e2e8f0;
            padding: 24px 20px 20px;
            overflow: hidden;
            min-height: 260px;
          }

          /* Fundo animado com grade */
          body::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image:
              linear-gradient(rgba(30,60,120,0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30,60,120,0.15) 1px, transparent 1px);
            background-size: 28px 28px;
            animation: gridShift 8s linear infinite;
            pointer-events: none;
          }

          @keyframes gridShift {
            0% { transform: translateY(0); }
            100% { transform: translateY(28px); }
          }

          /* Orbe de luz de fundo */
          body::after {
            content: '';
            position: fixed;
            width: 260px;
            height: 260px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(30,90,220,0.18) 0%, transparent 70%);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            animation: pulse 4s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          }

          .header {
            position: relative;
            margin-bottom: 20px;
            animation: fadeDown 0.5s ease both;
          }

          @keyframes fadeDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: 'DM Mono', monospace;
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #3b82f6;
            background: rgba(59,130,246,0.1);
            border: 1px solid rgba(59,130,246,0.25);
            border-radius: 4px;
            padding: 3px 8px;
            margin-bottom: 8px;
          }

          .tag::before {
            content: '';
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #3b82f6;
            animation: blink 1.4s ease-in-out infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
          }

          h2 {
            font-size: 17px;
            font-weight: 600;
            color: #f1f5f9;
            letter-spacing: -0.02em;
          }

          .subtitle {
            font-size: 12px;
            color: #475569;
            margin-top: 2px;
          }

          .container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            position: relative;
          }

          .btn {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 13.5px;
            letter-spacing: -0.01em;
            color: white;
            overflow: hidden;
            border: 1px solid transparent;
            transition: transform 0.22s cubic-bezier(.22,1,.36,1),
                        box-shadow 0.22s ease,
                        border-color 0.22s ease;
            animation: fadeUp 0.5s ease both;
          }

          .btn:nth-child(1) { animation-delay: 0.1s; }
          .btn:nth-child(2) { animation-delay: 0.2s; }

          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Efeito de brilho deslizante */
          .btn::before {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 60%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
            transition: left 0.5s ease;
            pointer-events: none;
          }

          .btn:hover::before {
            left: 160%;
          }

          /* Borda brilhante animada no hover */
          .btn::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 10px;
            opacity: 0;
            transition: opacity 0.25s ease;
            pointer-events: none;
          }

          .btn-dashboard {
            background: linear-gradient(135deg, #1244a2 0%, #1e54b7 50%, #2563eb 100%);
            box-shadow: 0 4px 16px rgba(30,84,183,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
          }

          .btn-dashboard::after {
            box-shadow: 0 0 0 1px rgba(96,165,250,0.6);
          }

          .btn-apresentacao {
            background: linear-gradient(135deg, #0d6641 0%, #15803d 50%, #16a34a 100%);
            box-shadow: 0 4px 16px rgba(21,128,61,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
          }

          .btn-apresentacao::after {
            box-shadow: 0 0 0 1px rgba(74,222,128,0.6);
          }

          .btn:hover {
            transform: translateY(-3px) scale(1.015);
          }

          .btn-dashboard:hover {
            box-shadow: 0 10px 28px rgba(30,84,183,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
            border-color: rgba(96,165,250,0.3);
          }

          .btn-apresentacao:hover {
            box-shadow: 0 10px 28px rgba(21,128,61,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
            border-color: rgba(74,222,128,0.3);
          }

          .btn:hover::after { opacity: 1; }

          .btn:active {
            transform: translateY(-1px) scale(1.005);
          }

          .btn-label {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .btn-icon {
            width: 30px;
            height: 30px;
            border-radius: 7px;
            background: rgba(255,255,255,0.12);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 0.2s ease;
          }

          .btn:hover .btn-icon {
            background: rgba(255,255,255,0.2);
          }

          .btn-icon svg {
            width: 15px;
            height: 15px;
            fill: none;
            stroke: white;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .arrow {
            width: 18px;
            height: 18px;
            opacity: 0.5;
            transition: opacity 0.2s, transform 0.2s cubic-bezier(.22,1,.36,1);
            flex-shrink: 0;
          }

          .btn:hover .arrow {
            opacity: 1;
            transform: translateX(3px);
          }

          .arrow svg {
            width: 18px;
            height: 18px;
            fill: none;
            stroke: white;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .footer {
            margin-top: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 10.5px;
            color: #334155;
            font-family: 'DM Mono', monospace;
            letter-spacing: 0.04em;
            animation: fadeUp 0.5s 0.35s ease both;
          }

          .footer-dot {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background: #334155;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="tag">BI Operacional</div>
          <h2>Painel de Ocorrências</h2>
          <div class="subtitle">Selecione o modo de visualização</div>
        </div>

        <div class="container">
          <a href="${urlDashboard}" target="_blank" class="btn btn-dashboard">
            <div class="btn-label">
              <div class="btn-icon">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              Abrir Dashboard
            </div>
            <div class="arrow">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </a>

          <a href="${urlApresentacao}" target="_blank" class="btn btn-apresentacao">
            <div class="btn-label">
              <div class="btn-icon">
                <svg viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              </div>
              Modo Apresentacao
            </div>
            <div class="arrow">
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </a>
        </div>

        <div class="footer">
          Viacao Catedral <div class="footer-dot"></div> BI Operacional
        </div>
      </body>
    </html>
  `).setWidth(320).setHeight(268);

  SpreadsheetApp.getUi().showModalDialog(html, "Abrir BI");
}



