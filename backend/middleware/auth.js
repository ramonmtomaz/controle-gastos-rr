const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Middleware: verifica o JWT enviado no header Authorization: Bearer <token>
 * e expõe req.user (dados do usuário) e req.googleTokens (tokens OAuth).
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    req.user = payload;
    req.googleTokens = payload.tokens;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = { client, requireAuth };
