const { google } = require('googleapis');
const { randomBytes, randomUUID } = require('crypto');

// ─── Sheets client (service account) ────────────────────────────────────────
let _sheets = null;
let _masterSetupDone = false;
const MASTER_TABS = new Set(['Controles', 'Membros', 'Codigos', 'PluggyItems']);

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
    ['https://www.googleapis.com/auth/spreadsheets'],
  );
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

const MASTER_ID = () => process.env.MASTER_SPREADSHEET_ID;

// ─── Helpers internos ────────────────────────────────────────────────────────
async function readTab(tabName) {
  if (MASTER_TABS.has(tabName) && !_masterSetupDone) {
    await setupMasterSheet();
    _masterSetupDone = true;
  }
  const res = await getServiceSheets().spreadsheets.values.get({
    spreadsheetId: MASTER_ID(),
    range: `${tabName}!A2:Z`,
  });
  return res.data.values || [];
}

async function appendRow(tabName, row) {
  if (MASTER_TABS.has(tabName) && !_masterSetupDone) {
    await setupMasterSheet();
    _masterSetupDone = true;
  }
  await getServiceSheets().spreadsheets.values.append({
    spreadsheetId: MASTER_ID(),
    range: `${tabName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

async function updateRow(tabName, rowIndex, row) {
  if (MASTER_TABS.has(tabName) && !_masterSetupDone) {
    await setupMasterSheet();
    _masterSetupDone = true;
  }
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
  if (MASTER_TABS.has(tabName) && !_masterSetupDone) {
    await setupMasterSheet();
    _masterSetupDone = true;
  }
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

async function deleteRowsWhere(tabName, predicate) {
  const rows = await readTab(tabName);
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (predicate(rows[index])) {
      await deleteRowInMaster(tabName, index);
    }
  }
}

async function deleteSheetByTitle(tabName) {
  const spreadsheet = await getServiceSheets().spreadsheets.get({ spreadsheetId: MASTER_ID() });
  const sheet = spreadsheet.data.sheets.find((item) => item.properties.title === tabName);
  if (!sheet) return;

  await getServiceSheets().spreadsheets.batchUpdate({
    spreadsheetId: MASTER_ID(),
    requestBody: {
      requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }],
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
    { name: 'PluggyItems', headers: ['controle_id', 'member_email', 'item_id', 'connector_name', 'connector_type', 'created_at', 'updated_at'] },
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

  _masterSetupDone = true;
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
  const id      = randomUUID();
  const tabName = `gastos_${id}`;

  // Cria nova aba dentro da planilha mestre (não precisa de Drive API)
  await getServiceSheets().spreadsheets.batchUpdate({
    spreadsheetId: MASTER_ID(),
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  // Adiciona cabeçalho na nova aba
  await getServiceSheets().spreadsheets.values.update({
    spreadsheetId: MASTER_ID(),
    range: `${tabName}!A1:K1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['ID', 'Data', 'Valor', 'Categoria', 'Descrição', 'Responsável', 'Tipo', 'DataRegistro', 'Banco', 'PluggyItemId', 'ContaId']],
    },
  });

  const createdAt = new Date().toISOString();
  // Armazena tabName no campo spreadsheet_id — gastos.js usa como nome da aba
  await appendRow('Controles', [id, nome, ownerEmail, tabName, createdAt]);
  await appendRow('Membros',   [id, ownerEmail, 'owner', createdAt]);

  // Código de convite inicial
  const code      = randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await appendRow('Codigos', [id, code, expiresAt]);

  return { id, nome, ownerEmail, spreadsheetId: tabName, createdAt };
}

// ─── Membros ─────────────────────────────────────────────────────────────────
async function getMembros(controleId) {
  const rows = await readTab('Membros');
  return rows
    .filter(r => r[0] === controleId)
    .map(r => ({ controleId: r[0], email: r[1], role: r[2], joinedAt: r[3] }));
}

async function getResponsavelOptions(controleId) {
  const membros = await getMembros(controleId);
  return membros.map((membro) => ({
    email: membro.email,
    label: membro.email.split('@')[0],
    role: membro.role,
  }));
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

// ─── Pluggy items ────────────────────────────────────────────────────────────
async function listPluggyItems(controleId) {
  const rows = await readTab('PluggyItems');
  return rows
    .filter((row) => row[0] === controleId)
    .map((row) => ({
      controleId: row[0],
      memberEmail: row[1] || '',
      itemId: row[2] || '',
      connectorName: row[3] || '',
      connectorType: row[4] || '',
      createdAt: row[5] || '',
      updatedAt: row[6] || '',
    }));
}

async function savePluggyItem(controleId, memberEmail, itemId, connectorName, connectorType) {
  const rows = await readTab('PluggyItems');
  const existingIndex = rows.findIndex((row) => row[0] === controleId && row[2] === itemId);
  const now = new Date().toISOString();

  if (existingIndex !== -1) {
    const createdAt = rows[existingIndex][5] || now;
    await updateRow('PluggyItems', existingIndex, [
      controleId,
      memberEmail,
      itemId,
      connectorName || '',
      connectorType || '',
      createdAt,
      now,
    ]);
    return;
  }

  await appendRow('PluggyItems', [
    controleId,
    memberEmail,
    itemId,
    connectorName || '',
    connectorType || '',
    now,
    now,
  ]);
}

async function removePluggyItem(controleId, itemId) {
  const rows = await readTab('PluggyItems');
  const index = rows.findIndex((row) => row[0] === controleId && row[2] === itemId);
  if (index === -1) throw new Error('Item Pluggy não encontrado');
  await deleteRowInMaster('PluggyItems', index);
}

// ─── Remoção completa do controle ────────────────────────────────────────────
async function deleteControle(controleId) {
  const controle = await getControleById(controleId);
  if (!controle) throw new Error('Controle não encontrado');

  await deleteRowsWhere('Membros', (row) => row[0] === controleId);
  await deleteRowsWhere('Codigos', (row) => row[0] === controleId);
  await deleteRowsWhere('PluggyItems', (row) => row[0] === controleId);
  await deleteRowsWhere('Controles', (row) => row[0] === controleId);
  await deleteSheetByTitle(controle.spreadsheetId);
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
  getResponsavelOptions,
  isMembro,
  removeMembro,
  listPluggyItems,
  savePluggyItem,
  removePluggyItem,
  deleteControle,
  getOrCreateInviteCode,
  joinByCode,
};
