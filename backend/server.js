require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes     = require('./routes/auth');
const gastosRoutes   = require('./routes/gastos');
const controlesRoutes = require('./routes/controles');
const pluggyRoutes   = require('./routes/pluggy');
const pluggyWebhookRoutes = require('./routes/pluggyWebhook');
const cartoesRoutes  = require('./routes/cartoes');
const comprasParceladasRoutes = require('./routes/comprasParceladas');
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
app.use('/webhooks/pluggy', pluggyWebhookRoutes);

// ─── Rotas protegidas ────────────────────────────────────────────────────────
app.use('/controles', requireAuth, controlesRoutes);
app.use('/gastos',    requireAuth, gastosRoutes);
app.use('/pluggy',    requireAuth, pluggyRoutes);
app.use('/cartoes',   requireAuth, cartoesRoutes);
app.use('/compras-parceladas', requireAuth, comprasParceladasRoutes);

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
