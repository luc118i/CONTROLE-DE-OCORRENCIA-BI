// ============================================================
//  BI Ocorrências — Viação Catedral
//  Code.gs — Google Apps Script Backend
//  Dev: Lucas Inácio
// ============================================================

// ------------------------
// 1. Core / Web App
// ------------------------
function doGet(e) {
  const view =
    e && e.parameter && e.parameter.view ? e.parameter.view : "dashboard";

  if (view === "apresentacao") {
    return HtmlService.createHtmlOutputFromFile("apresentacao")
      .setTitle("Modo apresentação · BI Operacional · Viação Catedral")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // default: dashboard
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("BI Operacional · Viação Catedral")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Usado pelo dashboard para descobrir a URL real do Web App
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ------------------------
// 2. Utils gerais
// ------------------------
function normalizarNomeArquivo(nome) {
  return String(nome || "")
    .replace(/\.[^/.]+$/, "") // remove extensão
    .replace(/[–—]/g, "-") // normaliza tipos de hífen
    .replace(/\s+/g, " ") // colapsa espaços
    .trim();
}

// mesma lógica de normalização de tipo usada no front (normTipo)
function normTipoBackend(t) {
  return String(t || "")
    .trim()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

// ------------------------
// 3. Drive / Documentos
// ------------------------
const _driveCache = {};
const OCORRENCIAS_FOLDER_ID = "18dpaj1Fxp7IKAFouObzNetPu5zpj1OZA";

function extrairIdDrive(valor) {
  if (!valor) return null;

  // Se já for só o ID
  if (/^[a-zA-Z0-9_-]{25,}$/.test(valor)) {
    return valor;
  }

  // Se for URL
  const match = valor.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function buscarUrlNoDrive(nomeArquivo) {
  if (!nomeArquivo || nomeArquivo === "File" || nomeArquivo === "Arquivo")
    return "";
  if (_driveCache[nomeArquivo] !== undefined) return _driveCache[nomeArquivo];

  let urlEncontrada = "";

  try {
    const nomeLimpo = normalizarNomeArquivo(nomeArquivo);
    if (!nomeLimpo) {
      _driveCache[nomeArquivo] = "";
      return "";
    }

    const pasta = DriveApp.getFolderById(OCORRENCIAS_FOLDER_ID);

    function procurar(nomeBusca) {
      if (!nomeBusca) return "";

      // Remove caracteres potencialmente problemáticos para a query de Drive
      let limpo = nomeBusca
        .replace(/\r?\n/g, " ")
        .replace(/"/g, "")
        .replace(/'/g, "")
        .trim();

      if (!limpo) return "";

      const query = 'title contains "' + limpo + '" and trashed = false';

      try {
        const it = pasta.searchFiles(query);
        if (it.hasNext()) {
          return it.next().getUrl();
        }
      } catch (e) {
        Logger.log("Erro em searchFiles com query: " + query + " | erro: " + e);
      }
      return "";
    }

    // 1) prefixo até o primeiro " - " (normalmente "5132 - NOME")
    let atePrimeiroHifen = nomeLimpo;
    const idx = nomeLimpo.indexOf(" - ");
    if (idx > 0) atePrimeiroHifen = nomeLimpo.substring(0, idx);

    // 2) primeiros 40 caracteres
    const prefix40 = nomeLimpo.substring(0, 40);

    // Ordem de tentativas
    urlEncontrada = procurar(atePrimeiroHifen);
    if (!urlEncontrada) urlEncontrada = procurar(prefix40);
    if (!urlEncontrada) urlEncontrada = procurar(nomeLimpo);
  } catch (e) {
    console.error("Erro em buscarUrlNoDrive para", nomeArquivo, e);
  }

  _driveCache[nomeArquivo] = urlEncontrada || "";
  return urlEncontrada || "";
}

// Chamada isolada usada pelo frontend para lazy load de links
function getUrlArquivo(nomeArquivo) {
  return buscarUrlNoDrive(nomeArquivo);
}

// ------------------------
// 4. Dados da planilha / BI
// ------------------------
// getDados() — versão nova com motorista / plantonista
function getDados(dataIni, dataFim) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("Spreadsheet: " + ss.getName());

  const sheets = ss.getSheets().map((s) => s.getName());
  Logger.log("Abas: " + sheets.join(", "));

  const aba = ss.getSheetByName("CONTROLE");
  if (!aba) {
    throw new Error(
      'Aba "CONTROLE" não encontrada. Abas existentes: ' + sheets.join(", "),
    );
  }

  // Monta mapa Base → Gestor a partir da aba "gestores"
  const gestoresMap = {};
  const abaGestores = ss.getSheetByName("gestores");
  if (abaGestores && abaGestores.getLastRow() > 1) {
    const gestoresVals = abaGestores
      .getRange(2, 1, abaGestores.getLastRow() - 1, 2)
      .getValues();
    gestoresVals.forEach(function (row) {
      const base = String(row[0] || "").trim();
      const gestor = String(row[1] || "").trim();
      if (base) gestoresMap[base] = gestor;
    });
  }
  const ultLinha = aba.getLastRow();

  const LINHA_INI = 2; // linha de início dos dados (2 = cabeçalho na linha 1)
  const NUM_COLS = 12; // colunas A..L

  if (ultLinha < LINHA_INI) {
    return JSON.stringify([]);
  }

  const valores = aba
    .getRange(LINHA_INI, 1, ultLinha - LINHA_INI + 1, NUM_COLS)
    .getValues();

  // Índices 0‑based
  const COL_PREFIXO = 0; // A
  const COL_TIPO = 1; // B
  const COL_DETALHES = 2; // C
  const COL_STATUS = 4; // E
  const COL_DATA = 5; // F
  const COL_ARQUIVO = 8; // I  (motorista / arquivo)
  const COL_OBS = 9; // J  Observações
  const COL_BASE = 10; // K  Base responsável
  const COL_PLANTONISTA = 11; // L  Plantonista (mesclado)

  // Filtro de datas
  const dtIni = new Date(dataIni + "T00:00:00");
  const dtFim = new Date(dataFim + "T23:59:59");

  // Preencher para baixo a coluna mesclada (plantonista/base)
  let ultimoPlantonista = "";
  const plantonistaPorLinha = valores.map((row) => {
    const val = String(row[COL_PLANTONISTA] || "").trim();
    if (val !== "") ultimoPlantonista = val;
    return ultimoPlantonista;
  });

  // Extrai nome do motorista da coluna I no formato "0004 - NOME"
  // Extrai nome do motorista a partir da coluna I (Arquivo)
  // Aceita formatos com hífen (-) e travessões (–, —), misturados.
  // Exemplo esperado:

  function extrairMotorista(raw) {
    let s = String(raw || "").trim();

    // vazio ou marcador genérico
    if (!s || s === "Arquivo") return "(sem motorista)";

    // remove extensão (.pdf, .docx etc.)
    s = s.replace(/\.[^.\s]+$/, "").trim();

    // normaliza todos os tipos de traço para hífen simples
    s = s.replace(/[–—]/g, "-");

    // Agora esperamos algo como:
    // "4165 - NOME DO MOTORISTA - OUTRAS COISAS"
    // Vamos dividir em partes pelo hífen
    const parts = s
      .split("-")
      .map((p) => p.trim())
      .filter(Boolean);

    // parts[0] deve ser a matrícula (só dígitos), parts[1] o nome
    if (parts.length >= 2 && /^\d{3,6}$/.test(parts[0])) {
      const nome = parts[1].trim();
      return nome || "(sem motorista)";
    }

    // Se não encaixar nesse padrão, não arrisca: trata como sem motorista
    return "(sem motorista)";
  }

  // Normaliza datas vindas da planilha
  function normData(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    const parts = String(val).split("/");
    if (parts.length === 3) {
      // dd/mm/yyyy
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(val);
  }

  const registros = [];

  valores.forEach((row, i) => {
    const dataBruta = normData(row[COL_DATA]);
    if (!dataBruta || isNaN(dataBruta)) return;
    if (dataBruta < dtIni || dataBruta > dtFim) return;

    const y = dataBruta.getFullYear();
    const m = String(dataBruta.getMonth() + 1).padStart(2, "0");
    const d = String(dataBruta.getDate()).padStart(2, "0");

    registros.push({
      prefixo: String(row[COL_PREFIXO] || "").trim(),
      tipo: String(row[COL_TIPO] || "").trim(),
      detalhes: String(row[COL_DETALHES] || "").trim(),
      status: String(row[COL_STATUS] || "").trim(),
      data: `${y}-${m}-${d}`,
      arquivo: String(row[COL_ARQUIVO] || "").trim(),
      motorista: extrairMotorista(row[COL_ARQUIVO]),
      plantonista: plantonistaPorLinha[i],
      observacoes: String(row[COL_OBS] || "").trim(),
      base: String(row[COL_BASE] || "").trim(), // vem da coluna K
      gestor: gestoresMap[String(row[COL_BASE] || "").trim()] || "",
    });
  });
  return JSON.stringify(registros);
}

// ------------------------
// 5. Registro de ocorrências via dashboard
// ------------------------
function registrarOcorrencias(json) {
  var payload  = JSON.parse(json);
  var plantonista = String(payload.plantonista || "").trim();
  var itens       = payload.registros || [];

  if (!itens.length) throw new Error("Nenhum registro para salvar.");

  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName("CONTROLE");
  if (!aba) throw new Error('Aba "CONTROLE" não encontrada.');

  var linhaInicio = aba.getLastRow() + 1;

  itens.forEach(function (r, i) {
    var row = linhaInicio + i;

    aba.getRange(row, 1).setValue(r.prefixo    || ""); // A – Prefixo
    aba.getRange(row, 2).setValue(r.tipo       || ""); // B – Tipo
    aba.getRange(row, 3).setValue(r.detalhes   || ""); // C – Detalhes
    aba.getRange(row, 4).setValue("monitoramento@viacaocatedral.com.br"); // D – Apuração
    aba.getRange(row, 5).setValue(r.status     || ""); // E – Status

    if (r.dataPostagem) {                              // F – Data postagem
      aba.getRange(row, 6).setValue(new Date(r.dataPostagem + "T12:00:00"));
    }
    if (r.dataFim) {                                   // G – Fim apuração
      aba.getRange(row, 7).setValue(new Date(r.dataFim + "T12:00:00"));
    }
    // H – Dias em aberto → calculado por fórmula na planilha, não escrevemos
    // I – Arquivo/Motorista → não utilizado neste fluxo

    aba.getRange(row, 10).setValue(r.observacoes || ""); // J – Observações
    aba.getRange(row, 11).setValue(r.base        || ""); // K – Base responsável
  });

  // Coluna L – Plantonista em célula mesclada para o grupo
  var rangeL = aba.getRange(linhaInicio, 12, itens.length, 1);
  if (itens.length > 1) rangeL.mergeVertically();
  rangeL.setValue(plantonista)
        .setVerticalAlignment("middle")
        .setHorizontalAlignment("center")
        .setTextRotation(90)
        .setWrap(false);

  return JSON.stringify({ ok: true, linhas: itens.length });
}
