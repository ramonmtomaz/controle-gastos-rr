const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { client } = require('../middleware/auth');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Gastos';

/**
 * Retorna um cliente autenticado da Sheets API usando os tokens da sessão.
 */
function getSheetsClient(tokens) {
  const authClient = Object.create(client);
  authClient.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth: authClient });
}

// ─── GET /gastos ─────────────────────────────────────────────────────────────
// Retorna todos os lançamentos da planilha (exceto o cabeçalho).
router.get('/', async (req, res) => {
  try {
    const sheets = getSheetsClient(req.googleTokens);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:H`,
    });

    const rows = response.data.values || [];
    const gastos = rows.map((row) => ({
      id:            row[0] || '',
      data:          row[1] || '',
      valor:         row[2] || '',
      categoria:     row[3] || '',
      descricao:     row[4] || '',
      responsavel:   row[5] || '',
      tipo:          row[6] || '',
      dataRegistro:  row[7] || '',
    }));

    res.json(gastos);
  } catch (err) {
    console.error('Erro ao buscar gastos:', err);
    res.status(500).json({ error: 'Erro ao buscar dados da planilha' });
  }
});

// ─── POST /gastos ─────────────────────────────────────────────────────────────
// Adiciona um novo lançamento no final da planilha.
router.post('/', async (req, res) => {
  const { data, valor, categoria, descricao, responsavel, tipo } = req.body;

  if (!data || !valor || !categoria || !responsavel || !tipo) {
    return res.status(400).json({ error: 'Campos obrigatórios: data, valor, categoria, responsavel, tipo' });
  }

  // Validação básica do valor
  const valorNumerico = parseFloat(String(valor).replace(',', '.'));
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  try {
    const sheets = getSheetsClient(req.googleTokens);

    // Gera ID simples baseado em timestamp
    const id = Date.now().toString();
    const dataRegistro = new Date().toISOString();

    const novaLinha = [
      id,
      data,
      valorNumerico.toFixed(2),
      categoria,
      descricao || '',
      responsavel,
      tipo,
      dataRegistro,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [novaLinha] },
    });

    res.status(201).json({ message: 'Lançamento adicionado', id });
  } catch (err) {
    console.error('Erro ao adicionar gasto:', err);
    res.status(500).json({ error: 'Erro ao salvar na planilha' });
  }
});

// ─── DELETE /gastos/:id ───────────────────────────────────────────────────────
// Remove um lançamento pelo ID (busca na coluna A e deleta a linha).
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const sheets = getSheetsClient(req.googleTokens);

    // Busca todas as linhas para achar o índice
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values || [];
    // linha 0 = cabeçalho, linhas seguintes = dados (índice base-0, mas na planilha a linha 1 é o cabeçalho)
    const rowIndex = rows.findIndex((row) => row[0] === id);

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    // Busca o sheetId da aba pelo nome
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === SHEET_NAME
    );
    if (!sheet) {
      return res.status(404).json({ error: `Aba "${SHEET_NAME}" não encontrada` });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
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
