require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const gastosRoutes = require('./routes/gastos');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ────────────────────────────────────────────────────────────────────
// O browser envia Origin sem path (ex: https://ramonmtomaz.github.io),
// por isso extraímos apenas protocolo+host da FRONTEND_URL.
const frontendOrigin = new URL(process.env.FRONTEND_URL || 'http://localhost:5500').origin;
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Rotas públicas (auth) ────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ─── Rotas protegidas ────────────────────────────────────────────────────────
app.use('/gastos', requireAuth, gastosRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Erro global ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
