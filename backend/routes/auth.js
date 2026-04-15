const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { client, requireAuth } = require('../middleware/auth');
const { getOrCreateUserProfile, updateUserProfile } = require('../services/masterSheet');

// Apenas escopos para login — Sheets é acessado pela service account
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

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

    // Gera JWT com dados do usuário
    // O token é passado via URL fragment (#) — não aparece em logs de servidor
    // nem é enviado como Referer, apenas acessível pelo JavaScript do frontend.
    const jwtToken = jwt.sign(
      { email: payload.email, name: payload.name, picture: payload.picture },
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

// GET /auth/profile — lê ou cria perfil global editável do usuário
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getOrCreateUserProfile(req.user.email, {
      displayName: req.user.name,
      pictureUrl: req.user.picture,
    });
    res.json({ profile });
  } catch (err) {
    console.error('Erro ao carregar perfil:', err);
    res.status(500).json({ error: 'Erro ao carregar perfil do usuário' });
  }
});

// PATCH /auth/profile — atualiza nome exibido e telefone
router.patch('/profile', requireAuth, async (req, res) => {
  const { displayName, phone } = req.body || {};

  if (displayName !== undefined && !String(displayName).trim()) {
    return res.status(400).json({ error: 'Nome exibido é obrigatório' });
  }

  const sanitizedPhone = phone === undefined
    ? undefined
    : String(phone).replace(/[^0-9()+\-\s]/g, '').trim();

  try {
    const profile = await updateUserProfile(req.user.email, {
      displayName,
      phone: sanitizedPhone,
      pictureUrl: req.user.picture,
    });
    res.json({ profile });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil do usuário' });
  }
});

// POST /auth/logout — o cliente apaga o token do localStorage; nada a fazer no servidor
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout realizado' });
});

module.exports = router;
