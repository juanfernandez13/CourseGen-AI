# Matriz DE → Moodle (.mbz)
**CREAD IFCE** — Converte automaticamente a Matriz DE (.docx) em arquivo `.mbz` importável no Moodle.

---

## Como funciona

```
Matriz DE (.docx)
       ↓
  mammoth → texto bruto
       ↓
  parser → divide em 4 chunks por seção
       ↓
  Gemini 1.5 Flash → JSON por chunk (cabeçalho, ementa, cronograma, avaliações)
       ↓
  mbzGenerator → estrutura XML do Moodle compactada em .zip
       ↓
  arquivo .mbz para importar no Moodle
```

### Por que chunks?
A Matriz DE é grande demais para um único request ao Gemini.
O sistema divide em 4 partes menores, cada uma processada separadamente,
eliminando o problema de requests gigantes que falham.

---

## Instalação

```bash
# 1. Clone ou copie o projeto
cd matriz-moodle

# 2. Instale as dependências
npm install

# 3. Rode o servidor
npm start
# ou em modo dev (com auto-reload):
npm run dev
```

Acesse: **http://localhost:3000**

---

## Uso

1. Cole sua **chave da API Gemini** (obtenha em [aistudio.google.com](https://aistudio.google.com/app/apikey))
2. Faça **upload da Matriz DE** em `.docx`
3. Clique em **Pré-visualizar** para conferir os dados extraídos
4. Clique em **Gerar .mbz** para baixar o arquivo
5. No Moodle: **Administração do curso → Restaurar → Enviar arquivo .mbz**

---

## O que é gerado no .mbz

| Elemento Moodle | Origem na Matriz DE |
|---|---|
| Nome e código do curso | Cabeçalho da matriz |
| Descrição do curso | Ementa + dados do professor + bibliografia |
| Tópicos/seções | Uma seção por unidade de conteúdo |
| Fórum de avisos | Criado automaticamente (obrigatório) |
| Tarefas de entrega | Uma por avaliação listada |
| Eventos de calendário | Datas do cronograma de aulas |
| Livro de notas | Itens de nota por avaliação |

---

## Estrutura do projeto

```
matriz-moodle/
├── src/
│   ├── server.js        # Express + endpoints /convert e /preview
│   ├── parser.js        # Lê .docx e divide em seções (chunks)
│   └── mbzGenerator.js  # Gera o .mbz com XML válido do Moodle
├── public/
│   └── index.html       # Interface web
├── uploads/             # Pasta temporária (auto-criada)
└── package.json
```

---

## Dependências

| Pacote | Uso |
|---|---|
| `express` | Servidor HTTP |
| `multer` | Upload de arquivos |
| `mammoth` | Leitura de .docx |
| `@google/generative-ai` | API Gemini |
| `archiver` | Compactação em .zip/.mbz |
| `uuid` | IDs únicos para o backup |

---

## Próximos passos sugeridos

- [ ] Suporte a Google Docs (via Google Drive API) sem precisar baixar o .docx
- [ ] Integração com Google Calendar para puxar as datas do cronograma automaticamente  
- [ ] Importação direta via API do Moodle (sem precisar baixar o .mbz manualmente)
- [ ] Histórico de conversões com visualização do JSON extraído
- [ ] Salvar a chave Gemini em variável de ambiente (.env)
