const express = require('express');
const router  = express.Router();
const master  = require('../services/masterSheet');

function normalizeTipoLancamento(tipo) {
  const raw = String(tipo || '').trim().toLowerCase();
  if (raw === 'entrada') return 'Entrada';
  if (raw === 'investimento') return 'Investimento';
  return 'Saida';
}

function monthKey(value) {
  const iso = String(value || '').split('T')[0];
  return iso.length >= 7 ? iso.slice(0, 7) : '';
}

async function calcularEntradasPorMembroNoMes(controle, mes) {
  const response = await master.getServiceSheets().spreadsheets.values.get({
    spreadsheetId: process.env.MASTER_SPREADSHEET_ID,
    range: `${controle.spreadsheetId}!A2:S`,
  });
  const rows = response.data.values || [];
  return rows.reduce((acc, row) => {
    const data = row[1] || '';
    if (monthKey(data) !== mes) return acc;
    const tipo = normalizeTipoLancamento(row[6]);
    if (tipo !== 'Entrada') return acc;
    const responsavel = String(row[5] || '').toLowerCase();
    if (!responsavel) return acc;
    const valor = parseFloat(row[2] || 0) || 0;
    acc[responsavel] = (acc[responsavel] || 0) + valor;
    return acc;
  }, {});
}

function labelFromEmail(email) {
  const raw = String(email || '').trim();
  if (!raw.includes('@')) return raw;
  return raw.split('@')[0];
}

// ─── GET /controles — lista controles do usuário ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const controles = await master.getControlesDoUsuario(req.user.email);
    res.json(controles);
  } catch (err) {
    console.error('Erro ao listar controles:', err);
    res.status(500).json({ error: 'Erro ao buscar controles' });
  }
});

// ─── POST /controles — cria novo controle ─────────────────────────────────────
router.post('/', async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome do controle é obrigatório' });
  }
  try {
    const controle = await master.createControle(nome.trim(), req.user.email);
    res.status(201).json(controle);
  } catch (err) {
    console.error('Erro ao criar controle:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /controles/join — entrar via código ─────────────────────────────────
// ATENÇÃO: deve ficar ANTES de /:id para o Express não confundir "join" com um id
router.post('/join', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código é obrigatório' });
  try {
    const result = await master.joinByCode(code.trim(), req.user.email);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.controle);
  } catch (err) {
    console.error('Erro ao entrar no controle:', err);
    res.status(500).json({ error: 'Erro ao entrar no controle' });
  }
});

// ─── GET /controles/setup — configura abas no master sheet (executar uma vez) ─
// Cria as abas Controles, Membros, Codigos e adiciona cabeçalhos.
router.get('/setup', async (req, res) => {
  try {
    await master.setupMasterSheet();
    res.json({ message: 'Master sheet configurado com sucesso!' });
  } catch (err) {
    console.error('Erro no setup:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /controles/:id/invite — código de convite (auto-renova se expirado) ──
router.get('/:id/invite', async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const result = await master.getOrCreateInviteCode(id);
    res.json(result);
  } catch (err) {
    console.error('Erro ao buscar convite:', err);
    res.status(500).json({ error: 'Erro ao buscar código de convite' });
  }
});

// ─── GET /controles/:id/members — lista membros ───────────────────────────────
router.get('/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const membros = await master.getMembros(id);
    res.json(membros);
  } catch (err) {
    console.error('Erro ao listar membros:', err);
    res.status(500).json({ error: 'Erro ao listar membros' });
  }
});

// ─── GET /controles/:id/responsaveis — opções dinâmicas de responsável ───────
router.get('/:id/responsaveis', async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const responsaveis = await master.getResponsavelOptions(id);
    res.json(responsaveis);
  } catch (err) {
    console.error('Erro ao buscar responsáveis:', err);
    res.status(500).json({ error: 'Erro ao buscar responsáveis do controle' });
  }
});

// ─── GET /controles/:id/renda-geral?mes=YYYY-MM — soma renda dos membros ───
router.get('/:id/renda-geral', async (req, res) => {
  const { id } = req.params;
  const mes = req.query.mes ? String(req.query.mes) : new Date().toISOString().slice(0, 7);

  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const controle = await master.getControleById(id);
    if (!controle) return res.status(404).json({ error: 'Controle não encontrado' });

    const membros = await master.getMembros(id);
    const emails = membros.map((m) => m.email).filter(Boolean);
    const perfis = await master.listUserProfilesByEmails(emails);
    const extras = await master.listRendasExtrasByUsers(emails, mes);
    const entradasPorMembro = await calcularEntradasPorMembroNoMes(controle, mes);

    const extrasPorEmail = extras.reduce((acc, item) => {
      const email = String(item.userEmail || '').toLowerCase();
      acc[email] = (acc[email] || 0) + (parseFloat(item.valor || 0) || 0);
      return acc;
    }, {});

    const membrosRenda = emails.map((email) => {
      const perfil = perfis.find((p) => String(p.email || '').toLowerCase() === String(email || '').toLowerCase());
      const tipoRenda = String(perfil?.tipoRenda || 'fixa').toLowerCase();
      const baseFixa = parseFloat(perfil?.rendaMensalBase || 0) || 0;
      const baseVariavel = entradasPorMembro[String(email || '').toLowerCase()] || 0;
      const base = tipoRenda === 'variavel' ? baseVariavel : baseFixa;
      const extra = extrasPorEmail[String(email || '').toLowerCase()] || 0;
      return {
        email,
        tipoRenda,
        rendaMensalBase: base.toFixed(2),
        rendaExtraMes: extra.toFixed(2),
        rendaTotalMes: (base + extra).toFixed(2),
      };
    });

    const rendaMensalBase = membrosRenda.reduce((sum, item) => sum + (parseFloat(item.rendaMensalBase) || 0), 0);
    const rendaExtraMes = membrosRenda.reduce((sum, item) => sum + (parseFloat(item.rendaExtraMes) || 0), 0);
    const rendaGeralMes = rendaMensalBase + rendaExtraMes;

    res.json({
      controleId: id,
      mes,
      rendaMensalBase: rendaMensalBase.toFixed(2),
      rendaExtraMes: rendaExtraMes.toFixed(2),
      rendaGeralMes: rendaGeralMes.toFixed(2),
      membros: membrosRenda,
    });
  } catch (err) {
    console.error('Erro ao calcular renda geral:', err);
    res.status(500).json({ error: 'Erro ao calcular renda geral do controle' });
  }
});

// ─── GET /controles/:id/setup — dados de configuração do membro no controle ─
router.get('/:id/setup', async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const controle = await master.getControleById(id);
    if (!controle) return res.status(404).json({ error: 'Controle não encontrado' });

    const setup = await master.getMembroControleSetup(id, req.user.email);
    const cartoesUsuario = await master.listCartoes(req.user.email);
    const selectedIds = setup?.cartoesHabilitados || [];

    res.json({
      controleId: id,
      tipoControle: controle.tipoControle || '',
      setupConcluido: Boolean(setup?.setupControleConcluido),
      cartaoIdsSelecionados: selectedIds,
      cartoesDisponiveis: cartoesUsuario,
    });
  } catch (err) {
    console.error('Erro ao carregar setup do controle:', err);
    res.status(500).json({ error: 'Erro ao carregar setup do controle' });
  }
});

// ─── PUT /controles/:id/setup — salva configuração do membro no controle ────
router.put('/:id/setup', async (req, res) => {
  const { id } = req.params;
  const { tipoControle, cartaoIds } = req.body || {};

  if (!['solo', 'compartilhado'].includes(String(tipoControle || '').toLowerCase())) {
    return res.status(400).json({ error: 'tipoControle inválido. Use solo ou compartilhado' });
  }

  if (!Array.isArray(cartaoIds) || cartaoIds.length === 0) {
    return res.status(400).json({ error: 'Selecione ao menos um cartão para este controle' });
  }

  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const cartoesUsuario = await master.listCartoes(req.user.email);
    const validIds = new Set(cartoesUsuario.map((cartao) => cartao.id));
    const selecionados = Array.from(new Set(
      cartaoIds.map((value) => String(value || '').trim()).filter(Boolean)
    ));

    if (selecionados.some((cartaoId) => !validIds.has(cartaoId))) {
      return res.status(400).json({ error: 'Há cartões inválidos na seleção' });
    }

    await master.updateControleTipo(id, String(tipoControle).toLowerCase());
    const setupAtualizado = await master.updateMembroControleSetup(id, req.user.email, {
      setupControleConcluido: true,
      cartoesHabilitados: selecionados,
    });

    res.json({
      controleId: id,
      tipoControle: String(tipoControle).toLowerCase(),
      setupConcluido: setupAtualizado.setupControleConcluido,
      cartaoIdsSelecionados: setupAtualizado.cartoesHabilitados,
    });
  } catch (err) {
    console.error('Erro ao salvar setup do controle:', err);
    res.status(500).json({ error: 'Erro ao salvar setup do controle' });
  }
});

// ─── GET /controles/:id/cartoes — cartões de todos os membros ─────────────
router.get('/:id/cartoes', async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await master.isMembro(id, req.user.email))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const membros = await master.getMembros(id);
    const cartoesPorMembro = await Promise.all(
      membros.map(async (membro) => {
        if (!membro.setupControleConcluido) return [];
        const cartoes = await master.listCartoes(membro.email);
        const selecionados = new Set((membro.cartoesHabilitados || []).map((item) => String(item || '').trim()));
        const filtrados = selecionados.size > 0
          ? cartoes.filter((cartao) => selecionados.has(String(cartao.id || '').trim()))
          : cartoes;
        return filtrados.map((cartao) => ({
          ...cartao,
          ownerEmail: membro.email,
          ownerRole: membro.role,
          ownerLabel: labelFromEmail(membro.email),
        }));
      })
    );

    res.json(cartoesPorMembro.flat());
  } catch (err) {
    console.error('Erro ao listar cartões do controle:', err);
    res.status(500).json({ error: 'Erro ao listar cartões do controle' });
  }
});

// ─── DELETE /controles/:id/leave — sair do controle ──────────────────────────
router.delete('/:id/leave', async (req, res) => {
  const { id } = req.params;
  try {
    const controle = await master.getControleById(id);
    if (!controle) return res.status(404).json({ error: 'Controle não encontrado' });
    if (controle.ownerEmail.toLowerCase() === req.user.email.toLowerCase()) {
      return res.status(400).json({ error: 'O dono não pode sair do controle' });
    }
    await master.removeMembro(id, req.user.email);
    res.json({ message: 'Você saiu do controle com sucesso' });
  } catch (err) {
    console.error('Erro ao sair do controle:', err);
    res.status(500).json({ error: 'Erro ao sair do controle' });
  }
});

// ─── DELETE /controles/:id/members/:email — remover membro (só owner) ─────────
router.delete('/:id/members/:email', async (req, res) => {
  const { id, email } = req.params;
  try {
    const controle = await master.getControleById(id);
    if (!controle) return res.status(404).json({ error: 'Controle não encontrado' });
    if (controle.ownerEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Apenas o dono pode remover membros' });
    }
    if (email.toLowerCase() === req.user.email.toLowerCase()) {
      return res.status(400).json({ error: 'O dono não pode se remover' });
    }
    await master.removeMembro(id, email);
    res.json({ message: 'Membro removido' });
  } catch (err) {
    console.error('Erro ao remover membro:', err);
    res.status(500).json({ error: 'Erro ao remover membro' });
  }
});

// ─── DELETE /controles/:id — deletar controle inteiro (só owner) ────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const controle = await master.getControleById(id);
    if (!controle) return res.status(404).json({ error: 'Controle não encontrado' });
    if (controle.ownerEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Apenas o dono pode excluir o controle' });
    }

    await master.deleteControle(id);
    res.json({ message: 'Controle excluído com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir controle:', err);
    res.status(500).json({ error: err.message || 'Erro ao excluir controle' });
  }
});

module.exports = router;
