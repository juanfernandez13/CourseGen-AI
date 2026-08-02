<p align="center">
  <img src="https://img.shields.io/badge/CourseGen-AI-6366f1?style=for-the-badge&logo=sparkles&logoColor=white" alt="CourseGen AI" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/Gemini-3_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Moodle-MBZ-f98012?style=for-the-badge&logo=moodle&logoColor=white" />
</p>

<h1 align="center">CourseGen AI</h1>

<p align="center">
  Transforme documentos de planejamento de disciplinas em pacotes Moodle prontos para importar — com inteligência artificial.
</p>

---

## O que é

**CourseGen AI** é uma aplicação web que converte automaticamente a **Matriz DE** (documento de planejamento de disciplinas do IFCE, em `.docx`) em arquivos de backup Moodle (`.mbz`), prontos para importação na plataforma.

Todo o processo de leitura, interpretação e estruturação do conteúdo é feito pelo modelo **Google Gemini 3 Flash**, eliminando horas de trabalho manual de cadastro no Moodle.

---

## Funcionalidades

- **Extração inteligente** — lê a Matriz DE e identifica automaticamente nome, código, ementa, objetivos, cronograma, atividades e avaliações
- **Suporte a quizzes** — importa arquivos de questões (`.docx`) e os associa às atividades corretas
- **Suporte a tarefas** — anexa arquivos de tarefas às atividades de entrega
- **Associação flexível de anexos** — reconhece `Tarefa 1`, `tarefa_1` e usa ordem alfabética quando não há número
- **Editor de revisão** — visualize e edite o JSON extraído antes de gerar o pacote
- **Builder manual** — crie a estrutura da disciplina do zero, sem precisar de documentos
- **Geração completa de MBZ** — gera o XML compatível com o formato Moodle 2.x com seções, fóruns, quizzes, tarefas, wikis, glossários, chats e encontros
- **Cadastro em lote de alunos** — converte a planilha da turma em CSV de importação do Moodle, com validação de CPF e e-mail e revisão antes de gerar
- **Livro de notas configurável** — categorias, pesos e quais atividades entram em cada uma
- **Tema claro/escuro** — interface responsiva com suporte a modo escuro nativo

---

## Fluxo de uso

```
1. Upload          →   2. Revisão         →   3. Download
────────────────       ─────────────────       ────────────────
Suba a Matriz DE       Revise e edite o        Baixe o .mbz e
+ quizzes + tarefas    JSON extraído pela IA   importe no Moodle
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Estilização | Tailwind CSS v4 |
| IA | Google Gemini (`@google/genai`, chamada no backend) |
| Leitura de DOCX | mammoth.js |
| Leitura de planilhas | exceljs (`.xlsx`/`.xls`) + parser próprio de CSV |
| Geração de MBZ | archiver.js + XML programático |
| Uploads grandes | Vercel Blob (`@vercel/blob`), com envio direto do browser |
| Utilitários | uuid, jsonrepair, pdfjs-dist |

---

## Instalação

### Pré-requisitos

- Node.js 18+
- Yarn
- Chave de API do [Google AI Studio](https://aistudio.google.com/app/apikey)

### Passos

```bash
# Clone o repositório
git clone git@github.com:juanfernandez13/CourseGen-AI.git
cd CourseGen-AI/ui

# Instale as dependências
yarn install

# Configure as variáveis de ambiente
echo "GEMINI_KEY=sua_chave_aqui" > .env.local

# Inicie o servidor de desenvolvimento
yarn dev
```

Acesse em [http://localhost:3000](http://localhost:3000).

---

## Estrutura do projeto

```
.
├── AGENTS.md                   # Instruções para agentes de IA (CLAUDE.md importa)
├── ui/
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract/        # Matriz e quizzes → JSON, via Gemini
│   │   │   ├── generate/       # JSON + anexos → .mbz (resposta em stream)
│   │   │   ├── alunos/         # extract: planilha → registros; csv: um por curso
│   │   │   ├── blob-upload/    # Assina o upload direto do browser
│   │   │   ├── prompt/         # Prompt de extração + exemplo, para outra IA
│   │   │   └── health/         # Chave do servidor e Blob disponíveis?
│   │   ├── cadastro-lote/      # Tela de cadastro em lote de alunos
│   │   ├── components/
│   │   │   ├── UploadStep      # Passo 1 — upload de arquivos
│   │   │   ├── ReviewStep      # Passo 2 — revisão do JSON
│   │   │   ├── GradebookEditor # Categorias e pesos do livro de notas
│   │   │   ├── BuilderStep     # Modo manual de criação
│   │   │   └── DoneStep        # Passo 3 — confirmação de download
│   │   └── lib/
│   │       ├── api.ts          # Funções de fetch para as rotas
│   │       ├── uploads.ts      # Envio direto ao Blob quando há store
│   │       └── useJsonHistory  # Histórico local de extrações
│   └── server/
│       ├── extractor.js        # Prompts e chamadas ao Gemini
│       ├── parser.js           # Leitura de DOCX com mammoth
│       ├── planilha.js         # Leitura de XLSX/CSV
│       ├── alunos.js           # Validação de CPF/e-mail e montagem do CSV
│       ├── taskFileMapper.js   # Associa arquivos a tarefas e quizzes pelo nome
│       ├── blobStore.ts        # Adapter do Vercel Blob
│       └── mbzGenerator/
│           ├── index.js        # Ciclo de vida do pipeline MBZ
│           ├── model.js        # Normalização, categorias e IDs do Moodle
│           ├── activityWriter.js # Escrita das atividades
│           ├── builders.js     # Construtores de XML Moodle
│           └── utils.js        # Helpers de XML, SHA1 e datas
└── package.json
```

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `GEMINI_KEY` | Chave do Google Gemini. Opcional se cada usuário informar a sua na interface |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob. Sem ele, os arquivos vão direto para as rotas — o que basta em desenvolvimento, onde não existe o limite de 4,5 MB da Vercel |

---

## Importando no Moodle

Restaure o `.mbz` num **curso novo e vazio**, marcando *"sobrescrever a configuração
do curso"*. Ao mesclar num curso já existente, o Moodle não recria as categorias do
livro de notas e as atividades aparecem soltas na raiz.
