// ============================================================
//  BI Ocorrências — Viação Catedral
//  Code.gs — Google Apps Script Backend
//  Dev: Lucas Inácio
//  Fonte de dados: Notion (database de Ocorrências)
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

// Extrai nome do motorista a partir do campo "Arquivo" no formato "0004 - NOME".
// Aceita hífen (-) e travessões (–, —) misturados.
function extrairMotorista(raw) {
  let s = String(raw || "").trim();

  // vazio ou marcador genérico
  if (!s || s === "Arquivo") return "(sem motorista)";

  // remove extensão (.pdf, .docx etc.)
  s = s.replace(/\.[^.\s]+$/, "").trim();

  // normaliza todos os tipos de traço para hífen simples
  s = s.replace(/[–—]/g, "-");

  // Esperamos algo como "4165 - NOME DO MOTORISTA - OUTRAS COISAS"
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

// ------------------------
// 3. Drive / Documentos  (mantido — anexos continuam no Drive)
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
// 4. Configuração / cliente Notion
// ------------------------
// Versão da API do Notion (estável).
const NOTION_VERSION = "2022-06-28";

// Nomes das propriedades no database do Notion.
// Se você renomear um campo no Notion, ajuste aqui — é o único ponto de acoplamento.
const NP = {
  prefixo: "Prefixo", // Title
  tipo: "Tipo", // Select
  detalhes: "Detalhes", // Text
  apuracao: "Apuração", // Text (email do monitoramento)
  status: "Status", // Select
  dataPostagem: "Data postagem", // Date (usado nos filtros)
  fimApuracao: "Fim apuração", // Date
  arquivo: "Arquivo", // Text ("0004 - NOME"); usado p/ Drive e motorista
  observacoes: "Observações", // Text
  base: "Base", // Select
  plantonista: "Plantonista", // Text
};

let _cfgCache = null;
function _notionConfig() {
  if (_cfgCache) return _cfgCache;
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("NOTION_TOKEN");
  const dbId = props.getProperty("NOTION_DB_ID");
  if (!token || !dbId) {
    throw new Error(
      "Configure NOTION_TOKEN e NOTION_DB_ID nas Propriedades do Script " +
        "(Configurações do projeto → Propriedades do script).",
    );
  }
  _cfgCache = { token: token, dbId: dbId };
  return _cfgCache;
}

// Mapa Base → Gestor (substitui a antiga aba "gestores").
// Guardado como JSON na propriedade de script GESTORES_MAP.
function _gestoresMap() {
  const raw = PropertiesService.getScriptProperties().getProperty("GESTORES_MAP");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    Logger.log("GESTORES_MAP inválido (não é JSON): " + e);
    return {};
  }
}

// POST genérico para a API do Notion.
function _notionFetch(path, payload) {
  const cfg = _notionConfig();
  const res = UrlFetchApp.fetch("https://api.notion.com/v1" + path, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + cfg.token,
      "Notion-Version": NOTION_VERSION,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Notion API " + code + ": " + body);
  }
  return JSON.parse(body);
}

// --- Leitores de propriedades do Notion ---
function _readTexto(prop) {
  if (!prop) return "";
  const arr = prop.rich_text || prop.title;
  if (!arr || !arr.length) return "";
  return arr
    .map(function (t) {
      return t.plain_text || "";
    })
    .join("")
    .trim();
}

function _readSelect(prop) {
  return prop && prop.select ? String(prop.select.name).trim() : "";
}

function _readData(prop) {
  return prop && prop.date && prop.date.start ? prop.date.start : null;
}

// Aceita tanto Select quanto Text para o mesmo campo (tolerante a como você montou o DB)
function _readSelectOuTexto(prop) {
  return _readSelect(prop) || _readTexto(prop);
}

// Constrói o array rich_text/title a partir de uma string
function _toRich(s) {
  return [{ text: { content: String(s == null ? "" : s) } }];
}

// ------------------------
// 5. Dados / BI  (modo híbrido: planilha [histórico] + Notion [novos])
// ------------------------
// getDados() — mescla o histórico antigo (Google Sheets) com os registros
// novos (Notion) dentro do período pedido. Nada do passado se perde.
function getDados(dataIni, dataFim) {
  const daPlanilha = _getDadosPlanilha(dataIni, dataFim);
  const doNotion = _getDadosNotion(dataIni, dataFim);
  // Histórico primeiro, novos depois.
  return JSON.stringify(daPlanilha.concat(doNotion));
}

// --- Fonte NOVA: Notion ---
function _getDadosNotion(dataIni, dataFim) {
  const cfg = _notionConfig();
  const gestoresMap = _gestoresMap();

  // Filtro de período direto na origem (mais eficiente que ler tudo).
  const filtro = {
    and: [
      { property: NP.dataPostagem, date: { on_or_after: dataIni } },
      { property: NP.dataPostagem, date: { on_or_before: dataFim } },
    ],
  };

  const registros = [];
  let cursor = null;

  do {
    const payload = {
      filter: filtro,
      page_size: 100,
      sorts: [{ property: NP.dataPostagem, direction: "ascending" }],
    };
    if (cursor) payload.start_cursor = cursor;

    const data = _notionFetch("/databases/" + cfg.dbId + "/query", payload);
    const results = data.results || [];

    results.forEach(function (page) {
      const p = page.properties || {};

      const dStart = _readData(p[NP.dataPostagem]);
      if (!dStart) return; // sem data não entra (igual ao comportamento antigo)
      const dataFmt = String(dStart).substring(0, 10); // YYYY-MM-DD

      const arquivo = _readTexto(p[NP.arquivo]);
      const base = _readSelectOuTexto(p[NP.base]);

      registros.push({
        prefixo: _readSelectOuTexto(p[NP.prefixo]),
        tipo: _readSelectOuTexto(p[NP.tipo]),
        detalhes: _readTexto(p[NP.detalhes]),
        status: _readSelectOuTexto(p[NP.status]),
        data: dataFmt,
        arquivo: arquivo,
        motorista: extrairMotorista(arquivo),
        plantonista: _readSelectOuTexto(p[NP.plantonista]),
        observacoes: _readTexto(p[NP.observacoes]),
        base: base,
        gestor: gestoresMap[base] || "",
        origem: "notion",
      });
    });

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return registros;
}

// --- Fonte HISTÓRICA: Google Sheets (aba CONTROLE) ---
// Mantida read-only. Se a propriedade de script PLANILHA_ATE (YYYY-MM-DD)
// estiver definida e o período pedido começar depois dela, a planilha é
// ignorada (otimização: não lê o histórico quando só se quer dados novos).
function _getDadosPlanilha(dataIni, dataFim) {
  try {
    const corte = PropertiesService.getScriptProperties().getProperty("PLANILHA_ATE");
    if (corte && dataIni > corte) {
      return []; // período começa depois do fim do histórico → nem abre a planilha
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return [];

    const aba = ss.getSheetByName("CONTROLE");
    if (!aba) return [];

    const gestoresMap = _gestoresMap();
    const ultLinha = aba.getLastRow();

    const LINHA_INI = 2; // dados começam na linha 2 (cabeçalho na 1)
    const NUM_COLS = 12; // colunas A..L
    if (ultLinha < LINHA_INI) return [];

    const valores = aba
      .getRange(LINHA_INI, 1, ultLinha - LINHA_INI + 1, NUM_COLS)
      .getValues();

    // Índices 0-based
    const COL_PREFIXO = 0; // A
    const COL_TIPO = 1; // B
    const COL_DETALHES = 2; // C
    const COL_STATUS = 4; // E
    const COL_DATA = 5; // F
    const COL_ARQUIVO = 8; // I
    const COL_OBS = 9; // J
    const COL_BASE = 10; // K
    const COL_PLANTONISTA = 11; // L (célula mesclada)

    const dtIni = new Date(dataIni + "T00:00:00");
    const dtFim = new Date(dataFim + "T23:59:59");

    // Preenche para baixo a coluna mesclada (plantonista)
    let ultimoPlantonista = "";
    const plantonistaPorLinha = valores.map(function (row) {
      const val = String(row[COL_PLANTONISTA] || "").trim();
      if (val !== "") ultimoPlantonista = val;
      return ultimoPlantonista;
    });

    function normData(val) {
      if (!val) return null;
      if (val instanceof Date) return val;
      const parts = String(val).split("/");
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]); // dd/mm/yyyy
      }
      return new Date(val);
    }

    const registros = [];
    valores.forEach(function (row, i) {
      const dataBruta = normData(row[COL_DATA]);
      if (!dataBruta || isNaN(dataBruta)) return;
      if (dataBruta < dtIni || dataBruta > dtFim) return;

      const y = dataBruta.getFullYear();
      const m = String(dataBruta.getMonth() + 1).padStart(2, "0");
      const d = String(dataBruta.getDate()).padStart(2, "0");
      const base = String(row[COL_BASE] || "").trim();

      registros.push({
        prefixo: String(row[COL_PREFIXO] || "").trim(),
        tipo: String(row[COL_TIPO] || "").trim(),
        detalhes: String(row[COL_DETALHES] || "").trim(),
        status: String(row[COL_STATUS] || "").trim(),
        data: y + "-" + m + "-" + d,
        arquivo: String(row[COL_ARQUIVO] || "").trim(),
        motorista: extrairMotorista(row[COL_ARQUIVO]),
        plantonista: plantonistaPorLinha[i],
        observacoes: String(row[COL_OBS] || "").trim(),
        base: base,
        gestor: gestoresMap[base] || "",
        origem: "planilha",
      });
    });

    return registros;
  } catch (e) {
    // Se a planilha não estiver acessível, não derruba os dados do Notion.
    Logger.log("Falha ao ler planilha (histórico): " + e);
    return [];
  }
}

// ------------------------
// 6. Registro de ocorrências via dashboard  (cria páginas no Notion)
// ------------------------
function registrarOcorrencias(json) {
  const payload = JSON.parse(json);
  const plantonista = String(payload.plantonista || "").trim();
  const itens = payload.registros || [];

  if (!itens.length) throw new Error("Nenhum registro para salvar.");

  const cfg = _notionConfig();
  let salvos = 0;

  itens.forEach(function (r) {
    const props = {};

    // Prefixo é o título da página (nome do veículo)
    props[NP.prefixo] = { title: _toRich(r.prefixo || "") };

    if (r.tipo) props[NP.tipo] = { select: { name: String(r.tipo).trim() } };
    if (r.detalhes) props[NP.detalhes] = { rich_text: _toRich(r.detalhes) };

    // Apuração: e-mail padrão do monitoramento (igual ao fluxo antigo)
    props[NP.apuracao] = {
      rich_text: _toRich("monitoramento@viacaocatedral.com.br"),
    };

    if (r.status) props[NP.status] = { select: { name: String(r.status).trim() } };
    if (r.dataPostagem) props[NP.dataPostagem] = { date: { start: r.dataPostagem } };
    if (r.dataFim) props[NP.fimApuracao] = { date: { start: r.dataFim } };
    if (r.observacoes) props[NP.observacoes] = { rich_text: _toRich(r.observacoes) };
    if (r.base) props[NP.base] = { select: { name: String(r.base).trim() } };
    if (plantonista) props[NP.plantonista] = { rich_text: _toRich(plantonista) };

    _notionFetch("/pages", {
      parent: { database_id: cfg.dbId },
      properties: props,
    });
    salvos++;
  });

  return JSON.stringify({ ok: true, linhas: salvos });
}
