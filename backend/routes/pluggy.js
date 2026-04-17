const express = require('express');
const router  = express.Router();
const { PluggyClient } = require('pluggy-sdk');
const {
  getControleById,
  isMembro,
  getMembros,
  getServiceSheets,
  listPluggyItems,
  savePluggyItem,
  removePluggyItem,
  listCartoes,
  upsertPluggyCartao,
  inativarCartoesPorPluggyItem,
} = require('../services/masterSheet');

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

async function resolveControle(req, res) {
  const controleId = req.headers['x-controle-id'];
  if (!controleId) {
    res.status(400).json({ error: 'Header X-Controle-Id é obrigatório' });
    return null;
  }

  const controle = await getControleById(controleId);
  if (!controle) {
    res.status(404).json({ error: 'Controle não encontrado' });
    return null;
  }

  if (!(await isMembro(controleId, req.user.email))) {
    res.status(403).json({ error: 'Acesso negado a este controle' });
    return null;
  }

  return controle;
}

function resolveCartaoNomePluggy(account, connectorName) {
  const nomeConta = String(account?.name || '').trim();
  if (nomeConta && nomeConta.toLowerCase() !== 'meupluggy') return nomeConta;
  return `${String(connectorName || 'Banco').trim()} Cartão`;
}

function resolveFinalCartao(account) {
  const fontes = [account?.number, account?.maskedNumber, account?.name];
  for (const fonte of fontes) {
    const digits = String(fonte || '').replace(/\D/g, '');
    if (digits.length >= 4) return digits.slice(-4);
  }
  return '';
}

function isContaCartao(account) {
  const tipo = String(account?.type || '').toUpperCase();
  const subtipo = String(account?.subtype || '').toUpperCase();
  return tipo.includes('CREDIT') || tipo.includes('CARD') || subtipo.includes('CREDIT') || subtipo.includes('CARD');
}

function normalizeTipoLancamento(rawTipo) {
  const tipo = String(rawTipo || '').trim().toLowerCase();
  if (tipo === 'entrada') return 'Entrada';
  if (tipo === 'investimento') return 'Investimento';
  return 'Saida';
}

async function sincronizarCartoesPluggyDoItem(apiKey, userEmail, itemId, connectorName) {
  const accountsRes = await pluggyRequest('GET', `/accounts?itemId=${encodeURIComponent(itemId)}`, null, apiKey);
  if (accountsRes.status !== 200) return [];

  const contas = accountsRes.body.results || [];
  const cartoes = contas.filter(isContaCartao);
  const sincronizados = [];

  for (const account of cartoes) {
    const nomeOriginal = resolveCartaoNomePluggy(account, connectorName);
    const finalCartao = resolveFinalCartao(account);
    const tipoCartao = String(account?.type || '').toUpperCase().includes('CREDIT') ? 'credito' : 'debito';

    const cartao = await upsertPluggyCartao(userEmail, {
      bancoNome: connectorName || 'Banco conectado',
      cartaoNome: nomeOriginal,
      nomeOriginal,
      finalCartao,
      bandeira: String(account?.marketingName || account?.brand || '').trim().substring(0, 50),
      tipoCartao,
      diaFechamentoFatura: 1,
      diaVencimentoFatura: '',
      pluggyItemId: itemId,
      pluggyAccountId: String(account?.id || '').trim(),
    });
    sincronizados.push(cartao);
  }

  return sincronizados;
}

// ─── POST /pluggy/connect-token ───────────────────────────────────────────────
// Gera um connectToken para abrir o Pluggy Connect Widget no frontend.
router.post('/connect-token', async (req, res) => {
  try {
    const pluggy = getPluggyClient();
    const connectToken = await pluggy.createConnectToken(undefined, {
      clientUserId: req.user?.email || `user-${Date.now()}`,
    });
    res.json({ connectToken: connectToken.accessToken });
  } catch (err) {
    console.error('Pluggy connect-token error:', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.message || err.message });
  }
});

// ─── POST /pluggy/setup-item ────────────────────────────────────────────────
// Vincula item Pluggy durante o setup inicial da conta e sincroniza cartões.
router.post('/setup-item', async (req, res) => {
  const { itemId } = req.body || {};
  if (!itemId) {
    return res.status(400).json({ error: 'itemId é obrigatório' });
  }

  try {
    const apiKey = await getPluggyApiKey();
    const itemRes = await pluggyRequest('GET', `/items/${encodeURIComponent(itemId)}`, null, apiKey);
    if (itemRes.status !== 200) {
      throw new Error('Não foi possível carregar os dados do banco conectado');
    }

    const connectorName = itemRes.body?.connector?.name || itemRes.body?.institution?.name || 'Banco conectado';
    const connectorType = itemRes.body?.connector?.type || itemRes.body?.type || '';
    const cartoesSincronizados = await sincronizarCartoesPluggyDoItem(apiKey, req.user.email, itemId, connectorName);

    res.status(201).json({
      itemId,
      memberEmail: req.user.email,
      connectorName,
      connectorType,
      cartoesSincronizados: cartoesSincronizados.length,
    });
  } catch (err) {
    console.error('Erro ao salvar item Pluggy no setup:', err);
    res.status(500).json({ error: err.message || 'Erro ao vincular banco no setup da conta' });
  }
});

// ─── GET /pluggy/items ───────────────────────────────────────────────────────
router.get('/items', async (req, res) => {
  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const [items, membros] = await Promise.all([
      listPluggyItems(controle.id),
      getMembros(controle.id),
    ]);

    const labels = new Map(membros.map((membro) => [membro.email.toLowerCase(), membro.email.split('@')[0]]));
    res.json(items.map((item) => ({
      ...item,
      memberLabel: labels.get(item.memberEmail.toLowerCase()) || item.memberEmail,
    })));
  } catch (err) {
    console.error('Erro ao listar itens Pluggy:', err);
    res.status(500).json({ error: 'Erro ao listar bancos vinculados' });
  }
});

// ─── POST /pluggy/items ──────────────────────────────────────────────────────
router.post('/items', async (req, res) => {
  const { itemId, memberEmail } = req.body;
  if (!itemId || !memberEmail) {
    return res.status(400).json({ error: 'itemId e memberEmail são obrigatórios' });
  }

  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    if (!(await isMembro(controle.id, memberEmail))) {
      return res.status(400).json({ error: 'O membro selecionado não faz parte deste controle' });
    }

    const apiKey = await getPluggyApiKey();
    const itemRes = await pluggyRequest('GET', `/items/${encodeURIComponent(itemId)}`, null, apiKey);
    if (itemRes.status !== 200) {
      throw new Error('Não foi possível carregar os dados do banco conectado');
    }

    const connectorName = itemRes.body?.connector?.name || itemRes.body?.institution?.name || 'Banco conectado';
    const connectorType = itemRes.body?.connector?.type || itemRes.body?.type || '';

    await savePluggyItem(controle.id, memberEmail, itemId, connectorName, connectorType);
    const cartoesSincronizados = await sincronizarCartoesPluggyDoItem(apiKey, memberEmail, itemId, connectorName);

    res.status(201).json({
      itemId,
      memberEmail,
      memberLabel: memberEmail.split('@')[0],
      connectorName,
      connectorType,
      cartoesSincronizados: cartoesSincronizados.length,
    });
  } catch (err) {
    console.error('Erro ao salvar item Pluggy:', err);
    res.status(500).json({ error: err.message || 'Erro ao vincular banco ao controle' });
  }
});

// ─── DELETE /pluggy/items/:itemId ────────────────────────────────────────────
router.delete('/items/:itemId', async (req, res) => {
  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const linkedItems = await listPluggyItems(controle.id);
    const vinculo = linkedItems.find((item) => item.itemId === req.params.itemId);

    await removePluggyItem(controle.id, req.params.itemId);
    if (vinculo?.memberEmail) {
      await inativarCartoesPorPluggyItem(vinculo.memberEmail, req.params.itemId);
    }
    res.json({ message: 'Banco desvinculado com sucesso' });
  } catch (err) {
    console.error('Erro ao remover item Pluggy:', err);
    res.status(500).json({ error: err.message || 'Erro ao remover banco vinculado' });
  }
});

// ─── POST /pluggy/items/:itemId/sync-cartoes ───────────────────────────────
router.post('/items/:itemId/sync-cartoes', async (req, res) => {
  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const linkedItems = await listPluggyItems(controle.id);
    const vinculo = linkedItems.find((item) => item.itemId === req.params.itemId);
    if (!vinculo) {
      return res.status(404).json({ error: 'Item Pluggy não está vinculado a este controle' });
    }

    const apiKey = await getPluggyApiKey();
    const cartoesSincronizados = await sincronizarCartoesPluggyDoItem(
      apiKey,
      vinculo.memberEmail,
      vinculo.itemId,
      vinculo.connectorName || 'Banco conectado',
    );

    res.json({ message: 'Cartões sincronizados com sucesso', cartoesSincronizados: cartoesSincronizados.length });
  } catch (err) {
    console.error('Erro ao sincronizar cartões Pluggy:', err);
    res.status(500).json({ error: err.message || 'Erro ao sincronizar cartões Pluggy' });
  }
});

// ─── POST /pluggy/import ──────────────────────────────────────────────────────
// Importa transações bancárias para o controle atual.
// Body: { itemIds, dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD), incluirCredito?: boolean }
router.post('/import', async (req, res) => {
  const controle = await resolveControle(req, res);
  if (!controle) return;

  const { itemIds, itemId, dataInicio, dataFim, responsavel, incluirCredito } = req.body;
  const includeCredit = Boolean(incluirCredito);
  if (!dataInicio || !dataFim) {
    return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const selectedIds = Array.isArray(itemIds) && itemIds.length > 0 ? itemIds : [itemId].filter(Boolean);
  if (selectedIds.some((value) => !uuidRegex.test(value))) {
    return res.status(400).json({ error: 'Existe um itemId inválido. Conecte novamente no Pluggy.' });
  }

  try {
    const apiKey = await getPluggyApiKey();
    const linkedItems = await listPluggyItems(controle.id);
    const linkedById = new Map(linkedItems.map((linkedItem) => [linkedItem.itemId, linkedItem]));
    const importItems = selectedIds
      .map((selectedId) => linkedById.get(selectedId) || null)
      .filter(Boolean);

    if (importItems.length === 0 && itemId && responsavel) {
      importItems.push({
        itemId,
        memberEmail: responsavel,
        connectorName: 'Banco conectado',
      });
    }

    if (importItems.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um banco vinculado para importar' });
    }

    const members = Array.from(new Set(importItems.map((item) => String(item.memberEmail || '').toLowerCase()).filter(Boolean)));
    const cardsByMember = new Map();
    for (const memberEmail of members) {
      cardsByMember.set(memberEmail, await listCartoes(memberEmail));
    }

    const allTransactions = [];
    for (const linkedItem of importItems) {
      const accountsRes = await pluggyRequest(
        'GET',
        `/accounts?itemId=${encodeURIComponent(linkedItem.itemId)}`,
        null,
        apiKey
      );
      if (accountsRes.status !== 200) {
        throw new Error('Erro ao buscar contas do banco');
      }

      const accounts = accountsRes.body.results || [];
      for (const account of accounts) {
        const isCardAccount = isContaCartao(account);
        const txRes = await pluggyRequest(
          'GET',
          `/transactions?accountId=${encodeURIComponent(account.id)}&from=${dataInicio}&to=${dataFim}&pageSize=500`,
          null,
          apiKey
        );

        if (txRes.status !== 200) continue;

        const selecionadas = (txRes.body.results || []).filter((transaction) => {
          const txType = String(transaction.type || '').toUpperCase();
          const numericAmount = Number(transaction.amount || 0);
          const isDebit = txType === 'DEBIT' || (Number.isFinite(numericAmount) && numericAmount < 0);
          if (isDebit) return true;

          if (!includeCredit || !isCardAccount) return false;
          const isCredit = txType === 'CREDIT' || (Number.isFinite(numericAmount) && numericAmount > 0);
          return isCredit;
        });

        selecionadas.forEach((transaction) => {
          const memberEmail = String(linkedItem.memberEmail || '').toLowerCase();
          const cards = cardsByMember.get(memberEmail) || [];
          const cartao = cards.find((item) => String(item.pluggyAccountId || '') === String(account.id || '')) || null;
          const numericAmount = Number(transaction.amount || 0);
          const amount = Math.abs(Number.isFinite(numericAmount) ? numericAmount : 0);
          const isCreditCardTx = isCardAccount;
          const tipoPagamento = isCreditCardTx ? 'credito' : 'debito';

          allTransactions.push({
            transaction,
            linkedItem,
            account,
            amount,
            cartaoId: cartao?.id || '',
            cartaoNome: cartao?.cartaoNome || resolveCartaoNomePluggy(account, linkedItem.connectorName),
            tipoPagamento,
            tipoLancamento: normalizeTipoLancamento('Saida'),
            isCreditCardTx,
          });
        });
      }
    }

    if (allTransactions.length === 0) {
      return res.json({ imported: 0, message: includeCredit ? 'Nenhuma transação encontrada no período.' : 'Nenhuma transação de débito encontrada no período.' });
    }

    const now  = new Date().toISOString();
    const rows = allTransactions.map(({ transaction, linkedItem, account, amount, cartaoId, cartaoNome, tipoPagamento, tipoLancamento }, index) => [
      `${Date.now()}${index}`,
      (transaction.date || transaction.paymentDate || dataInicio).split('T')[0],
      amount.toFixed(2),
      'Outros',
      transaction.description || transaction.descriptionRaw || '',
      linkedItem.memberEmail,
      tipoLancamento,
      now,
      linkedItem.connectorName || account.name || 'Banco conectado',
      linkedItem.itemId,
      account.id || '',
      tipoPagamento,
      cartaoId,
      cartaoNome,
      '',
      '',
      '',
      '',
      '',
    ]);

    await getServiceSheets().spreadsheets.values.append({
      spreadsheetId: MASTER_ID(),
      range: `${controle.spreadsheetId}!A:S`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    const sugestoesParcelamento = allTransactions
      .filter((item) => item.isCreditCardTx && item.cartaoId && item.amount > 0)
      .slice(0, 25)
      .map((item) => ({
        transactionId: String(item.transaction.id || ''),
        data: String(item.transaction.date || item.transaction.paymentDate || dataInicio).split('T')[0],
        valor: item.amount.toFixed(2),
        descricao: item.transaction.description || item.transaction.descriptionRaw || 'Compra no cartão',
        responsavel: item.linkedItem.memberEmail,
        cartaoId: item.cartaoId,
        cartaoNome: item.cartaoNome,
        bancoNome: item.linkedItem.connectorName || item.account.name || 'Banco conectado',
      }));

    res.json({
      imported: rows.length,
      itemsProcessados: importItems.length,
      incluirCredito: includeCredit,
      sugestoesParcelamento,
    });
  } catch (err) {
    console.error('Pluggy import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
