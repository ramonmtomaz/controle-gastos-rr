const express = require('express');
const router  = express.Router();
const master  = require('../services/masterSheet');

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
