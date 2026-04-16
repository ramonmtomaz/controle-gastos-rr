const express = require('express');
const router = express.Router();
const {
  getControleById,
  isMembro,
  getServiceSheets,
  listCartoes,
  createCompraParcelada,
  getCompraParceladaById,
  createParcelaProgramada,
  listComprasParceladas,
  listParcelasProgramadas,
} = require('../services/masterSheet');

const MASTER_ID = () => process.env.MASTER_SPREADSHEET_ID;

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

// Calcula data de parcela adicionando N meses à data base
function adicionarMeses(dataBase, meses) {
  const [ano, mes, dia] = dataBase.split('-').map(Number);
  const d = new Date(ano, mes - 1 + meses, 1);
  const diaMax = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, diaMax)).padStart(2, '0')}`;
}

// ─── GET /compras-parceladas ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const compras = await listComprasParceladas(controle.id);
    res.json(compras);
  } catch (err) {
    console.error('Erro ao listar compras parceladas:', err);
    res.status(500).json({ error: 'Erro ao buscar compras parceladas' });
  }
});

// ─── GET /parcelas-programadas ────────────────────────────────────────────────
router.get('/parcelas', async (req, res) => {
  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const { status } = req.query;
    const parcelas = await listParcelasProgramadas(controle.id, status || null);
    res.json(parcelas);
  } catch (err) {
    console.error('Erro ao listar parcelas programadas:', err);
    res.status(500).json({ error: 'Erro ao buscar parcelas' });
  }
});

// ─── POST /compras-parceladas ─────────────────────────────────────────────────
// Nova compra parcelada: cria o registro + lançamento parcela 1 + parcelas futuras 2..N
router.post('/', async (req, res) => {
  const { cartaoId, descricao, categoria, responsavel, valorTotal, totalParcelas, dataCompra } = req.body;

  if (!cartaoId || !descricao || !categoria || !responsavel || !valorTotal || !totalParcelas || !dataCompra) {
    return res.status(400).json({ error: 'Campos obrigatórios: cartaoId, descricao, categoria, responsavel, valorTotal, totalParcelas, dataCompra' });
  }

  const vTotal = parseFloat(String(valorTotal).replace(',', '.'));
  const nParcelas = parseInt(String(totalParcelas), 10);
  if (isNaN(vTotal) || vTotal <= 0) return res.status(400).json({ error: 'valorTotal inválido' });
  if (isNaN(nParcelas) || nParcelas < 1 || nParcelas > 120) return res.status(400).json({ error: 'totalParcelas deve ser entre 1 e 120' });

  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    // Valida que o cartão pertence ao usuário
    const cartoes = await listCartoes(req.user.email);
    if (!cartoes.find((c) => c.id === cartaoId)) {
      return res.status(400).json({ error: 'Cartão não encontrado ou não pertence a você' });
    }

    const valorParcelaBase = parseFloat((vTotal / nParcelas).toFixed(2));
    // Ajuste da última parcela para fechar o valor exato
    const valorUltimaParcela = parseFloat((vTotal - valorParcelaBase * (nParcelas - 1)).toFixed(2));

    // Registra a compra na aba ComprasParceladas
    const compra = await createCompraParcelada(controle.id, req.user.email, {
      cartaoId,
      descricao: String(descricao).trim().substring(0, 200),
      categoria: String(categoria).trim().substring(0, 100),
      responsavel: String(responsavel).trim().substring(0, 100),
      valorTotal: vTotal,
      totalParcelas: nParcelas,
      dataCompra,
    });

    // Parcela 1: cria lançamento imediato na aba de gastos
    const id1 = Date.now().toString();
    const dataRegistro = new Date().toISOString();
    await getServiceSheets().spreadsheets.values.append({
      spreadsheetId: MASTER_ID(),
      range: `${controle.spreadsheetId}!A:S`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          id1, dataCompra, valorParcelaBase.toFixed(2),
          categoria, descricao, responsavel, 'Gasto', dataRegistro,
          'Manual', '', '',
          'credito', cartaoId,
          cartoes.find((c) => c.id === cartaoId)?.cartaoNome || '',
          compra.id, 1, nParcelas, vTotal.toFixed(2), 'pago',
        ]],
      },
    });

    // Parcelas 2..N: registra como programadas
    const parcelasCriadas = [];
    for (let i = 2; i <= nParcelas; i++) {
      const valor = i === nParcelas ? valorUltimaParcela : valorParcelaBase;
      const dataPrevista = adicionarMeses(dataCompra, i - 1);
      const p = await createParcelaProgramada(compra.id, controle.id, cartaoId, i, valor, dataPrevista);
      parcelasCriadas.push(p);
    }

    res.status(201).json({
      message: 'Compra parcelada registrada',
      compra,
      parcelasGeradas: parcelasCriadas.length + 1,
      gastoId: id1,
    });
  } catch (err) {
    console.error('Erro ao criar compra parcelada:', err);
    res.status(500).json({ error: 'Erro ao registrar compra parcelada' });
  }
});

// ─── POST /compras-parceladas/importar-existente ──────────────────────────────
// Importa compra já em andamento (não gera lançamento imediato para parcelas passadas)
router.post('/importar-existente', async (req, res) => {
  const { cartaoId, descricao, categoria, responsavel, valorParcela, parcelasRestantes, parcelaAtual, totalParcelas, dataProximaParcela } = req.body;

  if (!cartaoId || !descricao || !categoria || !responsavel || !valorParcela || !parcelasRestantes || !parcelaAtual || !totalParcelas || !dataProximaParcela) {
    return res.status(400).json({ error: 'Campos obrigatórios: cartaoId, descricao, categoria, responsavel, valorParcela, parcelasRestantes, parcelaAtual, totalParcelas, dataProximaParcela' });
  }

  const vParcela = parseFloat(String(valorParcela).replace(',', '.'));
  const nRestantes = parseInt(String(parcelasRestantes), 10);
  const nAtual = parseInt(String(parcelaAtual), 10);
  const nTotal = parseInt(String(totalParcelas), 10);

  if (isNaN(vParcela) || vParcela <= 0) return res.status(400).json({ error: 'valorParcela inválido' });
  if (isNaN(nRestantes) || nRestantes < 1) return res.status(400).json({ error: 'parcelasRestantes inválido' });
  if (isNaN(nAtual) || nAtual < 1) return res.status(400).json({ error: 'parcelaAtual inválido' });
  if (isNaN(nTotal) || nTotal < nAtual) return res.status(400).json({ error: 'totalParcelas inválido' });

  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const cartoes = await listCartoes(req.user.email);
    if (!cartoes.find((c) => c.id === cartaoId)) {
      return res.status(400).json({ error: 'Cartão não encontrado ou não pertence a você' });
    }

    const valorTotal = parseFloat((vParcela * nTotal).toFixed(2));

    const compra = await createCompraParcelada(controle.id, req.user.email, {
      cartaoId,
      descricao: String(descricao).trim().substring(0, 200),
      categoria: String(categoria).trim().substring(0, 100),
      responsavel: String(responsavel).trim().substring(0, 100),
      valorTotal,
      totalParcelas: nTotal,
      dataCompra: dataProximaParcela,
    });

    // Gera apenas as parcelas restantes como programadas (não cria lançamento agora)
    const parcelasCriadas = [];
    for (let i = 0; i < nRestantes; i++) {
      const numParcela = nAtual + i;
      const dataPrevista = adicionarMeses(dataProximaParcela, i);
      const p = await createParcelaProgramada(compra.id, controle.id, cartaoId, numParcela, vParcela, dataPrevista);
      parcelasCriadas.push(p);
    }

    res.status(201).json({
      message: 'Compra existente importada',
      compra,
      parcelasGeradas: parcelasCriadas.length,
    });
  } catch (err) {
    console.error('Erro ao importar compra existente:', err);
    res.status(500).json({ error: 'Erro ao importar compra existente' });
  }
});

module.exports = router;
