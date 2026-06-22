# Migração para o Notion — Guia de Configuração

A fonte de dados saiu do Google Sheets e passou a ser um **database do Notion**.
O backend (`Código.js`) lê e grava via API do Notion (`getDados` / `registrarOcorrencias`).
O front-end (`index.html`, `apresentacao.html`) e o deploy do Web App **não mudaram**.

## 1. Criar a integração no Notion

1. Acesse https://www.notion.so/my-integrations
2. **New integration** → dê um nome (ex.: `BI Ocorrências`) e associe ao seu workspace.
3. Tipo: **Internal**.
4. Copie o **Internal Integration Secret** (começa com `ntn_` ou `secret_`). É o seu `NOTION_TOKEN`.

## 2. Criar o database de Ocorrências

Crie um database (tabela) no Notion com **exatamente** estas propriedades
(o nome precisa bater com o código — definidos na constante `NP` em `Código.js`):

| Propriedade no Notion | Tipo no Notion | Observação |
| --- | --- | --- |
| `Prefixo` | **Title** | É o título da página = número do veículo |
| `Tipo` | Select | Tipos de ocorrência |
| `Detalhes` | Text | Descrição resumida |
| `Apuração` | Text | Preenchido no registro com o e-mail do monitoramento |
| `Status` | Select | Status da ocorrência |
| `Data postagem` | **Date** | Usado nos filtros de período |
| `Fim apuração` | Date | Data final da apuração |
| `Arquivo` | Text | Formato `0004 - NOME`; usado p/ buscar doc no Drive e extrair motorista |
| `Observações` | Text | Observações adicionais |
| `Base` | Select | Base responsável |
| `Plantonista` | Text | CCO responsável (antes era a coluna mesclada L) |

> O código é tolerante: campos como `Tipo`, `Status`, `Base`, `Prefixo` e `Plantonista`
> funcionam tanto como **Select** quanto como **Text**. Recomendo **Select** para
> `Tipo`, `Status` e `Base` (filtros e Kanban saem de graça).

> A antiga coluna H "Dias em aberto" não é usada pelo dashboard — pode criar como
> propriedade **Formula** no Notion só para sua visualização, se quiser.

### Compartilhar o database com a integração

No database aberto: menu **•••** (canto superior) → **Connections / Conexões** →
adicione a integração `BI Ocorrências`. **Sem isso a API retorna 404/403.**

### Pegar o ID do database

Abra o database como página inteira. A URL fica assim:

```
https://www.notion.so/<workspace>/<DATABASE_ID>?v=<view_id>
```

O `DATABASE_ID` é a sequência de 32 caracteres (com ou sem hífens) antes do `?v=`.
É o seu `NOTION_DB_ID`.

## 3. Importar os dados atuais da planilha (opcional)

No Notion: **Import** → **CSV** e suba a aba `CONTROLE` exportada como CSV.
Depois confira/ajuste o mapeamento das colunas para as propriedades acima.

## 4. Configurar as Propriedades do Script (Apps Script)

No editor do Apps Script: **Configurações do projeto (engrenagem)** →
**Propriedades do script** → adicione:

| Propriedade | Valor |
| --- | --- |
| `NOTION_TOKEN` | o secret da integração (passo 1) |
| `NOTION_DB_ID` | o ID do database (passo 2) |
| `GESTORES_MAP` | JSON `Base → Gestor` (substitui a aba "gestores") |

Exemplo de `GESTORES_MAP`:

```json
{ "Base Norte": "Ana Lima", "Base Sul": "Carlos Souza", "Garagem Central": "Marta Reis" }
```

> Esses valores **não** vão para o Git — ficam só no projeto Apps Script.

## 5. Push e autorização

```bash
clasp push
```

O `appsscript.json` agora pede o escopo `script.external_request` (necessário para
o `UrlFetchApp` chamar o Notion). Na primeira execução o Apps Script vai pedir para
**reautorizar** os escopos — aceite.

## 6. Testar

1. No editor, rode `getDados("2026-01-01","2026-12-31")` e veja o log/retorno.
2. Abra o Web App (dashboard) e confirme que os dados aparecem.
3. Registre uma ocorrência de teste pelo dashboard e confira se a página foi criada no Notion.

## Observações técnicas

- **Paginação**: o Notion entrega até 100 itens por chamada; `getDados` já faz o loop com `start_cursor`.
- **Filtro na origem**: o período é filtrado na própria query do Notion (mais leve que ler tudo).
- **Anexos**: continuam no Google Drive — `buscarUrlNoDrive`/`getUrlArquivo` não mudaram.
- **Acoplamento**: se renomear um campo no Notion, ajuste só a constante `NP` no topo da seção 4 do `Código.js`.
