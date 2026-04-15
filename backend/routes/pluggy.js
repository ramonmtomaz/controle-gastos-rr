const express = require('express');
const router  = express.Router();
const { PluggyClient } = require('pluggy-sdk');
const { getControleById, isMembro, getServiceSheets } = require('../services/masterSheet');

const MASTER_ID    = () => process.env.MASTER_SPREADSHEET_ID;
const PLUGGY_BASE  = 'https://api.pluggy.ai';

function getPluggyClient() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET com os valores reais no ambiente');
  }

  return new PluggyClient({ clientId, clientSecret });
}

// ─── Helper: requisição para a API Pluggy (fetch nativo Node 18+) ─────────────
async function pluggyRequest(method, path, body, apiKey) {
  const headers = { 'Content-Type': 'application/json', 'accept': 'application/json' };
  if (apiKey) headers['X-API-KEY'] = apiKey;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res  = await fetch(`${PLUGGY_BASE}${path}`, options);
  const data = await res.json();
  return { status: res.status, body: data };
}

async function getPluggyApiKey() {
  const clientId     = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não configurados');
  }
  const res = await pluggyRequest('POST', '/auth', { clientId, clientSecret }, null);
  console.log('[Pluggy] /auth status:', res.status, '| body keys:', Object.keys(res.body || {}));
  if (res.status !== 200) throw new Error(`Pluggy auth falhou (${res.status}): ${JSON.stringify(res.body)}`);
  const apiKey = res.body.apiKey || res.body.api_key;
  if (!apiKey) throw new Error(`Pluggy auth: apiKey ausente. Campos recebidos: ${Object.keys(res.body)}`);
  return apiKey;
}

// ─── POST /pluggy/connect-token ───────────────────────────────────────────────
// Gera um connectToken para abrir o Pluggy Connect Widget no frontend.
router.post('/connect-token', async (req, res) => {
  try {
    const pluggy = getPluggyClient();
    const connectToken = await pluggy.createConnectToken({
      clientUserId: req.user?.email || `user-${Date.now()}`,
    });
    res.json({ connectToken: connectToken.accessToken });
  } catch (err) {
    console.error('Pluggy connect-token error:', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.message || err.message });
  }
});

// ─── POST /pluggy/import ──────────────────────────────────────────────────────
// Importa transações de débito de um item bancário para o controle atual.
// Body: { itemId, dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD), responsavel }
router.post('/import', async (req, res) => {
  const controleId = req.headers['x-controle-id'];
  if (!controleId) return res.status(400).json({ error: 'Header X-Controle-Id é obrigatório' });

  const controle = await getControleById(controleId);
  if (!controle) return res.status(404).json({ error: 'Controle não encontrado' });
  if (!(await isMembro(controleId, req.user.email))) {
    return res.status(403).json({ error: 'Acesso negado a este controle' });
  }

  const { itemId, dataInicio, dataFim, responsavel } = req.body;
  if (!itemId || !dataInicio || !dataFim || !responsavel) {
    return res.status(400).json({ error: 'itemId, dataInicio, dataFim e responsavel são obrigatórios' });
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(itemId)) {
    return res.status(400).json({ error: 'itemId invalido. Conecte novamente no Pluggy.' });
  }

  try {
    const apiKey = await getPluggyApiKey();

    // Busca contas do item
    const accountsRes = await pluggyRequest(
      'GET', `/accounts?itemId=${encodeURIComponent(itemId)}`, null, apiKey
    );
    if (accountsRes.status !== 200) throw new Error('Erro ao buscar contas do banco');

    const accounts = accountsRes.body.results || [];
    if (accounts.length === 0) return res.json({ imported: 0, message: 'Nenhuma conta encontrada.' });

    // Busca transações de cada conta no período, filtra apenas débitos
    const allTransactions = [];
    for (const account of accounts) {
      const txRes = await pluggyRequest(
        'GET',
        `/transactions?accountId=${encodeURIComponent(account.id)}&from=${dataInicio}&to=${dataFim}&pageSize=500`,
        null,
        apiKey
      );
      if (txRes.status === 200) {
        const debits = (txRes.body.results || []).filter((t) => t.type === 'DEBIT');
        allTransactions.push(...debits);
      }
    }

    if (allTransactions.length === 0) {
      return res.json({ imported: 0, message: 'Nenhuma transação de débito encontrada no período.' });
    }

    // Mapeia para linhas da planilha (colunas: ID, Data, Valor, Categoria, Descrição, Responsável, Tipo, DataRegistro)
    const now  = new Date().toISOString();
    const rows = allTransactions.map((t, i) => [
      `${Date.now()}${i}`,
      t.date ? t.date.split('T')[0] : dataInicio,
      Math.abs(t.amount).toFixed(2),
      'Outros',
      t.description || '',
      responsavel,
      'Gasto',
      now,
    ]);

    // Insere em batch na aba do controle
    await getServiceSheets().spreadsheets.values.append({
      spreadsheetId: MASTER_ID(),
      range: `${controle.spreadsheetId}!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    res.json({ imported: rows.length });
  } catch (err) {
    console.error('Pluggy import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
