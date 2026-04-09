require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const gastosRoutes = require('./routes/gastos');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true,
}));

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Session ─────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 h
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

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
