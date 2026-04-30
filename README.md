# BI Operacional - Controle de Ocorrencias

Aplicacao web criada em Google Apps Script para acompanhar, registrar e apresentar ocorrencias operacionais da Viacao Catedral a partir de uma planilha Google Sheets.

O projeto entrega dois modos principais:

- **Dashboard operacional**: filtros por periodo, tipo e veiculo, KPIs, graficos, rankings, documentos vinculados e registro de novas ocorrencias.
- **Modo apresentacao**: visual de tela cheia para reunioes, com slides automaticos, configuracao de periodo e selecao dos tipos de ocorrencia exibidos.

## Stack

- Google Apps Script com runtime V8.
- Google Sheets como base de dados.
- Google Drive para busca de documentos vinculados.
- HTML, CSS e JavaScript no Google Apps Script HTML Service.
- Chart.js 4.4.1 via CDN.
- Google Fonts via CDN.
- clasp para sincronizacao local com o projeto Apps Script.

## Estrutura do Projeto

| Arquivo | Descricao |
| --- | --- |
| `Código.js` | Backend do Apps Script. Expoe o Web App, le dados da planilha, busca documentos no Drive e grava novas ocorrencias. |
| `index.html` | Interface principal do dashboard operacional. |
| `apresentacao.html` | Interface do modo apresentacao em slides. |
| `abrirDashboard.js` | Menu/dialogo auxiliar dentro da planilha para abrir dashboard ou apresentacao. |
| `appsscript.json` | Manifesto do Apps Script com runtime, escopos OAuth, servicos avancados e configuracao do Web App. |
| `.clasp.example.json` | Exemplo de configuracao local do clasp sem expor o `scriptId` real. |
| `.gitignore` | Arquivos locais, credenciais e artefatos que nao devem ser versionados. |

## Como a Aplicacao Funciona

### Backend Apps Script

O arquivo `Código.js` concentra as funcoes chamadas pelo frontend:

- `doGet(e)`: decide qual tela entregar. Por padrao abre o dashboard; com `?view=apresentacao` abre o modo apresentacao.
- `getWebAppUrl()`: retorna a URL publicada do Web App para montar links internos.
- `getDados(dataIni, dataFim)`: le a aba `CONTROLE`, filtra por periodo, normaliza os dados e devolve JSON para o frontend.
- `getUrlArquivo(nomeArquivo)`: busca sob demanda a URL de um documento no Drive.
- `registrarOcorrencias(json)`: recebe registros do dashboard e grava novas linhas na aba `CONTROLE`.

### Dashboard

O `index.html` carrega dados por periodo usando `google.script.run.getDados`, monta graficos com Chart.js e permite:

- filtrar por data inicial, data final, tipo e prefixo;
- visualizar KPIs de total, tipo mais frequente, veiculo critico e incidentes com passageiros;
- analisar distribuicao por tipo, volume por data, reincidencia por veiculo, bases regionais e responsaveis;
- buscar documentos vinculados no Drive;
- registrar ocorrencias diretamente na aba `CONTROLE`.

### Modo Apresentacao

O `apresentacao.html` tambem usa `google.script.run.getDados`, mas organiza as informacoes em slides para exibicao em tela cheia. Ele permite configurar periodo, usar atalhos de periodo como hoje/ultimos 7 dias/mes atual, selecionar tipos de ocorrencia e ativar autoplay.

### Dialogo na Planilha

O `abrirDashboard.js` cria um modal dentro da planilha com atalhos para abrir:

- Dashboard;
- Modo apresentacao.

## Estrutura Esperada da Planilha

A aplicacao usa a planilha ativa do projeto Apps Script e espera uma aba chamada `CONTROLE`.

Colunas lidas/escritas:

| Coluna | Campo | Uso |
| --- | --- | --- |
| A | Prefixo | Identificacao do veiculo. |
| B | Tipo | Tipo da ocorrencia. |
| C | Detalhes | Descricao resumida. |
| D | Apuracao | Preenchida no registro com email padrao do monitoramento. |
| E | Status | Status da ocorrencia. |
| F | Data postagem | Data principal usada nos filtros. |
| G | Fim apuracao | Data final da apuracao, quando informada. |
| H | Dias em aberto | Mantida pela planilha; o Apps Script nao escreve nessa coluna. |
| I | Arquivo/Motorista | Nome do arquivo ou identificacao usada para extrair motorista. |
| J | Observacoes | Observacoes adicionais. |
| K | Base responsavel | Base operacional responsavel. |
| L | Plantonista | Plantonista/CCO, com suporte a celulas mescladas. |

Tambem pode existir uma aba `gestores`, com:

| Coluna | Campo |
| --- | --- |
| A | Base |
| B | Gestor |

Essa aba alimenta os nomes de gestores exibidos nos rankings.

## Configuracao

### 1. Instalar clasp

```bash
npm install -g @google/clasp
clasp login
```

### 2. Configurar o projeto local

Copie o arquivo de exemplo e informe o ID real do projeto Apps Script:

```bash
cp .clasp.example.json .clasp.json
```

Depois edite `.clasp.json` localmente e preencha `scriptId`.

> Importante: `.clasp.json` fica ignorado pelo Git porque contem o ID real do projeto Apps Script.

### 3. Enviar arquivos para o Apps Script

```bash
clasp push
```

### 4. Publicar como Web App

No Apps Script:

1. Abra **Deploy > Manage deployments**.
2. Crie ou edite um deploy do tipo **Web app**.
3. Use as configuracoes adequadas ao ambiente.

O manifesto atual define:

- `executeAs`: `USER_DEPLOYING`;
- `access`: `ANYONE_ANONYMOUS`.

Essa combinacao permite acesso anonimo ao Web App publicado. Revise antes de publicar em ambiente externo.

## Escopos e Permissoes

O `appsscript.json` solicita:

- acesso a planilhas (`spreadsheets`);
- acesso ao Drive (`drive`);
- deploy de Web App (`script.webapp.deploy`);
- email do usuario (`userinfo.email`);
- servico avancado do Drive v3.

Como o app consulta dados operacionais e documentos no Drive, revise compartilhamentos da planilha, pasta de documentos e deploy sempre que o repositorio for tornado publico ou compartilhado fora da equipe.

## Pontos de Seguranca Identificados

Durante a analise nao encontrei senha, token, chave privada, chave de API ou credencial de service account.

Foram encontrados pontos que merecem cuidado:

- `.clasp.json` contem o `scriptId` real do projeto Apps Script. O arquivo foi adicionado ao `.gitignore` e existe `.clasp.example.json` para documentar o formato seguro.
- `Código.js` contem um ID fixo de pasta do Google Drive em `OCORRENCIAS_FOLDER_ID`. ID de pasta nao e senha, mas expor esse valor em repositorio publico pode revelar estrutura interna. Para maior seguranca, considere mover esse valor para `PropertiesService.getScriptProperties()`.
- `appsscript.json` publica o Web App com `access: ANYONE_ANONYMOUS`. Isso pode ser correto para o uso atual, mas deve ser revisado caso os dados nao possam ficar acessiveis por link publico.
- O app usa escopo amplo de Drive (`https://www.googleapis.com/auth/drive`). Se possivel, avalie reduzir escopos em uma revisao futura.

## Recomendacoes Antes de Subir para o Git

- Nao versionar `.clasp.json`.
- Nao versionar arquivos `.env`, credenciais JSON, tokens ou chaves privadas.
- Confirmar se o repositorio sera privado.
- Revisar se o ID da pasta do Drive pode permanecer no codigo.
- Revisar o acesso anonimo do Web App no `appsscript.json`.
- Confirmar que a planilha e a pasta de documentos possuem compartilhamento restrito.

## Fluxo de Desenvolvimento

Com o `.clasp.json` configurado localmente:

```bash
clasp pull
clasp push
```

Use `clasp pull` para baixar alteracoes feitas direto no Apps Script e `clasp push` para enviar alteracoes locais.

Antes de publicar:

```bash
git status
git diff
```

Verifique se nenhum arquivo sensivel aparece nas alteracoes.

## Manutencao

Ao alterar a estrutura da planilha, revise:

- indices de coluna em `getDados`;
- montagem do payload em `registrarOcorrencias`;
- filtros e renderizacoes em `index.html`;
- slides e classificacoes em `apresentacao.html`.

Ao alterar tipos de ocorrencia, revise tambem as funcoes de normalizacao e classificacao usadas no dashboard e no modo apresentacao.
