const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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

// GET /auth/callback — recebe o code do Google e gera o JWT
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

    // Gera JWT com dados do usuário e tokens OAuth
    // O token é passado via URL fragment (#) — não aparece em logs de servidor
    // nem é enviado como Referer, apenas acessível pelo JavaScript do frontend.
    const jwtToken = jwt.sign(
      {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        tokens,
      },
      process.env.SESSION_SECRET,
      { expiresIn: '7d' }
    );

    res.redirect(`${process.env.FRONTEND_URL}#token=${jwtToken}`);
  } catch (err) {
    console.error('Erro no callback OAuth:', err);
    res.redirect(`${process.env.FRONTEND_URL}?error=falha_autenticacao`);
  }
});

// GET /auth/me — valida o JWT enviado no header Authorization
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    return res.json({
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

// POST /auth/logout — o cliente apaga o token do localStorage; nada a fazer no servidor
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout realizado' });
});

module.exports = router;
