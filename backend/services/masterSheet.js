const { google } = require('googleapis');
const { randomBytes, randomUUID } = require('crypto');

// ─── Sheets client (service account) ────────────────────────────────────────
let _sheets = null;

function getServiceSheets() {
  if (_sheets) return _sheets;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurado');
  const key = JSON.parse(keyRaw);
  // Render armazena JSON como string com \\n literais — corrige as quebras
  if (key.private_key) key.private_key = key.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  );
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

const MASTER_ID = () => process.env.MASTER_SPREADSHEET_ID;

// ─── Helpers internos ────────────────────────────────────────────────────────
async function readTab(tabName) {
  const res = await getServiceSheets().spreadsheets.values.get({
    spreadsheetId: MASTER_ID(),
    range: `${tabName}!A2:Z`,
  });
  return res.data.values || [];
}

async function appendRow(tabName, row) {
  await getServiceSheets().spreadsheets.values.append({
    spreadsheetId: MASTER_ID(),
    range: `${tabName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

async function updateRow(tabName, rowIndex, row) {
  // rowIndex é 0-based a partir de A2; linha real na planilha = rowIndex + 2
  const sheetRow = rowIndex + 2;
  await getServiceSheets().spreadsheets.values.update({
    spreadsheetId: MASTER_ID(),
    range: `${tabName}!A${sheetRow}:Z${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

async function deleteRowInMaster(tabName, rowIndex) {
  // rowIndex 0-based a partir de A2 → startIndex = rowIndex + 1 (0-based na API)
  const spreadsheet = await getServiceSheets().spreadsheets.get({ spreadsheetId: MASTER_ID() });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === tabName);
  if (!sheet) throw new Error(`Aba "${tabName}" não encontrada`);
  await getServiceSheets().spreadsheets.batchUpdate({
    spreadsheetId: MASTER_ID(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex + 1,
            endIndex: rowIndex + 2,
          },
        },
      }],
    },
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────
async function setupMasterSheet() {
  const spreadsheet = await getServiceSheets().spreadsheets.get({ spreadsheetId: MASTER_ID() });
  const existing = spreadsheet.data.sheets.map(s => s.properties.title);

  const tabs = [
    { name: 'Controles', headers: ['id', 'nome', 'owner_email', 'spreadsheet_id', 'created_at'] },
    { name: 'Membros',   headers: ['controle_id', 'email', 'role', 'joined_at'] },
    { name: 'Codigos',   headers: ['controle_id', 'code', 'expires_at'] },
  ];

  const newTabs = tabs.filter(t => !existing.includes(t.name));
  if (newTabs.length > 0) {
    await getServiceSheets().spreadsheets.batchUpdate({
      spreadsheetId: MASTER_ID(),
      requestBody: {
        requests: newTabs.map(t => ({ addSheet: { properties: { title: t.name } } })),
      },
    });
  }
  for (const tab of tabs) {
    await getServiceSheets().spreadsheets.values.update({
      spreadsheetId: MASTER_ID(),
      range: `${tab.name}!A1:Z1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [tab.headers] },
    });
  }
}

// ─── Controles ───────────────────────────────────────────────────────────────
async function getControlesDoUsuario(email) {
  const membros = await readTab('Membros');
  const ids = membros
    .filter(r => r[1]?.toLowerCase() === email.toLowerCase())
    .map(r => r[0]);
  if (ids.length === 0) return [];
  const controles = await readTab('Controles');
  return controles
    .filter(r => ids.includes(r[0]))
    .map(r => ({ id: r[0], nome: r[1], ownerEmail: r[2], spreadsheetId: r[3], createdAt: r[4] }));
}

async function getControleById(id) {
  const rows = await readTab('Controles');
  const r = rows.find(r => r[0] === id);
  if (!r) return null;
  return { id: r[0], nome: r[1], ownerEmail: r[2], spreadsheetId: r[3], createdAt: r[4] };
}

async function createControle(nome, ownerEmail) {
  // Cria nova planilha de gastos com conta de serviço
  const newSheet = await getServiceSheets().spreadsheets.create({
    requestBody: {
      properties: { title: nome },
      sheets: [{ properties: { title: 'Gastos' } }],
    },
  });
  const spreadsheetId = newSheet.data.spreadsheetId;

  // Adiciona cabeçalho
  await getServiceSheets().spreadsheets.values.update({
    spreadsheetId,
    range: 'Gastos!A1:H1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['ID', 'Data', 'Valor', 'Categoria', 'Descrição', 'Responsável', 'Tipo', 'DataRegistro']],
    },
  });

  const id        = randomUUID();
  const createdAt = new Date().toISOString();
  await appendRow('Controles', [id, nome, ownerEmail, spreadsheetId, createdAt]);
  await appendRow('Membros',   [id, ownerEmail, 'owner', createdAt]);

  // Código de convite inicial
  const code      = randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await appendRow('Codigos', [id, code, expiresAt]);

  return { id, nome, ownerEmail, spreadsheetId, createdAt };
}

// ─── Membros ─────────────────────────────────────────────────────────────────
async function getMembros(controleId) {
  const rows = await readTab('Membros');
  return rows
    .filter(r => r[0] === controleId)
    .map(r => ({ controleId: r[0], email: r[1], role: r[2], joinedAt: r[3] }));
}

async function isMembro(controleId, email) {
  const membros = await getMembros(controleId);
  return membros.some(m => m.email.toLowerCase() === email.toLowerCase());
}

async function removeMembro(controleId, email) {
  const rows = await readTab('Membros');
  const idx  = rows.findIndex(r => r[0] === controleId && r[1]?.toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error('Membro não encontrado');
  await deleteRowInMaster('Membros', idx);
}

// ─── Convites ─────────────────────────────────────────────────────────────────
async function getOrCreateInviteCode(controleId) {
  const rows = await readTab('Codigos');
  const idx  = rows.findIndex(r => r[0] === controleId);

  if (idx !== -1) {
    if (Date.now() < new Date(rows[idx][2]).getTime()) {
      // Código ainda válido
      return { code: rows[idx][1], expiresAt: rows[idx][2] };
    }
    // Expirado — renova
    const code      = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await updateRow('Codigos', idx, [controleId, code, expiresAt]);
    return { code, expiresAt };
  }

  // Nenhum código ainda
  const code      = randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await appendRow('Codigos', [controleId, code, expiresAt]);
  return { code, expiresAt };
}

async function joinByCode(code, email) {
  const rows = await readTab('Codigos');
  const idx  = rows.findIndex(r => r[1]?.toUpperCase() === code.toUpperCase());

  if (idx === -1) return { success: false, error: 'Código inválido' };
  if (Date.now() > new Date(rows[idx][2]).getTime()) {
    return { success: false, error: 'Código expirado. Peça um novo ao dono do controle.' };
  }

  const controleId = rows[idx][0];
  if (await isMembro(controleId, email)) {
    return { success: false, error: 'Você já é membro deste controle' };
  }

  await appendRow('Membros', [controleId, email, 'member', new Date().toISOString()]);
  const controle = await getControleById(controleId);
  return { success: true, controle };
}

module.exports = {
  getServiceSheets,
  setupMasterSheet,
  getControlesDoUsuario,
  getControleById,
  createControle,
  getMembros,
  isMembro,
  removeMembro,
  getOrCreateInviteCode,
  joinByCode,
};
