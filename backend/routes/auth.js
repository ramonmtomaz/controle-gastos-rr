const express = require('express');
const router = express.Router();
const { client } = require('../middleware/auth');

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/spreadsheets',
];

// Lista de e-mails autorizados (separados por vírgula no .env)
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// GET /auth/google — redireciona para o consent screen do Google
router.get('/google', (req, res) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

// GET /auth/callback — recebe o code do Google e cria a sessão
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=sem_codigo`);
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Busca informações do usuário
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();

    // Verifica se o e-mail está na lista de permitidos
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=acesso_negado`);
    }

    // Salva sessão
    req.session.user = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    req.session.tokens = tokens;

    res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    console.error('Erro no callback OAuth:', err);
    res.redirect(`${process.env.FRONTEND_URL}?error=falha_autenticacao`);
  }
});

// GET /auth/me — retorna o usuário logado (ou 401)
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ error: 'Não autenticado' });
});

// POST /auth/logout — encerra a sessão
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado' });
  });
});

module.exports = router;
