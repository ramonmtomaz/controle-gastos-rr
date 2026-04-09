# Controle de Gastos RR

Site para controle de gastos e investimentos integrado ao Google Sheets.

## Arquitetura

```
frontend/   → HTML/CSS/JS puro (GitHub Pages)
backend/    → Node.js + Express (Render ou similar)
```

---

## Pré-requisitos

- Node.js 18+
- Conta Google com uma planilha criada
- Projeto no Google Cloud Console

---

## 1. Configurar o Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: `controle-gastos-rr`)
3. Vá em **APIs & Services → Library** e ative:
   - **Google Sheets API**
   - **Google+ API** (ou **People API**)
4. Vá em **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3001/auth/callback` (desenvolvimento)
     - `https://seu-backend.onrender.com/auth/callback` (produção)
5. Copie o **Client ID** 640940450307-mkhdpenthjtt7cful39it0io3ls5erc6.apps.googleusercontent.com

 e o **Client Secret**  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

---

## 2. Configurar a planilha

1. Abra sua planilha no Google Sheets
2. Renomeie a primeira aba para `Gastos`
3. Na linha 1, adicione os cabeçalhos na ordem:
   ```
   ID | Data | Valor | Categoria | Descrição | Responsável | Tipo | DataRegistro
   ```
4. Copie o **ID da planilha** da URL:
   `https://docs.google.com/spreadsheets/d/`**`1QsMR3gFz4EPNmXZzGQPV9H58PDGZn9ZeVbx78Jz-M9M`**`/edit`

---

## 3. Configurar o backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/callback
SPREADSHEET_ID=id_da_sua_planilha
SHEET_NAME=Gastos
SESSION_SECRET=uma_string_aleatoria_longa
FRONTEND_URL=http://localhost:5500
ALLOWED_EMAILS=voce@gmail.com,esposa@gmail.com
NODE_ENV=development
PORT=3001
```

Instale as dependências e inicie:

```bash
npm install
npm run dev
```

---

## 4. Rodar o frontend

Use o **Live Server** do VS Code (clique direito em `frontend/index.html → Open with Live Server`) ou qualquer servidor estático:

```bash
# Com npx
npx serve frontend
```

Acesse `http://localhost:5500` e faça login com sua conta Google.

---

## 5. Deploy em produção

### Backend (Render)

1. Crie uma conta em [render.com](https://render.com)
2. Crie um **Web Service** apontando para a pasta `backend/`
3. Configure as variáveis de ambiente no painel do Render (as mesmas do `.env`)
4. Atualize `GOOGLE_REDIRECT_URI` e `FRONTEND_URL` com as URLs reais
5. No Google Cloud Console, adicione a nova URI de redirect

### Frontend (GitHub Pages)

1. Edite `frontend/app.js` e troque a linha:
   ```js
   const API_URL = 'http://localhost:3001';
   ```
   pela URL do seu backend no Render:
   ```js
   const API_URL = 'https://seu-backend.onrender.com';
   ```
2. Faça push para o `main` e ative o **GitHub Pages** nas configurações do repositório (Source: `main`, pasta `/frontend` ou `/docs`)

---

## Estrutura do projeto

```
controle-gastos-rr/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── routes/
│   │   ├── auth.js     ← Google OAuth 2.0
│   │   └── gastos.js   ← CRUD na planilha
│   ├── middleware/
│   │   └── auth.js     ← requireAuth
│   └── .env.example
├── .gitignore
└── README.md
```

---

## Campos registrados

| Campo        | Descrição                          |
|--------------|------------------------------------|
| ID           | Gerado automaticamente             |
| Data         | Data do lançamento                 |
| Valor        | Valor em reais                     |
| Categoria    | Alimentação, Transporte, etc.      |
| Descrição    | Texto livre (opcional)             |
| Responsável  | Eu / Esposa / Casal                |
| Tipo         | Gasto / Investimento               |
| DataRegistro | Timestamp de quando foi adicionado |
