# Matriz DE → Moodle (.mbz) — Contexto do Projeto

## O que é
Ferramenta Node.js que converte um documento DOCX de planejamento de disciplina do IFCE (chamado "Matriz DE") em um arquivo de backup do Moodle (`.mbz`), pronto para importação. Usa Gemini 2.5 Flash para extrair dados estruturados do documento.

## Stack
- **Node.js** + Express (v5) + Multer
- **Gemini 2.5 Flash** via `@google/genai` SDK
- **mammoth.js** — extrai texto de DOCX
- **archiver** — gera o ZIP/tar.gz do .mbz
- **uuid**, **crypto** — geração de IDs e SHA1 para arquivos

## Arquivos principais
```
server.js        — servidor Express + extração Gemini + modo CLI
mbzGenerator.js  — geração de todo o XML do backup Moodle
parser.js        — extrai texto do DOCX via mammoth (simples wrapper)
.env             — contém GEMINI_KEY=...
```

## Como rodar

### Modo CLI (mais simples)
Coloque `matriz.docx` na pasta raiz do projeto e rode:
```bash
node server.js
```
Ele detecta o arquivo, processa e gera `curso_CODIGO.mbz` na mesma pasta.

### Modo Web
Acesse `http://localhost:3000` e envie o formulário com os arquivos.

### Variável de ambiente necessária
```
GEMINI_KEY=sua_chave_aqui
```

---

## Estrutura de pastas de input (modo CLI)
```
Downloads/files/
├── matriz.docx          ← documento principal (obrigatório)
├── quizzes/
│   ├── quiz_1.docx      ← questões do 1º quiz
│   ├── quiz_2.docx      ← questões do 2º quiz
│   └── ...
└── tarefas/
    ├── tarefa_1.pdf     ← arquivos anexos da 1ª tarefa
    ├── tarefa_1.docx
    ├── tarefa_2.pdf
    └── ...
```

- `quiz_N.docx` é associado ao N-ésimo quiz encontrado na matriz (por ordem)
- `tarefa_N.*` é associado à N-ésima tarefa encontrada na matriz (por ordem)
- Para tarefas, qualquer extensão é aceita: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.pptx`, `.png`, `.jpg`, `.zip`

---

## JSON intermediário (saída do Gemini / entrada do gerador)
```json
{
  "disciplina": { "nome", "codigo", "carga_horaria", "curso", "semestre", "turma" },
  "professor":  { "nome", "email", "titulacao" },
  "ementa": "...",
  "aulas": [
    {
      "numero": 1,
      "titulo": "Aula 1 – ...",
      "descricao": "...",
      "data_inicio": "DD/MM/YYYY",
      "data_fim": "DD/MM/YYYY",
      "forum": { "titulo": "[Aula 1] [Fórum 1] Título [nota]", "nota": 5, "descricao": "..." },
      "quiz":  { "titulo": "...", "nota": 5, "data_inicio": "...", "data_fim": "...",
                 "questoes": [ /* injetado dos arquivos quiz_N.docx */ ] },
      "tarefa": { "titulo": "...", "nota": 10, "descricao": "...", "data_inicio": "...", "data_fim": "...",
                  "arquivos": [ { "filePath": "...", "filename": "tarefa_1.pdf" } ] }
    }
  ],
  "avaliacoes_complementares": [
    { "titulo": "...", "descricao": "...", "data": "...", "nota": 10, "tipo": "prova|trabalho|seminario", "categoria": "ead|presencial" }
  ],
  "frequencia": { "percentual_minimo": 75, "observacoes": "..." },
  "livro_de_notas": {
    "categorias": [
      { "nome": "Atividades a distância", "peso": 40 },
      { "nome": "Atividades presenciais", "peso": 60 }
    ]
  },
  "bibliografia": { "basica": [...], "complementar": [...] }
}
```

---

## Estrutura gerada no Moodle

### Seções do curso
| # | Nome | Conteúdo |
|---|------|----------|
| 0 | Nome da disciplina | Fórum de Avisos (news, type=single) |
| 1..N | Título de cada aula | Fórum + Quiz (opcional) + Tarefa (opcional) |
| N+1 | Avaliações | Assigns de `avaliacoes_complementares` |
| N+2 | Faltas | Um assign por aula (para registro de frequência) |

### Atividades por aula
- **Fórum** (`type=single`, avaliado) → categoria "Atividades a distância"
- **Quiz** (opcional, com questões importadas) → categoria "Atividades a distância"
- **Tarefa/Assign** (opcional, com arquivos anexos) → categoria "Atividades presenciais"

### Livro de notas
Duas categorias: "Atividades a distância" (EaD, padrão 40%) e "Atividades presenciais" (padrão 60%). Pesos extraídos da matriz ou usados como padrão IFCE.

---

## Formato .mbz — detalhes críticos

### IDs
Gerados com `base = random(10000..90000)`. Cada aula usa um bloco de 10 IDs (`base+300 + i*10`). Offsets:
- `+0` sectionId, `+1` forumId, `+2` forumCtx, `+3` quizId, `+4` quizCtx, `+5` assignId, `+6` assignCtx
- Avaliações complementares: `compBase + i*3`
- Avaliações/Faltas seções + assigns de faltas: `specialBase + ...`

### Questões de quiz
Suportados 3 tipos (mapeados para Moodle):
- `multipla_escolha` → `multichoice`
- `associativa` → `match` (V/F)
- `dissertativa` → `essay`

Cada quiz tem duas `question_category` no `questions.xml` (top + default). IDs usam offsets grandes: `quizId + 2000000` (top), `quizId + 2001000` (default), `quizId + 3000000 + qi*100` (questões).

### Arquivos anexos de tarefa (filearea=introattachment)
- SHA1 do conteúdo é o nome do arquivo físico em `files/{ab}/{sha1}`
- `files.xml` usa `component=mod_assign`, `filearea=introattachment`
- **Obrigatório**: uma entrada de diretório com `filename="."` por assign (SHA1 `da39a3ee...` = SHA1 de string vazia)
- `inforef.xml` do assign deve referenciar o ID da entrada de diretório + IDs de todos os arquivos
- Os IDs em `files.xml` são sequenciais (1-indexed); a entrada de diretório vem antes dos arquivos de cada contexto

### Fórum (type=single)
- Não incluir `<discussions>` no backup — o Moodle cria automaticamente para fóruns `single`
- `scale` deve ser positivo (valor numérico máximo), **não** negativo (que referenciaria escala customizada)
- `grading.xml` usa estrutura `<areas><area><areaname>forum</areaname>...</area></areas>`

### Assign (tarefa)
- `grading.xml` usa `<areaname>submissions</areaname>`
- Sem `availabilityjson` (passa `availTs=0`) — apenas `duedate` interno
- Plugin configs: `assignsubmission_file` habilitado, `assignsubmission_onlinetext` desabilitado

### Disponibilidade
- **Seções de aulas**: têm `availabilityjson` com data de início da aula
- **Fórum de cada aula**: tem `availabilityjson` com data de início
- **Quiz e Assign**: sem restrição de acesso (`availTs=0`), apenas datas internas

---

## Extração com Gemini

### Rate limit (429)
Tratado com retry automático em `geminiGenerate()`. O erro do Gemini inclui `retryDelay` no JSON — esse valor é extraído e usado como tempo de espera exato (+2s de margem). Máximo 5 tentativas.

### Documentos grandes (>300k chars)
Divididos em 2 partes no último `\n` do meio. Cada parte é processada separadamente e os resultados são mesclados com `mergeMatrizData()`.

### Questões de quiz
Processadas com `PROMPT_QUIZ` e `extractQuizQuestions()` separadamente de cada arquivo `quiz_N.docx`.

---

## Erros conhecidos e corrigidos

| Problema | Causa | Solução |
|----------|-------|---------|
| `get_in_or_equal() does not accept empty arrays` | Fórum `single` com `<discussion>` contendo `userid=$@NULL@$` | Remover todas as discussões do backup — Moodle cria automaticamente |
| Escala errada no fórum | `scale=-N` referencia escala customizada; deveria ser `scale=N` (máximo numérico) | Remover o sinal negativo |
| `grading.xml` inválido | Estrutura `<gradingforms>` usada; Moodle espera `<areas><area>...` | Reescrever com `buildGradingXml()` |
| Arquivos de tarefa não aparecem no Moodle | `filearea=intro` em vez de `introattachment`; sem entrada de diretório; sem `fileref` no inforef | Corrigir filearea, adicionar dir entry, sobrescrever inforef após buildFilesXml |
| Acesso restrito em quiz/assign | `availTs=ts` passava a data como restrição | Passar `availTs=0` para quiz e assign |

---

## Referências utilizadas
- `/tmp/moodle_backup/` — backup real de curso simples (forum único) para comparar XML
- `/tmp/moodle_real/` — backup de curso geometria com atividades completas
- `/tmp/moodle_politicas/` — backup de políticas educacionais com tarefa com arquivo anexo e seções Avaliações/Faltas
