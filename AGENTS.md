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
  moodle/           edição de datas em turmas já publicadas (aba "Datas das aulas")
```

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `GEMINI_KEY` | fallback | usada quando a requisição não traz `X-Gemini-Key` |
| `BLOB_READ_WRITE_TOKEN` | não | ativa o upload direto para o Vercel Blob |
| `MOODLE_URL` | não | base do Moodle; sem ela, `https://ead.ifce.edu.br/` |
| `MOODLE_SESSION_SECRET` | **em produção** | cifra o cookie de sessão do Moodle |

Sem `MOODLE_SESSION_SECRET`, `server/moodle/auth.js` **aborta em produção** e cai
numa chave efêmera de processo em desenvolvimento (reiniciar derruba as sessões).

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

## Aba "Datas das aulas": edição de turmas já publicadas

O gerador cria cursos novos; esta aba edita cursos **que já estão no ar**, por
HTTP puro — sem Puppeteer. O que a tela do Moodle faz ao salvar uma atividade é
um POST de formulário, e o formulário inteiro cabe num `fetch`. Chromium não
caberia no tempo nem no tamanho de uma Vercel Function.

- **Aula N = seção N.** O `cmid` vem do `id="module-N"` e o id da seção do
  `data-id`, ambos presentes sem ligar o modo de edição.
- **O `modedit.php` reposta a configuração inteira da atividade.** Campo omitido
  é ajuste apagado no servidor. Por isso `form.js` reproduz o que o navegador
  enviaria — ordem dos campos, `disabled`/`file`/botões fora, checkbox só quando
  marcado, `<select>` sem `selected` na primeira opção. O par `hidden value="0"`
  + `checkbox value="1"` dos `[enabled]` depende dessa ordem: vence a última
  ocorrência. Mexer nisso sem teste quebra atividades em silêncio.
- **Restrições de acesso são um JSON só** (`availabilityconditionsjson`), em
  atividade e em seção. A condição é achada pela **direção** (`>=` / `<`), nunca
  pela posição — o bot antigo escolhia pelo índice na tela e editava a errada
  quando havia mais de uma restrição.
- **A seção recebe só o início.** Pôr um "até" no bloco esconderia a aula
  inteira do aluno depois do prazo, inclusive o que ele já entregou.
- **A cadência vive só em `server/moodle/cadencia.js`.** O servidor recebe datas
  explícitas por aula e nunca recalcula — duas cópias da regra é como a tela do
  livro de notas divergiu do gerador.
- **Uma turma por requisição** (`/api/datas/aplicar`). Cada chamada cabe no
  limite de duração da função, o progresso aparece turma a turma e uma falha
  isolada não derruba o lote. Medido: ~2s por alvo (seção ou atividade).
- **Simular antes de aplicar é obrigatório na tela**, e editar qualquer linha
  invalida o relatório. Não há desfazer.

## Moodle: o `.mbz` está correto, a restauração é que exige opção

Categorias do livro de notas aparecem em **dois** lugares e em nenhum outro:
`gradebook.xml` e `activities/*/grades.xml`. Ambos são gerados corretamente e
batem tag a tag com um backup real do Moodle 4.1.

Se as atividades aparecerem **fora** das categorias depois de importar, o
problema é a restauração, não o arquivo: é preciso restaurar num **curso novo e
vazio**, marcando **"sobrescrever a configuração do curso"**. Isso já foi
diagnosticado e confirmado — não reinvestigar o gerador por causa desse sintoma.

## Commits

- **Não se coloque como coautor.** Nada de `Co-Authored-By:` apontando para a IA,
  nem assinatura ou marca d'água na mensagem. O commit é do autor humano.
- Mensagem em inglês, no estilo do histórico (`feat:`, `fix:`, `docs:`).
- Explique **por que**, não o que o diff já mostra. Quando algo foi descartado
  como hipótese, registre — poupa a próxima investigação.
- Antes de commitar, confira que nenhum `.mbz`, `.env` ou planilha entrou: são
  arquivos que aparecem no diretório durante o uso normal e alguns têm dezenas
  de MB.

## Testes

`yarn test` roda `node --test` sobre `server/`. **A UI não tem cobertura
automatizada** — o único crash em produção até hoje veio daí, de um componente
que o typecheck aprovou porque o tipo declarado não correspondia ao dado real.
Mudança em componente pede verificação no navegador.
