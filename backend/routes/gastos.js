const express = require('express');
const router  = express.Router();
const { getControleById, isMembro, getServiceSheets } = require('../services/masterSheet');

// tabName vem de controle.spreadsheetId (ex: "gastos_<uuid>")
// o spreadsheet é sempre a planilha mestre
const MASTER_ID = () => process.env.MASTER_SPREADSHEET_ID;

/**
 * Valida X-Controle-Id, busca o controle e verifica se o usuário é membro.
 * Retorna o objeto controle ou envia a resposta de erro e retorna null.
 */
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

// ─── GET /gastos ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const response = await getServiceSheets().spreadsheets.values.get({
      spreadsheetId: MASTER_ID(),
      range: `${controle.spreadsheetId}!A2:K`,
    });

    const rows = response.data.values || [];
    const gastos = rows.map((row) => ({
      id:           row[0] || '',
      data:         row[1] || '',
      valor:        row[2] || '',
      categoria:    row[3] || '',
      descricao:    row[4] || '',
      responsavel:  row[5] || '',
      tipo:         row[6] || '',
      dataRegistro: row[7] || '',
      banco:        row[8] || '',
      pluggyItemId: row[9] || '',
      contaId:      row[10] || '',
    }));

    res.json(gastos);
  } catch (err) {
    console.error('Erro ao buscar gastos:', err);
    res.status(500).json({ error: 'Erro ao buscar dados da planilha' });
  }
});

// ─── POST /gastos ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { data, valor, categoria, descricao, responsavel, tipo } = req.body;

  if (!data || !valor || !categoria || !responsavel || !tipo) {
    return res.status(400).json({ error: 'Campos obrigatórios: data, valor, categoria, responsavel, tipo' });
  }

  const valorNumerico = parseFloat(String(valor).replace(',', '.'));
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const id          = Date.now().toString();
    const dataRegistro = new Date().toISOString();

    await getServiceSheets().spreadsheets.values.append({
      spreadsheetId: MASTER_ID(),
      range: `${controle.spreadsheetId}!A:K`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[id, data, valorNumerico.toFixed(2), categoria, descricao || '', responsavel, tipo, dataRegistro, 'Manual', '', '']],
      },
    });

    res.status(201).json({ message: 'Lançamento adicionado', id });
  } catch (err) {
    console.error('Erro ao adicionar gasto:', err);
    res.status(500).json({ error: 'Erro ao salvar na planilha' });
  }
});

// ─── DELETE /gastos/:id ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const controle = await resolveControle(req, res);
    if (!controle) return;

    const sheets = getServiceSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_ID(),
      range: `${controle.spreadsheetId}!A:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === id);
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: MASTER_ID() });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === controle.spreadsheetId);
    if (!sheet) {
      return res.status(404).json({ error: `Aba "${controle.spreadsheetId}" não encontrada` });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: MASTER_ID(),
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        }],
      },
    });

    res.json({ message: 'Lançamento removido' });
  } catch (err) {
    console.error('Erro ao deletar gasto:', err);
    res.status(500).json({ error: 'Erro ao remover da planilha' });
  }
});

module.exports = router;
