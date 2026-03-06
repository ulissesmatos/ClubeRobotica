# 🤖 Plano de Backend — Sistema de Inscrições Robótica

> Stack: **Node.js + Fastify · SQLite · React Admin · Docker/Coolify**
> Formulário dinâmico, upload organizado, painel admin seguro.

---

## 📐 Visão Geral da Arquitetura

```
coolify/
├── container: frontend   → Nginx servindo React (landing + form + admin)
├── container: backend    → Fastify API (Node 20-alpine)
└── volume compartilhado  → /uploads (persistente entre deploys)
```

**Banco:** SQLite (arquivo único, montado em volume Docker)  
**Auth:** JWT com refresh token + bcrypt  
**Upload:** Multer → organiza em `/uploads/{ano}/{mes}/{submissaoId}/`  
**Auto-save:** localStorage no browser, sincroniza com API em background  

---

## 🗂️ Estrutura de Pastas Final

```
Landing-Page-Robotica/
├── frontend/                  ← (atual src/ renomeado)
│   ├── src/
│   │   ├── components/        ← landing page atual
│   │   ├── pages/
│   │   │   ├── FormPage.tsx   ← formulário de inscrição
│   │   │   └── admin/
│   │   │       ├── LoginPage.tsx
│   │   │       ├── DashboardPage.tsx
│   │   │       └── SubmissionDetailPage.tsx
│   │   └── hooks/
│   │       └── useFormAutoSave.ts
│   └── Dockerfile
│
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── forms.routes.ts
│   │   │   ├── submissions.routes.ts
│   │   │   └── uploads.routes.ts
│   │   ├── db/
│   │   │   ├── database.ts    ← conexão better-sqlite3
│   │   │   ├── migrations/
│   │   │   └── seed.ts        ← seed do form "Fundamental II"
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rateLimit.middleware.ts
│   │   │   └── upload.middleware.ts
│   │   └── types/
│   └── Dockerfile
│
├── docker-compose.yml         ← orquestra frontend + backend + volumes
└── PLANO.md
```

---

## 🗃️ Schema do Banco (SQLite)

```sql
-- Formulários dinâmicos
forms            (id, title, description, is_active, created_at, updated_at)
form_fields      (id, form_id, type, label, name, placeholder, required,
                  options_json, order, created_at)

-- Submissões
submissions      (id, form_id, status, ip_address, user_agent, submitted_at)
submission_data  (id, submission_id, field_name, value_text, value_file_path)

-- Admin
admin_users      (id, username, email, password_hash, created_at)
refresh_tokens   (id, admin_id, token_hash, expires_at, created_at)
```

---

## ✅ Checklist de Implementação

---

### FASE 1 — Estrutura e Setup do Backend

- [x] Criar pasta `backend/` na raiz do projeto
- [x] Inicializar `package.json` no backend (`npm init`)
- [x] Instalar dependências:
  - `fastify`, `@fastify/cors`, `@fastify/multipart`, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/static`, `@fastify/helmet`, `@fastify/compress`
  - `bcryptjs` (pure JS, sem compilação nativa), `dotenv`, `zod`
  - Dev: `typescript`, `tsx`, `@types/bcryptjs`, `@types/node`
  - > ⚠️ Usamos `bcryptjs` (não `bcrypt`) e `node:sqlite` (nativo Node 22+) para evitar compilação nativa (node-gyp) no Windows e Docker
- [x] Configurar `tsconfig.json` do backend
- [x] Criar `backend/.env.example` com todas as variáveis necessárias
- [x] Criar `backend/.env` local para desenvolvimento (ignorado pelo git)
- [x] Criar `backend/.gitignore` (node_modules, dist, .env, data/, uploads/)
- [x] Criar `backend/src/server.ts` com Fastify base (CORS, Helmet, JWT, Rate-limit, Multipart, Static)
- [x] Criar `backend/src/db/database.ts` — singleton `node:sqlite` com WAL + FK habilitados
- [x] Criar `backend/src/db/migrate.ts` — runner de migrations automático na inicialização
- [x] Criar stubs de rotas (`auth`, `forms`, `submissions`, `admin`) e middleware `verifyJWT`
- [x] Criar `backend/Dockerfile` (Node 20-alpine, build em 2 stages)
- [x] Servidor testado: `GET /health` → `{"status":"ok"}` ✅

---

### FASE 2 — Banco de Dados e Migrations

- [x] Criar `backend/src/db/database.ts` — singleton `node:sqlite` com WAL + FK
- [x] Criar migration `001_initial` inline em `migrate.ts` com todas as tabelas:
  - `forms`, `form_fields`, `submissions`, `submission_data`, `admin_users`, `refresh_tokens`, `migrations`
  - Índices criados para queries comuns
- [x] Criar `migrate.ts` — runner idempotente que roda automaticamente ao iniciar servidor
- [x] Criar `backend/src/db/seed.ts` com o formulário "Fundamental II" pré-configurado:
  - Campo 1: **Nome Completo do Aluno** (text, obrigatório)
  - Campo 2: **Data de Nascimento** (date, obrigatório)
  - Campo 3: **CPF do Aluno** (cpf, opcional, máscara `000.000.000-00`)
  - Campo 4: **Nome da Escola** (text, obrigatório)
  - Campo 5: **Turno** (radio, obrigatório) → Matutino / Vespertino
  - Campo 6: **Ano/Série** (select, obrigatório) → 6º Ano / 7º Ano / 8º Ano / 9º Ano
  - Campo 7: **Telefone** (tel, obrigatório, somente números)
  - Campo 8: **Boletim Escolar** (file, obrigatório, PDF/image, max 100MB)
- [x] Seed cria o admin padrão com `bcryptjs` (cost factor 12, senha via env)
- [x] Seed é idempotente — verifica existência antes de inserir (seguro para re-rodar)
- [x] Seed testado e verificado: 8 tabelas + 8 campos + admin gravados com sucesso ✅
- [x] Dockerfile atualizado para `node:22-alpine` (node:sqlite requer Node 22+)
  - CMD usa `--experimental-sqlite` flag para compatibilidade Node 22

---

### FASE 3 — API: Autenticação Admin

- [x] Criar `backend/src/services/auth.service.ts`:
  - `verifyAdminCredentials` — compara senha com bcryptjs (hash do banco)
  - `createRefreshToken` — gera token aleatório (64 bytes), salva **hash SHA-256** no banco
  - `verifyRefreshToken` — valida hash + expiração, remove se expirado
  - `revokeRefreshToken` — apaga do banco (logout)
  - `pruneExpiredTokens` — limpa tokens vencidos ao fazer login
  - `getAdminById` — busca admin sem expor o `password_hash`
- [x] `POST /api/auth/login`:
  - Valida body com Zod (`email`, `password`)
  - Retorna `accessToken` (JWT 15min) no body + `refreshToken` em **httpOnly cookie** (7d)
  - Rate limit estrito: **5 tentativas por IP em 15 minutos** ✅
  - Mensagem genérica em caso de erro (não revela se e-mail existe)
- [x] `POST /api/auth/refresh` — lê cookie httpOnly, valida hash no banco, emite novo access token
- [x] `POST /api/auth/logout` — invalida refresh token no banco + limpa cookie
- [x] `GET  /api/auth/me` — retorna dados do admin autenticado (protegido por JWT)
- [x] Middleware `verifyJWT` — rejeita com 401 se token ausente/inválido/expirado
- [x] Cookie com flags de segurança: `httpOnly`, `sameSite: strict`, `secure` (em produção)
- [x] Todos os endpoints testados e validados:
  - Login com credenciais corretas → 200 + JWT ✅
  - Login com senha errada → 401 genérico ✅
  - Rate limit após 5 tentativas → 429 ✅
  - `/me` sem token → 401 ✅
  - `/refresh` sem cookie → 401 "Refresh token ausente" ✅

---

### FASE 4 — API: Gerenciamento de Formulários

- [x] Criar `backend/src/services/forms.service.ts` com toda a lógica de negócio:
  - `getFormById`, `listForms`, `createForm`, `createField`
  - `updateForm`, `updateField`, `reorderFields` (transação BEGIN/COMMIT manual)
  - `deactivateForm` (soft delete), `deleteField`
  - Tipos `FormRow`, `FormFieldRow`, `FormWithFields`, `ALLOWED_FIELD_TYPES`
- [x] `GET  /api/forms/:id` — retorna form ativo com campos (público, options parseado como array)
  - 404 se inativo ou inexistente
- [x] `GET  /api/admin/forms` — lista todos os formulários (admin) ✅
- [x] `GET  /api/admin/forms/:id` — detalhe com campos (admin) ✅
- [x] `POST /api/admin/forms` — cria novo formulário com validação Zod (admin) ✅
- [x] `PUT  /api/admin/forms/:id` — edita título/descrição/status (admin) ✅
- [x] `DELETE /api/admin/forms/:id` — desativa formulário (soft delete) (admin) ✅
- [x] `POST /api/admin/forms/:id/fields` — adiciona campo com validação completa (admin) ✅
- [x] `PUT  /api/admin/forms/:id/fields/:fieldId` — edita campo (admin) ✅
- [x] `DELETE /api/admin/forms/:id/fields/:fieldId` — remove campo (admin) ✅
- [x] `PUT  /api/admin/forms/:id/fields/reorder` — reordena campos via array `{id, order}[]` (admin) ✅
- [x] Validação Zod em todos os endpoints: tipos de campo restritos a `ALLOWED_FIELD_TYPES`, `name` com regex `/^[a-z0-9_]+$/`
- [x] Todos endpoints testados: GET público ✅, CRUD admin ✅, soft delete + 404 público ✅

---

### FASE 5 — API: Submissões ✅

- [x] `POST /api/forms/:id/submit` — recebe submissão (multipart/form-data)
  - Validação Zod de todos os campos obrigatórios
  - Upload do arquivo organizado em `/uploads/{ano}/{mes}/{uuid}/`
  - Sanitização de filename (remover path traversal, caracteres especiais)
  - Gravar submission + todos os submission_data no banco (transação)
  - Retornar ID de confirmação + protocolo `#000001`
- [x] `GET  /api/admin/submissions` — lista paginada de submissões (admin)
  - Filtros: form_id, status, data_inicio, data_fim
  - Busca por nome/CPF
- [x] `GET  /api/admin/submissions/:id` — detalhe completo + dados + arquivo (admin)
- [x] `PUT  /api/admin/submissions/:id/status` — muda status (ex: pendente → aprovado) (admin)
- [x] `DELETE /api/admin/submissions/:id` — exclui submissão + arquivo do disco (admin)
- [x] `GET  /api/admin/uploads/:year/:month/:uuid/:filename` — serve arquivo com autenticação (admin)

---

### FASE 6 — Frontend: Página do Formulário ✅

- [x] Criar rota `/inscricao/:formId` no React Router
- [x] Criar `FormPage.tsx` — renderiza campos dinamicamente via API
- [x] Criar hook `useFormAutoSave(formId)`:
  - Salva no `localStorage` a cada campo alterado (debounce 500ms)
  - Ao carregar a página, restaura dados salvos com banner "Você tem dados salvos — deseja continuar?"
  - Limpa localStorage após envio com sucesso
- [x] Implementar campos:
  - Text, Date, CPF (com máscara), Tel (somente números), Radio, Select, File, Textarea, Email, Number
- [x] Implementar upload de arquivo:
  - Preview de imagem antes do envio
  - Barra de progresso do upload (XHR com evento `progress`)
  - Validação de tipo (PDF/image) e tamanho (max 100MB) no client
- [x] Tela de sucesso após envio com número de protocolo
- [x] Tela de erro amigável com botão "Tentar novamente"
- [x] Layout visual inspirado no Google Forms mas com identidade da Robótica
  - Cards brancos, sombra suave, header colorido (primary blue)
  - Indicador de progresso (campos obrigatórios preenchidos / total)
  - Validação em tempo real com mensagens claras
- [x] Proxy Vite `/api` → `http://localhost:3001` (dev)
- [x] Card Fundamental II Manhã na landing page aponta para `/inscricao/1`
- [x] Todos os 4 cards apontam para rotas internas (`/inscricao/1`, `/inscricao/4`, `/inscricao/5`, `/inscricao/6`)
- [x] Protocolo opaco `ROB-XXXXXXXX` (não sequencial, não revela contagem de inscrições)

---

### FASE 7 — Frontend: Painel Admin

- [x] Criar rota `/admin/login`
  - Formulário de login com validação
  - Redireciona para dashboard se já autenticado
  - Mostra erro claro em credenciais inválidas
  - Bloqueia UI após 5 tentativas falhas (espelha rate limit do backend)
  - Adicionar link no footer na landing page para acessar o painel admin
- [x] Criar `AuthContext` + `PrivateRoute` para proteger rotas admin
- [x] Criar rota `/admin/dashboard`
  - Cards de resumo: total inscrições, pendentes, aprovadas, rejeitadas
  - Tabela paginada de submissões:
    - Colunas: protocolo, nome, turma, data, status, ação
    - Busca por nome
    - Filtro por status, formulário e data
- [x] Criar rota `/admin/submissions/:id`
  - Exibir todos os dados do aluno em layout tipo "ficha"
  - Visualizador de arquivo inline (imagem renderiza, PDF abre em iframe)
  - Botão de download do arquivo
  - Alterar status da submissão (dropdown)
  - Botão excluir com confirmação modal
- [ ] Criar rota `/admin/forms`
  - Listagem de formulários com status (ativo/inativo)
  - Botão criar novo formulário
  - Editor de formulário:
    - Drag-and-drop para reordenar campos
    - Adicionar/editar/remover campos
    - Preview ao vivo do formulário ao lado do editor
    - Publicar/despublicar formulário
- [x] Implementar logout com invalidação de token no servidor

---

### FASE 8 — Segurança (obrigatório antes de ir pra produção)

- [x] **Helmet** — headers de segurança HTTP no Fastify (`@fastify/helmet`)
- [x] **CORS restrito** — somente o domínio do frontend em produção
- [x] **Rate limiting** — global 120/min, login 5/15min, submissões 3/hora por IP
- [x] **Validação Zod** — todos os inputs validados no servidor (nunca confiar no client)
- [x] **Path traversal** — 4 segmentos de URL validados por regex + `resolveUploadPath` com `path.normalize`
- [x] **Tamanho máximo** — `MAX_FILE_SIZE_MB` via ENV no multipart; campos de texto limitados a 10 000 caracteres
- [x] **JWT seguro** — `httpOnly` cookie para refresh token, `SameSite=Strict`, `secure` em produção
- [x] **Bcrypt** — cost factor 12 para hash de senhas
- [x] **SQL injection** — somente prepared statements do `node:sqlite` (parameterized queries)
- [x] **XSS** — React auto-escapa outputs; nenhum `dangerouslySetInnerHTML` no código
- [x] **Gzip** — `@fastify/compress` habilitado globalmente
- [x] **Logs** — Logger estruturado sempre habilitado (level warn em prod, info em dev); eventos de segurança explícitos: login falho, login bem-sucedido, logout, submissão criada (sem dados sensíveis)

---

### FASE 9 — Docker e Coolify

- [x] Criar `backend/Dockerfile` (Node 22-alpine com `--experimental-sqlite`, build TS, roda `node dist/server.js`, usuário `node` não-root)
- [x] Atualizar `nginx.conf`: bloco `location /api/` proxying para `http://backend:3001`
- [x] Criar `docker-compose.yml` na raiz:
  - `backend`: build `./backend`, volumes `db_data:/data` + `uploads_data:/uploads`, `env_file: ./backend/.env`, healthcheck
  - `frontend`: build `.`, porta `80:80`, `depends_on: backend (service_healthy)`
  - volumes nomeados `db_data` + `uploads_data`
- [x] Criar `backend/.dockerignore` (exclui `node_modules`, `dist`, `.env`, `data`, `uploads`)
- [x] Criar `backend/.env.example` com todas as variáveis necessárias e instruções de geração de segredos
- [ ] Configurar variáveis de ambiente no Coolify (copiar `.env.example` → secrets do Coolify)
- [ ] Configurar volumes persistentes no Coolify (`/data` e `/uploads`)
- [ ] Fazer deploy e testar restart do container — dados devem persistir
- [x] Health check no backend (`GET /health → 200 OK`) já implementado

---

### FASE 10 — Testes e Finalização

- [ ] Testar fluxo completo no browser (preencher → auto-save → fechar → reabrir → dados voltam)
- [ ] Testar upload de imagem e PDF
- [ ] Testar login admin → ver submissão → baixar arquivo
- [ ] Testar com internet lenta/desconectada (auto-save no localStorage)
- [ ] Testar edge cases:
  - Envio de arquivo muito grande (>100MB)
  - Tipo de arquivo inválido
  - Campos obrigatórios em branco
  - Duplo clique no botão enviar
- [ ] Validar responsividade do formulário no mobile (câmera do celular para upload)
- [ ] Revisar headers de segurança com [securityheaders.com](https://securityheaders.com)

---

## 🔌 Endpoints Resumidos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | ❌ | Login admin |
| POST | `/api/auth/refresh` | ❌ | Renovar token |
| POST | `/api/auth/logout` | ✅ | Logout |
| GET | `/api/forms/:id` | ❌ | Buscar form (público) |
| POST | `/api/forms/:id/submit` | ❌ | Submeter inscrição |
| GET | `/api/admin/forms` | ✅ | Listar forms |
| POST | `/api/admin/forms` | ✅ | Criar form |
| PUT | `/api/admin/forms/:id` | ✅ | Editar form |
| GET | `/api/admin/submissions` | ✅ | Listar submissões |
| GET | `/api/admin/submissions/:id` | ✅ | Detalhe submissão |
| PUT | `/api/admin/submissions/:id/status` | ✅ | Alterar status |
| DELETE | `/api/admin/submissions/:id` | ✅ | Excluir submissão |
| GET | `/api/admin/uploads/:sid/:file` | ✅ | Servir arquivo |
| GET | `/health` | ❌ | Health check Coolify |

---

## 🧱 Decisões Técnicas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Runtime | Node.js 20 | Já usado no build frontend |
| Framework | Fastify | Mais rápido e tipado que Express |
| Banco | SQLite + better-sqlite3 | Zero config, arquivo único, volume Docker |
| ORM? | Não — SQL puro | Simples, sem overhead, prepared statements nativos |
| Auth | JWT (access 15min) + refresh httpOnly | Seguro, stateless no access token |
| Upload | Multer (@fastify/multipart) | Suporte nativo a streaming de arquivos |
| Validação | Zod | Schema tipado, erros claros, integra com TS |
| Admin UI | React + Tailwind (mesmo projeto) | Reutiliza stack existente |
| Roteamento | React Router v6 | Padrão da indústria |

---

## 📋 Seed — Formulário Fundamental II (6º ao 9º Ano)

> Já inclusa no `seed.ts` — pronto para rodar na primeira inicialização.

**Título:** Inscrição Fundamental II — 6º ao 9º Ano (Manhã)  
**Status:** Ativo

| # | Campo | Tipo | Obrigatório | Opções |
|---|-------|------|-------------|--------|
| 1 | Nome Completo do Aluno | text | ✅ | — |
| 2 | Data de Nascimento | date | ✅ | — |
| 3 | CPF do Aluno | text | ❌ | máscara: 000.000.000-00 |
| 4 | Nome da Escola | text | ✅ | — |
| 5 | Turno no Ensino Regular | radio | ✅ | Matutino / Vespertino |
| 6 | Ano/Série | select | ✅ | 6º Ano / 7º Ano / 8º Ano / 9º Ano |
| 7 | Telefone | tel | ✅ | somente números |
| 8 | Boletim Escolar | file | ✅ | PDF ou imagem, max 100MB |

---

*Atualizado em: 06/03/2026*
