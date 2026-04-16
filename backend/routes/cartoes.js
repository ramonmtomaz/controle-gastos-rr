const express = require('express');
const router = express.Router();
const { listCartoes, createCartao, updateCartao, inativarCartao } = require('../services/masterSheet');

function normalizeDiaCampo(value, campo, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${campo} é obrigatório`);
    return undefined;
  }
  const numero = parseInt(String(value), 10);
  if (isNaN(numero) || numero < 1 || numero > 31) {
    throw new Error(`${campo} deve ser um número entre 1 e 31`);
  }
  return numero;
}

// ─── GET /cartoes ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const cartoes = await listCartoes(req.user.email);
    res.json(cartoes);
  } catch (err) {
    console.error('Erro ao listar cartões:', err);
    res.status(500).json({ error: 'Erro ao buscar cartões' });
  }
});

// ─── POST /cartoes ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { bancoNome, cartaoNome, finalCartao, bandeira, tipoCartao, diaFechamentoFatura, diaVencimentoFatura } = req.body;

  if (!bancoNome || !cartaoNome) {
    return res.status(400).json({ error: 'Campos obrigatórios: bancoNome, cartaoNome' });
  }

  const tiposValidos = ['credito', 'debito', 'ambos'];
  const tipo = String(tipoCartao || 'credito').toLowerCase();
  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: 'tipoCartao deve ser credito, debito ou ambos' });
  }

  let fechamento;
  let vencimento;
  try {
    fechamento = normalizeDiaCampo(diaFechamentoFatura, 'diaFechamentoFatura', true);
    vencimento = normalizeDiaCampo(diaVencimentoFatura, 'diaVencimentoFatura', false);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const cartao = await createCartao(req.user.email, {
      bancoNome: String(bancoNome).trim().substring(0, 100),
      cartaoNome: String(cartaoNome).trim().substring(0, 100),
      finalCartao: String(finalCartao || '').trim().substring(0, 4),
      bandeira: String(bandeira || '').trim().substring(0, 50),
      tipoCartao: tipo,
      diaFechamentoFatura: fechamento,
      diaVencimentoFatura: vencimento,
    });
    res.status(201).json(cartao);
  } catch (err) {
    console.error('Erro ao criar cartão:', err);
    res.status(500).json({ error: 'Erro ao criar cartão' });
  }
});

// ─── PATCH /cartoes/:id ───────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { bancoNome, cartaoNome, finalCartao, bandeira, tipoCartao, diaFechamentoFatura, diaVencimentoFatura } = req.body;

  if (tipoCartao !== undefined) {
    const tiposValidos = ['credito', 'debito', 'ambos'];
    if (!tiposValidos.includes(String(tipoCartao).toLowerCase())) {
      return res.status(400).json({ error: 'tipoCartao deve ser credito, debito ou ambos' });
    }
  }

  let fechamento;
  let vencimento;
  try {
    fechamento = normalizeDiaCampo(diaFechamentoFatura, 'diaFechamentoFatura', false);
    vencimento = normalizeDiaCampo(diaVencimentoFatura, 'diaVencimentoFatura', false);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const updates = {};
    if (bancoNome  !== undefined) updates.bancoNome  = String(bancoNome).trim().substring(0, 100);
    if (cartaoNome !== undefined) updates.cartaoNome = String(cartaoNome).trim().substring(0, 100);
    if (finalCartao !== undefined) updates.finalCartao = String(finalCartao).trim().substring(0, 4);
    if (bandeira   !== undefined) updates.bandeira   = String(bandeira).trim().substring(0, 50);
    if (tipoCartao !== undefined) updates.tipoCartao = String(tipoCartao).toLowerCase();
    if (fechamento !== undefined) updates.diaFechamentoFatura = fechamento;
    if (diaVencimentoFatura !== undefined) updates.diaVencimentoFatura = vencimento === undefined ? '' : vencimento;

    const cartao = await updateCartao(id, req.user.email, updates);
    res.json(cartao);
  } catch (err) {
    if (err.message === 'Cartão não encontrado') return res.status(404).json({ error: err.message });
    console.error('Erro ao atualizar cartão:', err);
    res.status(500).json({ error: 'Erro ao atualizar cartão' });
  }
});

// ─── DELETE /cartoes/:id ──────────────────────────────────────────────────────
// Inativa o cartão (soft delete). Se não houver parcelas pendentes, marca como inativo.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Verifica parcelas pendentes em qualquer controle
    // listParcelasProgramadas requer controleId, então pesquisamos via inativarCartao direto
    await inativarCartao(id, req.user.email);
    res.json({ message: 'Cartão inativado com sucesso' });
  } catch (err) {
    if (err.message === 'Cartão não encontrado') return res.status(404).json({ error: err.message });
    console.error('Erro ao remover cartão:', err);
    res.status(500).json({ error: 'Erro ao remover cartão' });
  }
});

module.exports = router;
