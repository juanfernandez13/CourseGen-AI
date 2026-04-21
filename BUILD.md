# Build & Execução — Matriz DE → Moodle (.mbz)

## Pré-requisitos

| Ferramenta | Versão mínima | Verificar com |
|------------|---------------|---------------|
| Node.js    | 18+           | `node -v`     |
| Yarn       | 1.x           | `yarn -v`     |

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```
GEMINI_KEY=sua_chave_gemini_aqui
```

A chave é obtida no [Google AI Studio](https://aistudio.google.com/apikey). Sem ela, as rotas de API retornam erro.

## Instalação

```bash
# Dependências do projeto
cd ui && yarn install
```

## Executando

### Desenvolvimento

```bash
yarn dev       # na raiz, ou: cd ui && yarn dev
```

Acesse `http://localhost:3000`. O Next.js serve tanto o frontend quanto as API Routes (backend).

### Produção

```bash
yarn build     # gera build otimizado
yarn start     # serve na porta 3000
```

## Estrutura do projeto

```
├── .env                              # Chave Gemini (não versionado)
├── package.json                      # Scripts wrapper (dev/build/start → ui/)
├── ui/                               # Projeto Next.js (frontend + backend)
│   ├── app/
│   │   ├── page.tsx                  # Página principal (wizard de 3 etapas)
│   │   ├── layout.tsx                # Layout raiz
│   │   ├── globals.css               # Estilos globais (Tailwind)
│   │   ├── components/
│   │   │   ├── UploadStep.tsx        # Etapa 1: upload de arquivos
│   │   │   ├── ReviewStep.tsx        # Etapa 2: revisar/editar JSON
│   │   │   ├── DoneStep.tsx          # Etapa 3: download do .mbz
│   │   │   ├── StepIndicator.tsx     # Indicador de progresso
│   │   │   ├── FileViewer.tsx        # Visualizador de arquivos
│   │   │   └── ThemeProvider.tsx     # Tema claro/escuro
│   │   ├── lib/
│   │   │   └── api.ts               # Funções fetch para as API Routes
│   │   └── api/                      # Backend (Next.js API Routes)
│   │       ├── preview/route.ts      # POST: matriz.docx → JSON via Gemini
│   │       ├── generate/route.ts     # POST: JSON + arquivos → .mbz
│   │       └── quizzes/route.ts      # POST: quiz.docx → questões extraídas
│   ├── server/                       # Lógica core (usada pelas API Routes)
│   │   ├── parser.js                 # Extrai texto de DOCX (mammoth)
│   │   ├── extractor.js              # Chamadas ao Gemini para extração
│   │   └── mbzGenerator/
│   │       ├── index.js              # Orquestrador da geração .mbz
│   │       ├── builders.js           # Builders de XML Moodle
│   │       └── utils.js              # Utilitários (IDs, SHA1, etc.)
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json                  # Dependências reais do projeto
```

## API Routes

Todas as rotas são `POST` e recebem `multipart/form-data`:

| Rota | Campos | Retorno |
|------|--------|---------|
| `/api/preview` | `matriz` (docx), `quizzes[]` (docx) | `{ success, data }` — JSON estruturado |
| `/api/generate` | `matrizJson` (string), `quizzes[]` (docx), `tarefas[]` (qualquer) | Arquivo `.mbz` para download |
| `/api/quizzes` | `quizzes[]` (docx) | `{ quizzes }` — questões extraídas |

## Pipeline de dados

```
matriz.docx ──→ parser.js (mammoth) ──→ texto puro
                                            │
                                            ▼
                                    extractor.js (Gemini 2.5 Flash)
                                            │
                                            ▼
                                    JSON estruturado
                                            │
quiz_N.docx ──→ extractor.js ──────────────→├── questões injetadas nos quizzes
tarefa_N.*  ───────────────────────────────→├── arquivos anexados às tarefas
                                            │
                                            ▼
                                    mbzGenerator/ ──→ curso_CODIGO.mbz
```

## Fluxo do usuário na UI

1. **Upload** — envia matriz.docx + quizzes (opcional) + tarefas (opcional)
2. **Review** — visualiza/edita o JSON extraído pelo Gemini
3. **Download** — gera e baixa o arquivo `.mbz` pronto para importar no Moodle

## Notas

- Documentos grandes (>300k caracteres) são divididos automaticamente em 2 partes para o Gemini.
- Rate limits do Gemini (429) são tratados com retry automático (até 5 tentativas).
- O arquivo `.mbz` é um tar.gz com XMLs no formato de backup do Moodle 2.x.
- Arquivos temporários de upload são salvos em `os.tmpdir()` e removidos após processamento.
