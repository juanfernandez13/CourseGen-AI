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

### Dois caminhos de upload

A Vercel rejeita corpo de requisição acima de 4,5 MB na edge, antes da função rodar.
Com um Blob store conectado (`BLOB_READ_WRITE_TOKEN`), o browser envia os arquivos
direto ao storage e as rotas recebem apenas URLs; os blobs são apagados assim que o
processamento termina. Sem o token — o caso local — as rotas recebem o arquivo no
`FormData`, como antes. Quem decide é `server/blobStore.ts`; a UI consulta
`/api/health`.

O `.mbz` volta em streaming, não em buffer: resposta não-streamed também tem teto
na Vercel.

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

## Cadastro em lote de alunos

Tela `/cadastro-lote`: planilha (`.xlsx`/`.xls`/`.csv`) → revisão → um CSV por curso.

- `server/planilha.js` lê a planilha com o exceljs; tudo vira string, senão um CPF
  gravado como número perde o zero à esquerda.
- `server/alunos.js` tem o prompt, a validação e a montagem do CSV. O Gemini apenas
  mapeia colunas bagunçadas e separa nome de sobrenome; **CPF e e-mail são validados
  em código**, incluindo dígito verificador. CPF malformado é copiado como veio e
  sinalizado, nunca corrigido.
- Defaults: senha sempre `abcd1234`, cidade ausente vira `Fortaleza`, `type1` aceita
  só 1 (aluno) ou 2 (professor).
- A revisão é obrigatória e toda célula é editável. `course1` é do lote inteiro, não
  por linha, e cada curso da lista gera um arquivo.

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
- O mural possui `titulo` literal próprio e `descricao` apenas com a mensagem pedagógica; menus, pessoas, navegação, vocativo e encerramento não pertencem ao conteúdo.
- Polos listados na tabela de tutores não devem preencher `disciplina.polo` nem substituir o placeholder `/ Polo` do título do mural.

## Estrutura gerada no Moodle

- Seção 0: apresentação/mural.
- Uma seção por aula.
- Seção `Avaliações`.
- Seção `Faltas`.
- Blocos laterais de professores, agenda e encontros virtuais.
- Livro de notas com categorias configuráveis.
- Avaliação final sempre presente.

Atividades suportadas: fórum, quiz, tarefa, chat, wiki e glossário. Chat e wiki usam assigns ocultos para lançamento de nota.

### Livro de notas

`livro_de_notas.categorias` aceita qualquer número de categorias, cada uma com
`nome`, `peso` e os `tipos` de atividade que recebe. Sem `tipos` declarado vale o
comportamento histórico por posição (primeira EaD, segunda presencial). Tipo que
nenhuma categoria reivindica fica na raiz, como a Avaliação Final. Editável na
revisão, em `app/components/GradebookEditor.tsx`.

O `sortorder` segue o padrão do Moodle: numeração densa, item da categoria
imediatamente antes dos seus filhos.

## Associação de arquivos

- Quizzes seguem a mesma regra das tarefas: número explícito no nome (`Quiz 3`,
  `Questionário 3`) vence; sem número, vale a ordem natural do nome. Antes disso a
  associação dependia da ordem de seleção no navegador, que não é garantida.
- `Tarefa 1.*`, `tarefa_1.*` ou `tarefa-1.*` são associados pelo número explícito.
- Arquivos sem número são agrupados pelo mesmo nome-base, ordenados alfabeticamente e associados às posições ainda livres.
- Anexos usam SHA-1 e `filearea=introattachment` no padrão do Moodle.
- Na revisão dá para anexar e mover arquivos por bloco. A escolha é gravada como
  prefixo `tarefa_N__` no próprio nome — a mesma convenção que o mapper resolve —
  para não criar um segundo mecanismo em paralelo ao do servidor.

## Comandos

```bash
yarn dev
yarn test
yarn build
yarn start
yarn prompt   # imprime o prompt de extração com um exemplo de saída
```

Dependências ficam em `ui/`. Os scripts da raiz delegam para essa pasta.

## Configuração

```env
GEMINI_KEY=sua_chave
BLOB_READ_WRITE_TOKEN=...   # opcional; sem ele o upload é direto para as rotas
```

A chave também pode ser configurada no navegador. O modelo atual está definido em `server/extractor.js`.
