<p align="center">
  <img src="https://img.shields.io/badge/CourseGen-AI-6366f1?style=for-the-badge&logo=sparkles&logoColor=white" alt="CourseGen AI" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Moodle-MBZ-f98012?style=for-the-badge&logo=moodle&logoColor=white" />
</p>

<h1 align="center">CourseGen AI</h1>

<p align="center">
  Transforme documentos de planejamento de disciplinas em pacotes Moodle prontos para importar — com inteligência artificial.
</p>

---

## O que é

**CourseGen AI** é uma aplicação web que converte automaticamente a **Matriz DE** (documento de planejamento de disciplinas do IFCE, em `.docx`) em arquivos de backup Moodle (`.mbz`), prontos para importação na plataforma.

Todo o processo de leitura, interpretação e estruturação do conteúdo é feito pelo modelo **Google Gemini 2.5 Flash**, eliminando horas de trabalho manual de cadastro no Moodle.

---

## Funcionalidades

- **Extração inteligente** — lê a Matriz DE e identifica automaticamente nome, código, ementa, objetivos, cronograma, atividades e avaliações
- **Suporte a quizzes** — importa arquivos de questões (`.docx`) e os associa às atividades corretas
- **Suporte a tarefas** — anexa arquivos de tarefas às atividades de entrega
- **Editor de revisão** — visualize e edite o JSON extraído antes de gerar o pacote
- **Builder manual** — crie a estrutura da disciplina do zero, sem precisar de documentos
- **Geração completa de MBZ** — gera o XML compatível com o formato Moodle 2.x com seções, fóruns, quizzes, tarefas, wikis, glossários, chats e encontros
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
| IA | Google Gemini 2.5 Flash (`@google/genai`) |
| Leitura de DOCX | mammoth.js |
| Geração de MBZ | archiver.js + XML programático |
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
git clone https://github.com/seu-usuario/coursegen-ai.git
cd coursegen-ai/ui

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
├── ui/
│   ├── app/
│   │   ├── api/
│   │   │   ├── preview/       # Extração da Matriz via Gemini
│   │   │   ├── quizzes/       # Extração de questões via Gemini
│   │   │   └── generate/      # Geração do arquivo .mbz
│   │   ├── components/
│   │   │   ├── UploadStep     # Passo 1 — upload de arquivos
│   │   │   ├── ReviewStep     # Passo 2 — revisão do JSON
│   │   │   ├── BuilderStep    # Modo manual de criação
│   │   │   └── DoneStep       # Passo 3 — confirmação de download
│   │   └── lib/
│   │       ├── api.ts         # Funções de fetch para as rotas
│   │       └── useJsonHistory # Histórico local de extrações
│   └── server/
│       ├── extractor.js       # Lógica de chamada ao Gemini
│       ├── parser.js          # Leitura de DOCX com mammoth
│       └── mbzGenerator/
│           ├── index.js       # Orquestração do pipeline MBZ
│           ├── builders.js    # Construtores de XML Moodle
│           └── utils.js       # Helpers de XML, SHA1 e datas
└── package.json
```

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `GEMINI_KEY` | Chave de API do Google Gemini (obrigatória) |
