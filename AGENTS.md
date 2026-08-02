# CourseGen AI

Transforma a Matriz DE do IFCE (`.docx`) em backup Moodle (`.mbz`), e planilhas de
alunos em CSV de importação. Next.js 16 + React 19; o backend são API Routes.

## Comandos

```bash
yarn dev     # localhost:3000
yarn test    # node --test sobre server/
yarn build
yarn prompt  # imprime o prompt de extração + exemplo
```

As dependências ficam em `ui/`. Os scripts da raiz delegam para lá.

## Layout

```
ui/app/       telas e API Routes (TypeScript)
ui/server/    núcleo (CommonJS + .d.ts escritos à mão)
  extractor.js      prompts e chamadas ao Gemini
  parser.js         DOCX → texto (mammoth)
  planilha.js       XLSX/CSV → linhas (exceljs)
  alunos.js         cadastro em lote: prompt, validação, CSV
  taskFileMapper.js associa arquivos a tarefas/quizzes pelo nome
  blobStore.ts      adapter do Vercel Blob
  mbzGenerator/     geração do pacote Moodle
```

## Invariantes

- **Aritmética de IDs vive em `mbzGenerator/model.js`.** Não criar offsets em
  `index.js` nem nos writers.
- **Builders são puros**: recebem dados, devolvem string XML, não tocam disco.
- `generateMBZ()` cuida só do ciclo de vida do workspace e da compactação.
- A pasta temporária some no `finally`.
- Toda mudança de XML ganha teste antes de mexer em offset ou referência cruzada.
- **A IA arruma, o código decide.** No cadastro de alunos o Gemini mapeia colunas
  e separa nomes; CPF e e-mail são validados em código determinístico
  (`server/alunos.js`). Um modelo alucina um dígito e transforma inválido em
  plausível — o oposto do que se quer.

## Armadilhas já pagas

- **`ui/.env` é um symlink quebrado** apontando para um alvo inexistente. O Next
  faz `stat` em todo `.env*` e aborta: **`yarn build` não roda local** sem mover o
  arquivo antes. O `yarn dev` funciona normalmente.
- **Categorias do livro de notas ficam em `server/mbzGenerator/model.js`
  (`normalizeCategorias`) e espelhadas em `app/components/GradebookEditor.tsx`.**
  A duplicação existe porque `model.js` puxa `utils.js`, que usa `crypto` e não
  roda no browser. Se divergirem, a tela mostra uma coisa e o `.mbz` sai com
  outra, sem nada falhar.
- **O prompt emite `livro_de_notas.categorias` só com `nome` e `peso`** — sem
  `tipos`. Quem consumir isso precisa normalizar antes; foi assim que a tela
  quebrou em produção com `Cannot read properties of undefined`.
- **Uploads têm dois caminhos.** Com `BLOB_READ_WRITE_TOKEN`, o browser envia
  direto ao Vercel Blob e as rotas recebem URLs; sem o token, recebem o arquivo
  no FormData. O segundo é o caminho local — a Vercel rejeita corpo acima de
  4,5 MB na edge, antes da função executar.
- **O blob vive uma requisição.** É apagado no `finally` da rota, o que mantém o
  storage perto de zero e o uso dentro do plano gratuito. As URLs são registradas
  *antes* de validar ou baixar, senão uma falha no meio deixaria blobs órfãos.
  Continua sem cobertura o caso de o browser subir o arquivo e nunca chamar a
  rota (aba fechada): esse blob fica no storage até alguém varrer.
- **Quizzes e tarefas são associados pelo nome**, não pela ordem de seleção. O
  número da frente do arquivo **não** é o número da atividade: em
  `4.Tarefa_1-_Aula_1.docx` o `4.` é ordem do documento e o `Tarefa_1` é o que
  vale.

## Moodle: o `.mbz` está correto, a restauração é que exige opção

Categorias do livro de notas aparecem em **dois** lugares e em nenhum outro:
`gradebook.xml` e `activities/*/grades.xml`. Ambos são gerados corretamente e
batem tag a tag com um backup real do Moodle 4.1.

Se as atividades aparecerem **fora** das categorias depois de importar, o
problema é a restauração, não o arquivo: é preciso restaurar num **curso novo e
vazio**, marcando **"sobrescrever a configuração do curso"**. Isso já foi
diagnosticado e confirmado — não reinvestigar o gerador por causa desse sintoma.

## Testes

`yarn test` roda `node --test` sobre `server/`. **A UI não tem cobertura
automatizada** — o único crash em produção até hoje veio daí, de um componente
que o typecheck aprovou porque o tipo declarado não correspondia ao dado real.
Mudança em componente pede verificação no navegador.
