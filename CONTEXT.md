# CourseGen AI — Contexto Arquitetural

## Objetivo

Aplicação Next.js que transforma uma Matriz DE do IFCE (`.docx`) em um backup Moodle (`.mbz`). O Gemini extrai um JSON estruturado; o usuário revisa esse JSON; o backend gera os XMLs e compacta o curso.

## Fluxo atual

```text
Browser                          Backend                         Google
  |                                |                               |
  | POST /api/extract (DOCX)       |                               |
  |------------------------------->| parser.js                     |
  |                                | extractor.js ---------------->|
  |                                |<------------------------------|
  |<-------------------------------| JSON estruturado              |
  |                                |                               |
  | POST /api/generate (JSON)      |                               |
  |------------------------------->| mbzGenerator                  |
  |<-------------------------------| curso_CODIGO.mbz              |
```

O navegador **não chama o Gemini diretamente**. A chave fornecida pela interface é enviada somente ao backend no header `X-Gemini-Key`. Quando esse header não existe, o backend usa `GEMINI_KEY`.

## Entradas HTTP

### `POST /api/extract`

Campos `multipart/form-data`:

- `matriz`: Matriz DE `.docx`, opcional quando a chamada contém apenas quizzes.
- `quizzes`: zero ou mais bancos de questões `.docx`.

Retorna `{ data }` para matriz ou `{ quizzes }` para extração isolada de quizzes. O backend cria arquivos temporários, chama o Gemini e sempre remove os temporários.

### `POST /api/generate`

Campos `multipart/form-data`:

- `matrizJson`: JSON revisado.
- `tarefas`: anexos opcionais.

Retorna o `.mbz`. Arquivos `tarefa_N.ext` são associados à N-ésima tarefa encontrada.

## Módulos do gerador MBZ

```text
server/mbzGenerator/
├── index.js            ciclo de vida, estrutura do curso e compactação
├── model.js            normalização, defaults, IDs e descritores
├── activityWriter.js   grava atividades, avaliações e anexos
├── builders.js         builders XML puros do Moodle
├── utils.js            XML, datas, títulos, MIME e arquivos Moodle
├── builders.test.js    testes dos builders
└── generator.test.js   modelo e geração integrada do MBZ
```

### Regras de manutenção

- Não colocar aritmética nova de IDs em `index.js` ou nos writers. Alterar `model.js`.
- Alterações em uma atividade específica pertencem a `activityWriter.js` e ao builder correspondente.
- Builders devem receber dados e retornar strings XML, sem escrever no disco.
- `generateMBZ()` deve continuar pequeno e responsável apenas pelo ciclo de vida do workspace/arquivo.
- Toda mudança de XML deve ganhar teste antes de alterar offsets ou referências cruzadas.
- A pasta temporária deve ser removida em `finally`.

## Estrutura gerada no Moodle

- Seção 0: apresentação/mural.
- Uma seção por aula.
- Seção `Avaliações`.
- Seção `Faltas`.
- Blocos laterais de professores, agenda e encontros virtuais.
- Livro de notas com categorias EaD e presencial.
- Avaliação final sempre presente.

Atividades suportadas: fórum, quiz, tarefa, chat, wiki e glossário. Chat e wiki usam assigns ocultos para lançamento de nota.

## Associação de arquivos

- Quizzes são associados por ordem aos objetos `aula.quiz`.
- `tarefa_1.*` é associada à primeira tarefa, `tarefa_2.*` à segunda etc.
- Anexos usam SHA-1 e `filearea=introattachment` no padrão do Moodle.

## Comandos

```bash
yarn dev
yarn test
yarn build
yarn start
```

Dependências ficam em `ui/`. Os scripts da raiz delegam para essa pasta.

## Configuração

```env
GEMINI_KEY=sua_chave
```

A chave também pode ser configurada no navegador. O modelo atual está definido em `server/extractor.js`.
