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
  questionarios.js  modo "só questionários": regras do JSON compartilhadas com a tela
  blobStore.ts      adapter do Vercel Blob
  mbzGenerator/     geração do pacote Moodle
  moodle/           edição de datas em turmas já publicadas (aba "Datas das aulas")
```

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `GEMINI_KEY` | fallback | usada quando a requisição não traz `X-Gemini-Key` |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` | não | modelo principal e reservas (vírgula) para 503/cota; padrão `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.8-flash` (o 3.8 ficava na fila; ver comentário em `extractor.js`) |
| `BLOB_READ_WRITE_TOKEN` | não | ativa o upload direto para o Vercel Blob |
| `MOODLE_URL` | não | base do Moodle; sem ela, `https://ead.ifce.edu.br/` |
| `MOODLE_SESSION_SECRET` | não | cifra o cookie de sessão do Moodle |

Há um `ui/.env.example` com todas elas.

**Nenhuma é obrigatória para as telas do Moodle subirem.** Sem
`MOODLE_SESSION_SECRET` o cookie de sessão vai em base64url (`p.…`); com ela,
em AES-256-GCM (`c.…`). `auth.js` lê os dois formatos, então definir ou remover
o segredo depois não quebra nada — só invalida as sessões abertas.

Rodar sem cifra foi **escolha explícita**, para não exigir configuração no
deploy. O custo: quem tem acesso ao navegador (DevTools, cópia do perfil) lê o
valor e usa aquela sessão do Moodle fora do app, sem senha — e a conta usada
costuma ser de admin. `httpOnly` cobre XSS, não acesso à máquina. Não
"conserte" isso tornando a variável obrigatória sem falar com o dono do
projeto.

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

## Cadastro em lote: enviar o CSV direto ao Moodle

Botão na tela de download do Cadastro em lote, atrás do mesmo login da aba de
Datas. Vai para `admin/tool/uploaduser`, em quatro saltos:

```
GET  uploaduser/index.php   → sesskey + itemid de uma área de rascunho
POST repository_ajax.php    → o CSV entra NO RASCUNHO (multipart)
POST uploaduser/index.php   → passo 1, referenciando o itemid
POST uploaduser/index.php   → passo 2; só AQUI usuários são criados
```

- **`userfile` não é o arquivo, é o id do rascunho.** E o passo 2 não reenvia o
  CSV: referencia o `iid` do arquivo já interpretado.
- **O formulário do passo 2 muda conforme as colunas do CSV.** Com coluna
  `password` o Moodle acrescenta `uuforcepasswordchange` e os `uulegacy*`; sem
  ela esses campos não existem. Por isso as opções são aplicadas sobre o
  formulário lido — `confirma()` nunca define campo que não veio.
- **A página tem três formulários com o mesmo `action`.** O que vale é o que
  contém `uutype`; pegar o primeiro traz o de admin, com dois campos.
- **Valores usados no IFCE**, conferidos contra o `ead.ifce.edu.br`:
  `uutype=2`, `uupasswordnew=1`, `uuupdatetype=2`, `uupasswordold=1`,
  `uuforcepasswordchange=2`, `delimiter_name=comma`.
- **A coluna "Status" da prévia só fala quando há problema** ("E-mail
  duplicado", por exemplo). Para linha sem conflito ela volta vazia, inclusive
  quando o usuário já existe — a prévia **não** distingue novo de existente, e
  não adianta procurar defeito no parser. O desfecho por aluno só aparece
  **depois** de confirmar, na tabela de resultado, cuja primeira coluna traz
  "Novo usuário" / "Usuário atualizado". É de lá que saem as contagens; não
  existe "Usuários criados: N" na página.

## Só questionários: .mbz para mesclar num curso que já existe

Para quando pedem só um quiz e não há matriz. A aba "Só questionários" extrai os
`.docx` com o Gemini e gera um pacote que se restaura com **"mesclar o backup
neste curso"**, nunca a opção que apaga o conteúdo.

- **O JSON leva `modo: "questionarios"`**; cada item de `aulas` é um questionário
  e `numero` é a **seção de destino** (0 = geral). As regras ficam em
  `server/questionarios.js`; o gerador ramifica em `createQuizOnlyModel`
  (`model.js`) e o resto lê `model.quizOnly`.
- **O pacote só leva o que não pertence ao curso**: nada de mural, blocos HTML,
  Avaliações, Faltas, Avaliação Final nem `gradebook.xml`. Sem o arquivo o Moodle
  não toca na estrutura de notas do destino (`restore_gradebook_structure_step`
  só roda se ele existe e o curso tem apenas a categoria raiz); com ele, criaria
  categorias num curso alheio.
- **Seção sem nome nem resumo (`$@NULL@$`).** Ao mesclar, o Moodle só preenche
  nome e resumo de uma seção existente quando estão vazios, e nunca altera a
  restrição de acesso. Vazio é não tocar no que o destino já tem.
- **A nota cai na raiz, com peso 0.** O Moodle descarta a categoria de nota da
  atividade quando o backup vem de outro site. O peso só sai do último `[n]` do
  título, como no curso inteiro; sem ele é 0, porque numa agregação natural
  `aggregationcoef` é o flag de crédito extra e um valor herdado viraria nota
  extra sem aviso.
- **Seção além da última** faz o Moodle criar também as vazias do meio (a 9 num
  curso com seções 0–6 cria a 7 e a 8).
- **Sem matriz, nenhum arquivo é descartado**: `/api/extract` usa
  `listQuizFiles(..., { umPorNumero: false })`, então dois quizzes com o mesmo
  número viram dois questionários, e devolve `arquivos[i]` alinhado a
  `quizzes[i]` para a tela nomear e posicionar cada um.
- **Comprovado no Moodle 4.1.17 do laboratório** (`Moodle-AI/docs/lab`): mesclando
  num curso gerado por este projeto e restaurando como curso novo. Seções,
  blocos, categorias de nota e atividades do destino ficaram intactos, e os três
  tipos de questão abriram tentativa de pré-visualização. Mexeu no pacote? Repita.

## Por que o cookie não guarda estado no servidor

Cada Vercel Function é um processo novo: não há memória compartilhada entre
invocações, e guardar sessão exigiria Redis ou banco. Por isso a sessão do
Moodle viaja no cookie do navegador.

Isso já custou um bug sutil: a chave de cifra chegou a ser sorteada e guardada
em variável de módulo. O Next recompila o grafo da rota editada, cada rota fica
com sua própria instância do módulo, e o cookie escrito por uma virava lixo para
a outra — 401 instantâneo a cada hot reload, sem erro visível. Qualquer chave
tem que vir de fora do processo (hoje, da variável de ambiente) ou não existir.

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
