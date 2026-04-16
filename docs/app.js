/* global API_URL */

// ─── Configuração ─────────────────────────────────────────────────────────────
const API_URL   = 'https://controle-gastos-rr.onrender.com';
const TOKEN_KEY = 'auth_token';

// ─── JWT helpers ─────────────────────────────────────────────────────────────
function getToken()    { return localStorage.getItem(TOKEN_KEY); }
function saveToken(t)  { localStorage.setItem(TOKEN_KEY, t); }
function removeToken() { localStorage.removeItem(TOKEN_KEY); }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}
// Adiciona X-Controle-Id para rotas de gastos
function controleHeaders() {
  return { ...authHeaders(), 'X-Controle-Id': currentControleId };
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let gastos           = [];
let deleteTargetId   = null;
let currentMembers      = [];
let currentPluggyItems  = [];
let currentProfile      = null;
let currentDashboardArea = 'resumo';
let currentControleId   = null;
let currentControleNome = null;
let currentControleOwnerEmail = null;
let currentUser         = null; // { email, name, picture }
let currentCartoes      = [];
let currentComprasParceladas = [];
let currentRendasExtras = [];
let rendaGeralAtual = null;

// ─── Elementos: comuns ────────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const appScreen   = document.getElementById('app');
const btnLogin    = document.getElementById('btn-login');

// ─── Elementos: lobby ─────────────────────────────────────────────────────────
const lobbyUserName    = document.getElementById('lobby-user-name');
const lobbyUserPicture = document.getElementById('lobby-user-picture');
const btnLobbyLogout   = document.getElementById('btn-lobby-logout');
const btnCriarControle = document.getElementById('btn-criar-controle');
const btnParticipar    = document.getElementById('btn-participar-controle');
const lobbyControles   = document.getElementById('lobby-controles');
const lobbyEmpty       = document.getElementById('lobby-empty');

// ─── Elementos: modais do lobby ───────────────────────────────────────────────
const modalCriar             = document.getElementById('modal-criar');
const inputNomeControle      = document.getElementById('input-nome-controle');
const btnCriarCancelar       = document.getElementById('btn-criar-cancelar');
const btnCriarConfirmar      = document.getElementById('btn-criar-confirmar');
const criarFeedback          = document.getElementById('criar-feedback');

const modalParticipar         = document.getElementById('modal-participar');
const inputCodigo             = document.getElementById('input-codigo');
const btnParticiparCancelar   = document.getElementById('btn-participar-cancelar');
const btnParticiparConfirmar  = document.getElementById('btn-participar-confirmar');
const participarFeedback      = document.getElementById('participar-feedback');

const modalMembros     = document.getElementById('modal-membros');
const membrosTitulo    = document.getElementById('membros-titulo');
const membrosLista     = document.getElementById('membros-lista');
const conviteCodigo    = document.getElementById('convite-codigo');
const conviteExpira    = document.getElementById('convite-expira');
const btnCopiarCodigo  = document.getElementById('btn-copiar-codigo');
const btnMembrosFechar = document.getElementById('btn-membros-fechar');

// ─── Elementos: dashboard ─────────────────────────────────────────────────────
const btnLogout      = document.getElementById('btn-logout');
const btnLobby       = document.getElementById('btn-lobby');
const controleNomeEl = document.getElementById('controle-nome');
const btnRefresh     = document.getElementById('btn-refresh');
const userNameEl     = document.getElementById('user-name');
const userPictureEl  = document.getElementById('user-picture');
const formGasto      = document.getElementById('form-gasto');
const btnSubmit      = document.getElementById('btn-submit');
const formFeedback   = document.getElementById('form-feedback');
const tbodyGastos    = document.getElementById('tbody-gastos');
const loadingEl      = document.getElementById('loading');
const emptyStateEl   = document.getElementById('empty-state');
const filterSearch   = document.getElementById('filter-search');
const filterTipo     = document.getElementById('filter-tipo');
const filterResp     = document.getElementById('filter-responsavel');
const filterBanco    = document.getElementById('filter-banco');
const modalConfirm   = document.getElementById('modal-confirm');
const modalCancel    = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const dashboardMenuButtons = Array.from(document.querySelectorAll('.dashboard-menu-btn'));
const dashboardAreas = {
  resumo: document.getElementById('area-resumo'),
  estatisticas: document.getElementById('area-estatisticas'),
  lancar: document.getElementById('area-lancar'),
  investimento: document.getElementById('area-investimento'),
  lancamentos: document.getElementById('area-lancamentos'),
  bancos: document.getElementById('area-bancos'),
  conta: document.getElementById('area-conta'),
};

// ─── Elementos: Conta ───────────────────────────────────────────────────────
const formConta       = document.getElementById('form-conta');
const contaEmail      = document.getElementById('conta-email');
const contaNome       = document.getElementById('conta-nome');
const contaTelefone   = document.getElementById('conta-telefone');
const contaFoto       = document.getElementById('conta-foto');
const contaRendaBase  = document.getElementById('conta-renda-base');
const contaFeedback   = document.getElementById('conta-feedback');
const btnContaSalvar  = document.getElementById('btn-conta-salvar');
const formRendaExtra  = document.getElementById('form-renda-extra');
const btnRendaExtra   = document.getElementById('btn-renda-extra');
const rendaExtraValor = document.getElementById('renda-extra-valor');
const rendaExtraData  = document.getElementById('renda-extra-data');
const rendaExtraDesc  = document.getElementById('renda-extra-desc');
const rendaExtraFeedback = document.getElementById('renda-extra-feedback');
const listaRendaExtra = document.getElementById('lista-renda-extra');

// ─── Elementos: Estatísticas ───────────────────────────────────────────────
const estatCartao = document.getElementById('estat-cartao');
const estatGastoGeral = document.getElementById('estat-gasto-geral');
const estatRendaGeral = document.getElementById('estat-renda-geral');
const estatDiferenca = document.getElementById('estat-diferenca');
const estatPercentual = document.getElementById('estat-percentual');
const estatFaturasLista = document.getElementById('estat-faturas-lista');
const estatCategoriasLista = document.getElementById('estat-categorias-lista');

// ─── Elementos: Pluggy ───────────────────────────────────────────────────────────
const btnImportarBanco  = document.getElementById('btn-importar-banco');
const btnSyncCartoesPluggy = document.getElementById('btn-sync-cartoes-pluggy');
const modalPluggy       = document.getElementById('modal-pluggy');
const pluggyDataInicio  = document.getElementById('pluggy-data-inicio');
const pluggyDataFim     = document.getElementById('pluggy-data-fim');
const pluggyResponsavel = document.getElementById('pluggy-responsavel');
const pluggyItemsList   = document.getElementById('pluggy-items-list');
const pluggyItemsCount  = document.getElementById('pluggy-items-count');
const pluggyFeedback    = document.getElementById('pluggy-feedback');
const btnPluggyConectar = document.getElementById('btn-pluggy-conectar');
const btnPluggyCancelar  = document.getElementById('btn-pluggy-cancelar');
const btnPluggyConfirmar = document.getElementById('btn-pluggy-confirmar');

// ─── Inicialização ────────────────────────────────────────────────────────────
(async function init() {
  // Captura token do URL fragment após OAuth callback (#token=...)
  const hash = window.location.hash;
  if (hash.startsWith('#token=')) {
    saveToken(hash.slice(7));
    history.replaceState(null, '', window.location.pathname);
  }

  // Erros de autenticação
  const params = new URLSearchParams(window.location.search);
  const erro = params.get('error');
  if (erro) {
    const mensagens = {
      acesso_negado:      'Acesso negado.',
      falha_autenticacao: 'Falha na autenticação. Tente novamente.',
      sem_codigo:         'Código de autenticação ausente.',
    };
    mostrarErroLogin(mensagens[erro] || 'Erro desconhecido.');
    history.replaceState({}, '', window.location.pathname);
  }

  btnLogin.href = `${API_URL}/auth/google`;

  if (!getToken()) { mostrarTelaLogin(); return; }

  try {
    const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
    if (res.ok) {
      const { user } = await res.json();
      mostrarLobby(user);
      try {
        await carregarPerfilConta();
      } catch (err) {
        console.warn('Perfil não carregado na inicialização:', err.message);
      }
    } else {
      removeToken();
      mostrarTelaLogin();
    }
  } catch {
    mostrarTelaLogin();
  }
})();

// ─── Controle de telas ────────────────────────────────────────────────────────
function mostrarTelaLogin() {
  loginScreen.classList.remove('hidden');
  lobbyScreen.classList.add('hidden');
  appScreen.classList.add('hidden');
}

function mostrarErroLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  mostrarTelaLogin();
}

function mostrarLobby(user) {
  if (user) {
    currentUser = user;
    updateDisplayedUserInfo({
      name: user.name,
      picture: user.picture,
    });
  }
  loginScreen.classList.add('hidden');
  appScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  carregarControles();
}

function updateDisplayedUserInfo({ name, picture }) {
  const safeName = name || 'Usuário';
  const safePicture = picture || '';

  lobbyUserName.textContent = safeName;
  userNameEl.textContent = safeName;
  lobbyUserPicture.src = safePicture;
  userPictureEl.src = safePicture;
  lobbyUserPicture.alt = safeName;
  userPictureEl.alt = safeName;

  if (currentUser) {
    currentUser.name = safeName;
    currentUser.picture = safePicture;
  }
}

function setDashboardArea(area) {
  if (!dashboardAreas[area]) return;
  currentDashboardArea = area;

  dashboardMenuButtons.forEach((button) => {
    const isActive = button.dataset.area === area;
    button.classList.toggle('is-active', isActive);
  });

  Object.entries(dashboardAreas).forEach(([key, sectionEl]) => {
    sectionEl.classList.toggle('hidden', key !== area);
  });
}

function preencherContaForm(profile) {
  contaEmail.value = profile.email || '';
  contaNome.value = profile.displayName || currentUser?.name || '';
  contaTelefone.value = profile.phone || '';
  contaFoto.value = profile.pictureUrl || currentUser?.picture || '';
  contaRendaBase.value = profile.rendaMensalBase || '0';
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function isMesAtual(dataIso) {
  if (!dataIso) return false;
  return String(dataIso).slice(0, 7) === mesAtual();
}

async function carregarPerfilConta() {
  const res = await fetch(`${API_URL}/auth/profile`, { headers: authHeaders() });
  if (res.status === 401) {
    removeToken();
    mostrarTelaLogin();
    return;
  }
  if (!res.ok) throw new Error('Erro ao carregar dados da conta');

  const { profile } = await res.json();
  currentProfile = profile;
  preencherContaForm(profile);
  updateDisplayedUserInfo({
    name: profile.displayName || currentUser?.name,
    picture: profile.pictureUrl || currentUser?.picture,
  });
}

async function carregarRendaGeralControle() {
  if (!currentControleId) return;
  const res = await fetch(`${API_URL}/controles/${currentControleId}/renda-geral?mes=${mesAtual()}`, {
    headers: authHeaders(),
  });
  if (res.status === 401) {
    removeToken();
    mostrarTelaLogin();
    return;
  }
  if (!res.ok) throw new Error('Erro ao carregar renda geral do controle');
  rendaGeralAtual = await res.json();
}

async function carregarRendasExtras() {
  const res = await fetch(`${API_URL}/auth/renda-extras?mes=${mesAtual()}`, { headers: authHeaders() });
  if (res.status === 401) {
    removeToken();
    mostrarTelaLogin();
    return;
  }
  if (!res.ok) throw new Error('Erro ao carregar rendas extras');
  const data = await res.json();
  currentRendasExtras = data.extras || [];
  renderRendasExtras();
}

function voltarLobby() {
  currentControleId   = null;
  currentControleNome = null;
  currentControleOwnerEmail = null;
  currentMembers = [];
  currentPluggyItems = [];
  currentProfile = null;
  currentCartoes = [];
  currentComprasParceladas = [];
  currentRendasExtras = [];
  rendaGeralAtual = null;
  setDashboardArea('resumo');
  appScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  carregarControles();
}

function getMemberLabel(email) {
  if (!email) return '';
  const normalized = String(email).toLowerCase();
  const member = currentMembers.find((item) => item.email.toLowerCase() === normalized);
  if (member) return member.label;
  return String(email).includes('@') ? String(email).split('@')[0] : String(email);
}

function setSelectOptions(selectEl, options, emptyLabel) {
  const previousValue = selectEl.value;
  selectEl.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyLabel;
  selectEl.appendChild(emptyOption);

  options.forEach((option) => {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    selectEl.appendChild(el);
  });

  if (options.some((option) => option.value === previousValue)) {
    selectEl.value = previousValue;
  }
}

function atualizarFiltroBancos() {
  const previousValue = filterBanco.value;
  const bancos = Array.from(new Set(
    gastos.map((gasto) => gasto.banco || 'Manual').filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  filterBanco.innerHTML = '<option value="">Todos os bancos</option>';
  bancos.forEach((banco) => {
    const option = document.createElement('option');
    option.value = banco;
    option.textContent = banco;
    filterBanco.appendChild(option);
  });

  if (bancos.includes(previousValue)) {
    filterBanco.value = previousValue;
  }
}

async function carregarResponsaveis() {
  if (!currentControleId) return;

  const res = await fetch(`${API_URL}/controles/${currentControleId}/responsaveis`, { headers: authHeaders() });
  if (res.status === 401) {
    removeToken();
    mostrarTelaLogin();
    return;
  }
  if (!res.ok) throw new Error('Erro ao carregar responsáveis');

  currentMembers = await res.json();
  const options = currentMembers.map((member) => ({ value: member.email, label: member.label }));
  setSelectOptions(document.getElementById('input-responsavel'), options, 'Selecione...');
  setSelectOptions(document.getElementById('inv-responsavel'), options, 'Selecione...');
  setSelectOptions(document.getElementById('imp-responsavel'), options, 'Selecione...');
  setSelectOptions(filterResp, options, 'Todos');
  setSelectOptions(pluggyResponsavel, options, 'Selecione...');
}

// ─── Logout ───────────────────────────────────────────────────────────────────
btnLobbyLogout.addEventListener('click', async () => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  currentProfile = null;
  removeToken();
  mostrarTelaLogin();
});

btnLogout.addEventListener('click', async () => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  currentProfile = null;
  removeToken();
  mostrarTelaLogin();
});

// ─── Lobby: carregar controles ────────────────────────────────────────────────
async function carregarControles() {
  lobbyControles.innerHTML = '<p class="lobby-loading">Carregando...</p>';
  lobbyEmpty.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/controles`, { headers: authHeaders() });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    if (!res.ok) throw new Error();
    const controles = await res.json();
    lobbyControles.innerHTML = '';

    if (controles.length === 0) {
      lobbyEmpty.classList.remove('hidden');
      return;
    }

    controles.forEach(c => {
      const isOwner = currentUser && c.ownerEmail.toLowerCase() === currentUser.email.toLowerCase();
      const card = document.createElement('div');
      card.className = 'controle-card';
      card.innerHTML = `
        <div class="controle-card-header">
          <span class="controle-card-nome">${escapeHtml(c.nome)}</span>
          <span class="controle-badge ${isOwner ? 'badge-owner' : 'badge-member'}">${isOwner ? 'Dono' : 'Membro'}</span>
        </div>
        <div class="controle-card-actions">
          <button class="btn btn-primary btn-sm btn-abrir"
            data-id="${escapeHtml(c.id)}"
            data-nome="${escapeHtml(c.nome)}"
            data-owner="${escapeHtml(c.ownerEmail)}">Abrir</button>
          <button class="btn btn-outline btn-sm btn-ver-membros"
            data-id="${escapeHtml(c.id)}"
            data-nome="${escapeHtml(c.nome)}">👥 Membros</button>
          ${isOwner ? `<button class="btn btn-danger btn-sm btn-excluir-controle" data-id="${escapeHtml(c.id)}" data-nome="${escapeHtml(c.nome)}">Excluir</button>` : ''}
          ${!isOwner ? `<button class="btn btn-outline btn-sm btn-sair" data-id="${escapeHtml(c.id)}">Sair</button>` : ''}
        </div>
      `;
      lobbyControles.appendChild(card);
    });

    lobbyControles.querySelectorAll('.btn-abrir').forEach(btn =>
      btn.addEventListener('click', () => abrirControle(btn.dataset.id, btn.dataset.nome, btn.dataset.owner))
    );
    lobbyControles.querySelectorAll('.btn-ver-membros').forEach(btn =>
      btn.addEventListener('click', () => abrirModalMembros(btn.dataset.id, btn.dataset.nome))
    );
    lobbyControles.querySelectorAll('.btn-sair').forEach(btn =>
      btn.addEventListener('click', () => sairDoControle(btn.dataset.id))
    );
    lobbyControles.querySelectorAll('.btn-excluir-controle').forEach(btn =>
      btn.addEventListener('click', () => excluirControle(btn.dataset.id, btn.dataset.nome))
    );
  } catch {
    lobbyControles.innerHTML = '<p class="lobby-loading" style="color:var(--danger)">Erro ao carregar controles.</p>';
  }
}

// ─── Lobby: criar controle ────────────────────────────────────────────────────
btnCriarControle.addEventListener('click', () => {
  inputNomeControle.value = '';
  criarFeedback.classList.add('hidden');
  modalCriar.classList.remove('hidden');
  requestAnimationFrame(() => inputNomeControle.focus());
});

btnCriarCancelar.addEventListener('click', () => modalCriar.classList.add('hidden'));

btnCriarConfirmar.addEventListener('click', async () => {
  const nome = inputNomeControle.value.trim();
  if (!nome) { mostrarFeedbackEl(criarFeedback, 'error', 'Informe um nome para o controle.'); return; }
  btnCriarConfirmar.disabled = true;
  btnCriarConfirmar.textContent = 'Criando...';
  criarFeedback.classList.add('hidden');
  try {
    const res = await fetch(`${API_URL}/controles`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nome }),
    });
    const data = await res.json();
    if (!res.ok) { mostrarFeedbackEl(criarFeedback, 'error', data.error || 'Erro ao criar.'); return; }
    modalCriar.classList.add('hidden');
    carregarControles();
  } catch {
    mostrarFeedbackEl(criarFeedback, 'error', 'Erro de conexão.');
  } finally {
    btnCriarConfirmar.disabled = false;
    btnCriarConfirmar.textContent = 'Criar';
  }
});

// ─── Lobby: participar via código ─────────────────────────────────────────────
btnParticipar.addEventListener('click', () => {
  inputCodigo.value = '';
  participarFeedback.classList.add('hidden');
  modalParticipar.classList.remove('hidden');
  requestAnimationFrame(() => inputCodigo.focus());
});

btnParticiparCancelar.addEventListener('click', () => modalParticipar.classList.add('hidden'));

inputCodigo.addEventListener('input', () => {
  inputCodigo.value = inputCodigo.value.toUpperCase().replace(/[^A-F0-9]/g, '');
});

btnParticiparConfirmar.addEventListener('click', async () => {
  const code = inputCodigo.value.trim();
  if (!code) { mostrarFeedbackEl(participarFeedback, 'error', 'Informe o código de convite.'); return; }
  btnParticiparConfirmar.disabled = true;
  btnParticiparConfirmar.textContent = 'Entrando...';
  participarFeedback.classList.add('hidden');
  try {
    const res = await fetch(`${API_URL}/controles/join`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) { mostrarFeedbackEl(participarFeedback, 'error', data.error || 'Erro ao entrar.'); return; }
    modalParticipar.classList.add('hidden');
    carregarControles();
  } catch {
    mostrarFeedbackEl(participarFeedback, 'error', 'Erro de conexão.');
  } finally {
    btnParticiparConfirmar.disabled = false;
    btnParticiparConfirmar.textContent = 'Entrar';
  }
});

// ─── Lobby: membros e convite ─────────────────────────────────────────────────
async function abrirModalMembros(controleId, nome) {
  membrosTitulo.textContent = `Membros — ${nome}`;
  membrosLista.innerHTML = '<p class="lobby-loading">Carregando...</p>';
  conviteCodigo.textContent = '...';
  conviteExpira.textContent = '';
  modalMembros.classList.remove('hidden');

  try {
    const [resMembros, resConvite] = await Promise.all([
      fetch(`${API_URL}/controles/${controleId}/members`, { headers: authHeaders() }),
      fetch(`${API_URL}/controles/${controleId}/invite`,  { headers: authHeaders() }),
    ]);

    if (resMembros.ok) {
      const membros = await resMembros.json();
      const euSouOwner = currentUser && membros.some(
        m => m.email.toLowerCase() === currentUser.email.toLowerCase() && m.role === 'owner'
      );
      membrosLista.innerHTML = membros.map(m => `
        <div class="membro-item">
          <span class="membro-email">${escapeHtml(m.email)}</span>
          <div class="membro-right">
            <span class="membro-role ${m.role === 'owner' ? 'role-owner' : 'role-member'}">${m.role === 'owner' ? 'Dono' : 'Membro'}</span>
            ${euSouOwner && m.role !== 'owner'
              ? `<button class="btn btn-danger btn-sm btn-remover-membro"
                   data-controle="${escapeHtml(controleId)}"
                   data-email="${escapeHtml(m.email)}">Remover</button>`
              : ''}
          </div>
        </div>
      `).join('');

      modalMembros.querySelectorAll('.btn-remover-membro').forEach(btn =>
        btn.addEventListener('click', async () => {
          if (!confirm(`Remover ${btn.dataset.email} do controle?`)) return;
          const r = await fetch(
            `${API_URL}/controles/${btn.dataset.controle}/members/${encodeURIComponent(btn.dataset.email)}`,
            { method: 'DELETE', headers: authHeaders() }
          );
          if (r.ok) abrirModalMembros(controleId, nome);
          else { const d = await r.json(); alert(d.error || 'Erro ao remover membro.'); }
        })
      );
    }

    if (resConvite.ok) {
      const { code, expiresAt } = await resConvite.json();
      conviteCodigo.textContent = code;
      const exp = new Date(expiresAt);
      conviteExpira.textContent = `Expira: ${exp.toLocaleDateString('pt-BR')} às ${exp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch {
    membrosLista.innerHTML = '<span style="color:var(--danger)">Erro ao carregar.</span>';
  }
}

btnCopiarCodigo.addEventListener('click', () => {
  navigator.clipboard.writeText(conviteCodigo.textContent).then(() => {
    const orig = btnCopiarCodigo.textContent;
    btnCopiarCodigo.textContent = '✓ Copiado!';
    setTimeout(() => (btnCopiarCodigo.textContent = orig), 2000);
  });
});

btnMembrosFechar.addEventListener('click', () => modalMembros.classList.add('hidden'));

// ─── Lobby: sair do controle ──────────────────────────────────────────────────
async function sairDoControle(controleId) {
  if (!confirm('Tem certeza que quer sair deste controle?')) return;
  try {
    const res = await fetch(`${API_URL}/controles/${controleId}/leave`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Erro ao sair.'); return; }
    carregarControles();
  } catch {
    alert('Erro de conexão.');
  }
}

async function excluirControle(controleId, nome) {
  if (!confirm(`Excluir permanentemente o controle "${nome}"?`)) return;

  try {
    const res = await fetch(`${API_URL}/controles/${controleId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Erro ao excluir controle.');
      return;
    }
    carregarControles();
  } catch {
    alert('Erro de conexão.');
  }
}

// ─── Dashboard: abrir controle ────────────────────────────────────────────────
async function abrirControle(id, nome, ownerEmail) {
  currentControleId   = id;
  currentControleNome = nome;
  currentControleOwnerEmail = ownerEmail || null;
  controleNomeEl.textContent = nome;
  lobbyScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  setDashboardArea(currentDashboardArea || 'resumo');
  document.getElementById('input-data').valueAsDate = new Date();
  document.getElementById('inv-data').valueAsDate = new Date();
  rendaExtraData.valueAsDate = new Date();
  try {
    await carregarResponsaveis();
    await carregarPerfilConta();
    await carregarRendasExtras();
    await carregarCartoes();
    await sincronizarCartoesPluggy(false);
    await carregarComprasParceladas();
    await carregarGastos();
    await carregarRendaGeralControle();
    atualizarResumo();
    atualizarEstatisticas();
  } catch (err) {
    console.error(err);
    mostrarFeedback('error', 'Não foi possível carregar os membros deste controle.');
  }
}

btnLobby.addEventListener('click', voltarLobby);

dashboardMenuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setDashboardArea(button.dataset.area);
    if (button.dataset.area === 'estatisticas') {
      atualizarEstatisticas();
    }
  });
});

// ─── Dashboard: dados ────────────────────────────────────────────────────────
async function carregarGastos() {
  loadingEl.classList.remove('hidden');
  emptyStateEl.classList.add('hidden');
  tbodyGastos.innerHTML = '';

  try {
    const res = await fetch(`${API_URL}/gastos`, { headers: controleHeaders() });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    if (!res.ok) throw new Error('Erro ao buscar dados');
    gastos = await res.json();
    atualizarFiltroBancos();
    renderizarTabela();
    atualizarResumo();
    atualizarEstatisticas();
  } catch (err) {
    console.error(err);
    emptyStateEl.textContent = 'Erro ao carregar dados. Tente novamente.';
    emptyStateEl.classList.remove('hidden');
  } finally {
    loadingEl.classList.add('hidden');
  }
}

btnRefresh.addEventListener('click', carregarGastos);

// ─── Dashboard: formulário ────────────────────────────────────────────────────
formGasto.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Salvando...';
  esconderFeedback();

  const tipoPagamento = document.getElementById('input-tipo-pagamento').value;
  const parcelasEl   = document.getElementById('input-parcelas');
  const cartaoEl     = document.getElementById('input-cartao');
  const totalParcelas = tipoPagamento === 'credito' ? parseInt(parcelasEl.value || '1', 10) : 1;
  const cartaoId   = (tipoPagamento === 'credito' || tipoPagamento === 'debito') ? cartaoEl.value : '';
  const cartaoSelecionado = currentCartoes.find((c) => c.id === cartaoId);

  const dataVal     = document.getElementById('input-data').value;
  const valorVal    = document.getElementById('input-valor').value;
  const categoriaVal = document.getElementById('input-categoria').value;
  const descricaoVal = document.getElementById('input-descricao').value;
  const responsavelVal = document.getElementById('input-responsavel').value;

  if ((tipoPagamento === 'credito' || tipoPagamento === 'debito') && !cartaoId) {
    mostrarFeedback('error', 'Selecione o cartão para pagamento com crédito ou débito.');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Adicionar';
    return;
  }

  try {
    if (tipoPagamento === 'credito' && totalParcelas > 1) {
      // Deleganda para compras parceladas — cria compra + parcelas futuras
      const res = await fetch(`${API_URL}/compras-parceladas`, {
        method: 'POST',
        headers: controleHeaders(),
        body: JSON.stringify({
          cartaoId,
          descricao: descricaoVal,
          categoria: categoriaVal,
          responsavel: responsavelVal,
          valorTotal: valorVal,
          totalParcelas,
          dataCompra: dataVal,
        }),
      });
      if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
      const data = await res.json();
      if (!res.ok) { mostrarFeedback('error', data.error || 'Erro ao salvar compra parcelada.'); return; }
      mostrarFeedback('success', `Compra parcelada em ${totalParcelas}x criada com sucesso!`);
      formGasto.reset();
      document.getElementById('input-data').valueAsDate = new Date();
      document.getElementById('grupo-cartao').style.display = 'none';
      document.getElementById('grupo-parcelamento').classList.add('hidden');
      await carregarGastos();
      await carregarComprasParceladas();
    } else {
      // Lançamento simples (crédito à vista, débito, pix, etc.)
      const payload = {
        data: dataVal,
        valor: valorVal,
        tipo: 'Gasto',
        categoria: categoriaVal,
        descricao: descricaoVal,
        responsavel: responsavelVal,
        tipoPagamento,
        cartaoId:   cartaoSelecionado?.id   || '',
        cartaoNome: cartaoSelecionado?.cartaoNome || '',
        numParcela: 1,
        totalParcelas: 1,
      };
      const res = await fetch(`${API_URL}/gastos`, {
        method: 'POST',
        headers: controleHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
      const data = await res.json();
      if (!res.ok) { mostrarFeedback('error', data.error || 'Erro ao salvar lançamento.'); return; }
      mostrarFeedback('success', 'Lançamento adicionado com sucesso!');
      formGasto.reset();
      document.getElementById('input-data').valueAsDate = new Date();
      document.getElementById('grupo-cartao').style.display = 'none';
      document.getElementById('grupo-parcelamento').classList.add('hidden');
      await carregarGastos();
    }
  } catch {
    mostrarFeedback('error', 'Erro de conexão com o servidor.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Adicionar';
  }
});

// Tipo de pagamento → mostrar/ocultar cartão e parcelamento
document.getElementById('input-tipo-pagamento').addEventListener('change', function () {
  const tipo = this.value;
  const grupoCartao = document.getElementById('grupo-cartao');
  const grupoParcelamento = document.getElementById('grupo-parcelamento');
  if (tipo === 'credito' || tipo === 'debito') {
    grupoCartao.style.display = '';
  } else {
    grupoCartao.style.display = 'none';
    document.getElementById('input-cartao').value = '';
  }
  if (tipo === 'credito') {
    grupoParcelamento.classList.remove('hidden');
  } else {
    grupoParcelamento.classList.add('hidden');
    document.getElementById('input-parcelas').value = '1';
  }
  atualizarPreviewParcela();
});

function atualizarPreviewParcela() {
  const valor = parseFloat(document.getElementById('input-valor').value || '0');
  const parcelas = parseInt(document.getElementById('input-parcelas').value || '1', 10);
  const preview = document.getElementById('preview-parcela');
  if (!preview) return;
  if (valor > 0 && parcelas > 1) {
    const porParcela = (valor / parcelas).toFixed(2);
    preview.textContent = `${formatarValor(porParcela)} / mês`;
  } else if (valor > 0) {
    preview.textContent = formatarValor(valor);
  } else {
    preview.textContent = '—';
  }
}

document.getElementById('input-valor').addEventListener('input', atualizarPreviewParcela);
document.getElementById('input-parcelas').addEventListener('change', atualizarPreviewParcela);

formConta.addEventListener('submit', async (e) => {
  e.preventDefault();
  const displayName = contaNome.value.trim();
  const phone = contaTelefone.value.trim();
  const rendaMensalBase = parseFloat(String(contaRendaBase.value || '0').replace(',', '.'));

  if (!displayName) {
    mostrarFeedbackEl(contaFeedback, 'error', 'Informe um nome exibido.');
    return;
  }

  if (isNaN(rendaMensalBase) || rendaMensalBase < 0) {
    mostrarFeedbackEl(contaFeedback, 'error', 'Renda mensal base inválida.');
    return;
  }

  btnContaSalvar.disabled = true;
  btnContaSalvar.textContent = 'Salvando...';
  contaFeedback.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/auth/profile`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ displayName, phone, rendaMensalBase }),
    });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar dados da conta');

    currentProfile = data.profile;
    preencherContaForm(currentProfile);
    updateDisplayedUserInfo({
      name: currentProfile.displayName || currentUser?.name,
      picture: currentProfile.pictureUrl || currentUser?.picture,
    });
    await carregarRendaGeralControle();
    atualizarResumo();
    atualizarEstatisticas();
    mostrarFeedbackEl(contaFeedback, 'success', 'Dados da conta atualizados com sucesso.');
  } catch (err) {
    mostrarFeedbackEl(contaFeedback, 'error', err.message);
  } finally {
    btnContaSalvar.disabled = false;
    btnContaSalvar.textContent = 'Salvar alterações';
  }
});

function renderRendasExtras() {
  if (!listaRendaExtra) return;
  if (!currentRendasExtras.length) {
    listaRendaExtra.innerHTML = '<p class="empty-state-inline">Nenhuma renda extra cadastrada neste mês.</p>';
    return;
  }

  const listaOrdenada = [...currentRendasExtras].sort((a, b) => new Date(b.dataReferencia) - new Date(a.dataReferencia));
  listaRendaExtra.innerHTML = listaOrdenada.map((item) => `
    <div class="renda-extra-item">
      <div>
        <div class="renda-extra-titulo">${escapeHtml(item.descricao || 'Renda extra')}</div>
        <div class="renda-extra-meta">${formatarData(item.dataReferencia)} • ${formatarValor(item.valor)}</div>
      </div>
      <button class="btn btn-outline btn-sm btn-remover-renda-extra" data-id="${escapeHtml(item.id)}">Remover</button>
    </div>
  `).join('');

  listaRendaExtra.querySelectorAll('.btn-remover-renda-extra').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Remover esta renda extra?')) return;
      try {
        const res = await fetch(`${API_URL}/auth/renda-extras/${encodeURIComponent(button.dataset.id)}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao remover renda extra');
        await carregarRendasExtras();
        await carregarRendaGeralControle();
        atualizarResumo();
        atualizarEstatisticas();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

formRendaExtra.addEventListener('submit', async (e) => {
  e.preventDefault();
  rendaExtraFeedback.classList.add('hidden');

  const valor = parseFloat(String(rendaExtraValor.value || '').replace(',', '.'));
  const dataReferencia = rendaExtraData.value;
  const descricao = rendaExtraDesc.value.trim();

  if (isNaN(valor) || valor <= 0) {
    mostrarFeedbackEl(rendaExtraFeedback, 'error', 'Informe um valor válido para renda extra.');
    return;
  }

  if (!dataReferencia) {
    mostrarFeedbackEl(rendaExtraFeedback, 'error', 'Informe a data da renda extra.');
    return;
  }

  btnRendaExtra.disabled = true;
  btnRendaExtra.textContent = 'Salvando...';

  try {
    const res = await fetch(`${API_URL}/auth/renda-extras`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ valor, descricao, dataReferencia }),
    });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar renda extra');
    mostrarFeedbackEl(rendaExtraFeedback, 'success', 'Renda extra adicionada com sucesso.');
    formRendaExtra.reset();
    rendaExtraData.valueAsDate = new Date();
    await carregarRendasExtras();
    await carregarRendaGeralControle();
    atualizarResumo();
    atualizarEstatisticas();
  } catch (err) {
    mostrarFeedbackEl(rendaExtraFeedback, 'error', err.message);
  } finally {
    btnRendaExtra.disabled = false;
    btnRendaExtra.textContent = 'Adicionar renda extra';
  }
});

function mostrarFeedback(tipo, msg) {
  formFeedback.textContent = msg;
  formFeedback.className = `feedback ${tipo}`;
  formFeedback.classList.remove('hidden');
  setTimeout(esconderFeedback, 5000);
}
function esconderFeedback() { formFeedback.classList.add('hidden'); }

// ─── Dashboard: tabela ────────────────────────────────────────────────────────
function gastosFiltrados() {
  const busca = filterSearch.value.toLowerCase();
  const tipo  = filterTipo.value;
  const resp  = filterResp.value;
  const banco = filterBanco.value;
  return gastos.filter((g) => {
    if (tipo && g.tipo !== tipo) return false;
    if (resp && g.responsavel !== resp) return false;
    if (banco && (g.banco || 'Manual') !== banco) return false;
    if (busca) {
      return (
        (g.descricao || '').toLowerCase().includes(busca) ||
        (g.categoria || '').toLowerCase().includes(busca) ||
        getMemberLabel(g.responsavel).toLowerCase().includes(busca) ||
        (g.banco || 'Manual').toLowerCase().includes(busca)
      );
    }
    return true;
  });
}

[filterSearch, filterTipo, filterResp, filterBanco].forEach((el) =>
  el.addEventListener('input', () => { renderizarTabela(); atualizarResumo(); })
);

function renderizarTabela() {
  const lista = gastosFiltrados();
  tbodyGastos.innerHTML = '';

  if (lista.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');

  // Ordena por data decrescente
  lista.sort((a, b) => new Date(b.data) - new Date(a.data));

  lista.forEach((g) => {
    const responsavelLabel = getMemberLabel(g.responsavel);
    const bancoLabel = g.banco || 'Manual';
    const parcelaLabel = g.numParcela && g.totalParcelas && g.totalParcelas > 1
      ? `${g.numParcela}/${g.totalParcelas}` : '';
    const tipoPagLabel = g.tipoPagamento ? g.tipoPagamento.charAt(0).toUpperCase() + g.tipoPagamento.slice(1) : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Data">${formatarData(g.data)}</td>
      <td data-label="Tipo"><span class="tag tag-${g.tipo.toLowerCase()}">${escapeHtml(g.tipo)}</span></td>
      <td data-label="Pagamento">${tipoPagLabel ? `<span class="tag tag-pagamento">${escapeHtml(tipoPagLabel)}</span>` : '—'}</td>
      <td data-label="Categoria">${escapeHtml(g.categoria)}</td>
      <td data-label="Descrição">${escapeHtml(g.descricao) || '—'}</td>
      <td data-label="Banco"><span class="tag tag-bank">${escapeHtml(bancoLabel)}</span></td>
      <td data-label="Parcela">${parcelaLabel ? `<span class="tag tag-parcela">${escapeHtml(parcelaLabel)}</span>` : '—'}</td>
      <td data-label="Responsável"><span class="tag tag-member">${escapeHtml(responsavelLabel)}</span></td>
      <td data-label="Valor" class="text-right ${g.tipo === 'Gasto' ? 'valor-gasto' : 'valor-investimento'}">
        ${formatarValor(g.valor)}
      </td>
      <td class="td-action">
        <button class="btn-delete" data-id="${escapeHtml(g.id)}" title="Remover">🗑</button>
      </td>
    `;
    tbodyGastos.appendChild(tr);
  });

  tbodyGastos.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => abrirModalDelete(btn.dataset.id));
  });
}

function atualizarResumo() {
  const lista = gastosFiltrados();
  const totalGastos = lista
    .filter((g) => g.tipo === 'Gasto')
    .reduce((acc, g) => acc + parseFloat(g.valor || 0), 0);
  const totalInvestimentos = lista
    .filter((g) => g.tipo === 'Investimento')
    .reduce((acc, g) => acc + parseFloat(g.valor || 0), 0);

  document.getElementById('total-gastos').textContent        = formatarValor(totalGastos);
  document.getElementById('total-investimentos').textContent = formatarValor(totalInvestimentos);
  document.getElementById('total-lancamentos').textContent   = lista.length;

  const rendaGeral = parseFloat(rendaGeralAtual?.rendaGeralMes || 0) || 0;
  const saldo = rendaGeral - totalGastos;
  const percentual = rendaGeral > 0 ? (totalGastos / rendaGeral) * 100 : 0;
  const saldoEl = document.getElementById('total-saldo-geral');

  document.getElementById('total-renda-geral').textContent = formatarValor(rendaGeral);
  document.getElementById('percentual-gasto-renda').textContent = `${percentual.toFixed(1)}%`;
  saldoEl.textContent = formatarValor(saldo);
  saldoEl.classList.toggle('expense', saldo < 0);
  saldoEl.classList.toggle('investment', saldo >= 0);
}

function inicioFimMesAtual() {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { inicio, fim };
}

function gastosMesAtualPorFiltroCartao() {
  const { inicio, fim } = inicioFimMesAtual();
  const cartaoSelecionado = estatCartao?.value || '';
  return gastos.filter((item) => {
    const data = new Date(item.data);
    if (isNaN(data.getTime())) return false;
    if (data < inicio || data > fim) return false;
    if (item.tipo !== 'Gasto') return false;
    if (cartaoSelecionado && item.cartaoId !== cartaoSelecionado) return false;
    return true;
  });
}

function cicloFaturaAtual(cartao) {
  const now = new Date();
  const fechamento = Math.min(31, Math.max(1, parseInt(String(cartao?.diaFechamentoFatura || '1'), 10) || 1));

  let inicio;
  let fim;

  if (now.getDate() > fechamento) {
    inicio = new Date(now.getFullYear(), now.getMonth(), fechamento + 1);
    fim = new Date(now.getFullYear(), now.getMonth() + 1, fechamento);
  } else {
    inicio = new Date(now.getFullYear(), now.getMonth() - 1, fechamento + 1);
    fim = new Date(now.getFullYear(), now.getMonth(), fechamento);
  }

  return { inicio, fim };
}

function formatarDataCurta(date) {
  return date.toLocaleDateString('pt-BR');
}

function renderTopCategorias(lista) {
  if (!estatCategoriasLista) return;

  const mapa = lista.reduce((acc, item) => {
    const chave = item.categoria || 'Sem categoria';
    acc[chave] = (acc[chave] || 0) + (parseFloat(item.valor || 0) || 0);
    return acc;
  }, {});

  const top = Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (top.length === 0) {
    estatCategoriasLista.innerHTML = '<p class="empty-state-inline">Sem gastos para o período/filtro.</p>';
    return;
  }

  estatCategoriasLista.innerHTML = top.map(([categoria, valor], idx) => `
    <div class="categoria-item">
      <span class="categoria-rank">#${idx + 1}</span>
      <span class="categoria-nome">${escapeHtml(categoria)}</span>
      <span class="categoria-valor">${formatarValor(valor)}</span>
    </div>
  `).join('');
}

function renderFaturasCartao() {
  if (!estatFaturasLista) return;

  const cartaoFiltro = estatCartao?.value || '';
  const cartoesVisiveis = currentCartoes.filter((cartao) => !cartaoFiltro || cartao.id === cartaoFiltro);

  if (cartoesVisiveis.length === 0) {
    estatFaturasLista.innerHTML = '<p class="empty-state-inline">Nenhum cartão disponível para exibir fatura.</p>';
    return;
  }

  estatFaturasLista.innerHTML = cartoesVisiveis.map((cartao) => {
    const { inicio, fim } = cicloFaturaAtual(cartao);
    const itens = gastos
      .filter((item) => {
        if (item.tipo !== 'Gasto') return false;
        if (String(item.tipoPagamento || '').toLowerCase() !== 'credito') return false;
        if (item.cartaoId !== cartao.id) return false;
        const data = new Date(item.data);
        if (isNaN(data.getTime())) return false;
        return data >= inicio && data <= fim;
      })
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    const total = itens.reduce((sum, item) => sum + (parseFloat(item.valor || 0) || 0), 0);
    const nomeCartao = `${cartao.cartaoNome}${cartao.finalCartao ? ` • *${cartao.finalCartao}` : ''}`;

    return `
      <article class="fatura-card">
        <div class="fatura-header">
          <div>
            <h3>${escapeHtml(nomeCartao)}</h3>
            <p>Fechamento dia ${escapeHtml(cartao.diaFechamentoFatura || '1')} • Ciclo ${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}</p>
          </div>
          <div class="fatura-total">${formatarValor(total)}</div>
        </div>
        <div class="fatura-itens">
          ${itens.length === 0
            ? '<p class="empty-state-inline">Nenhuma compra no crédito neste ciclo.</p>'
            : itens.map((item) => `
                <div class="fatura-item">
                  <span>${escapeHtml(item.descricao || item.categoria || 'Compra')}</span>
                  <span>${formatarData(item.data)}</span>
                  <strong>${formatarValor(item.valor)}</strong>
                </div>
              `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function atualizarEstatisticas() {
  if (!estatGastoGeral || !estatRendaGeral) return;

  const lista = gastosMesAtualPorFiltroCartao();
  const gastoGeral = lista.reduce((sum, item) => sum + (parseFloat(item.valor || 0) || 0), 0);
  const rendaGeral = parseFloat(rendaGeralAtual?.rendaGeralMes || 0) || 0;
  const diferenca = rendaGeral - gastoGeral;
  const percentual = rendaGeral > 0 ? (gastoGeral / rendaGeral) * 100 : 0;

  estatGastoGeral.textContent = formatarValor(gastoGeral);
  estatRendaGeral.textContent = formatarValor(rendaGeral);
  estatDiferenca.textContent = formatarValor(diferenca);
  estatDiferenca.classList.toggle('expense', diferenca < 0);
  estatDiferenca.classList.toggle('investment', diferenca >= 0);
  estatPercentual.textContent = `${percentual.toFixed(1)}%`;

  renderTopCategorias(lista);
  renderFaturasCartao();
}

estatCartao?.addEventListener('change', atualizarEstatisticas);

// ─── Dashboard: exclusão ─────────────────────────────────────────────────────
function abrirModalDelete(id) {
  deleteTargetId = id;
  modalConfirm.classList.remove('hidden');
}

function fecharModalDelete() {
  deleteTargetId = null;
  modalConfirm.classList.add('hidden');
}

modalCancel.addEventListener('click', fecharModalDelete);
document.querySelector('#modal-confirm .modal-overlay').addEventListener('click', fecharModalDelete);

modalConfirmBtn.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  modalConfirmBtn.disabled = true;
  modalConfirmBtn.textContent = 'Removendo...';
  try {
    const res = await fetch(`${API_URL}/gastos/${deleteTargetId}`, {
      method: 'DELETE',
      headers: controleHeaders(),
    });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Erro ao remover lançamento.');
      return;
    }
    fecharModalDelete();
    await carregarGastos();
  } catch {
    alert('Erro de conexão com o servidor.');
  } finally {
    modalConfirmBtn.disabled = false;
    modalConfirmBtn.textContent = 'Remover';
  }
});

// ─── Utilitários ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mostrarFeedbackEl(el, tipo, msg) {
  el.textContent = msg;
  el.className   = `feedback ${tipo}`;
  el.classList.remove('hidden');
}

async function safeReadResponseJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function formatarValor(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
}

// ─── Investimento: formulário ──────────────────────────────────────────────────
document.getElementById('form-investimento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnInv = document.getElementById('btn-submit-inv');
  const invFeedback = document.getElementById('inv-feedback');
  btnInv.disabled = true;
  btnInv.textContent = 'Salvando...';
  invFeedback.classList.add('hidden');

  const payload = {
    data:        document.getElementById('inv-data').value,
    valor:       document.getElementById('inv-valor').value,
    tipo:        'Investimento',
    categoria:   document.getElementById('inv-categoria').value,
    descricao:   document.getElementById('inv-descricao').value,
    responsavel: document.getElementById('inv-responsavel').value,
  };

  try {
    const res = await fetch(`${API_URL}/gastos`, {
      method: 'POST',
      headers: controleHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    const data = await res.json();
    if (!res.ok) { mostrarFeedbackEl(invFeedback, 'error', data.error || 'Erro ao salvar investimento.'); return; }
    mostrarFeedbackEl(invFeedback, 'success', 'Investimento registrado com sucesso!');
    document.getElementById('form-investimento').reset();
    document.getElementById('inv-data').valueAsDate = new Date();
    await carregarGastos();
  } catch {
    mostrarFeedbackEl(invFeedback, 'error', 'Erro de conexão com o servidor.');
  } finally {
    btnInv.disabled = false;
    btnInv.textContent = 'Adicionar';
  }
});

// ─── Cartões: carregar e renderizar ───────────────────────────────────────────
async function carregarCartoes() {
  try {
    const res = await fetch(`${API_URL}/cartoes`, { headers: authHeaders() });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    if (!res.ok) throw new Error('Erro ao carregar cartões');
    currentCartoes = await res.json();
    renderCartoes();
    atualizarSeletoresCartao();
  } catch (err) {
    console.warn('Erro ao carregar cartões:', err.message);
  }
}

function atualizarSeletoresCartao() {
  const options = currentCartoes.map((c) => ({
    value: c.id,
    label: `${escapeHtml(c.cartaoNome)}${c.finalCartao ? ' *' + c.finalCartao : ''} (${escapeHtml(c.bancoNome)})`,
  }));
  const cartaoSelect = document.getElementById('input-cartao');
  const impCartaoSelect = document.getElementById('imp-cartao');
  const estatCartaoSelect = document.getElementById('estat-cartao');
  const prevVal1 = cartaoSelect?.value;
  const prevVal2 = impCartaoSelect?.value;
  const prevVal3 = estatCartaoSelect?.value;

  if (cartaoSelect) {
    cartaoSelect.innerHTML = '<option value="">Selecione o cartão...</option>';
    options.forEach((o) => {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      cartaoSelect.appendChild(el);
    });
    if (options.some((o) => o.value === prevVal1)) cartaoSelect.value = prevVal1;
  }
  if (impCartaoSelect) {
    impCartaoSelect.innerHTML = '<option value="">Selecione...</option>';
    options.forEach((o) => {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      impCartaoSelect.appendChild(el);
    });
    if (options.some((o) => o.value === prevVal2)) impCartaoSelect.value = prevVal2;
  }
  if (estatCartaoSelect) {
    estatCartaoSelect.innerHTML = '<option value="">Todos os cartões</option>';
    options.forEach((o) => {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      estatCartaoSelect.appendChild(el);
    });
    if (options.some((o) => o.value === prevVal3)) estatCartaoSelect.value = prevVal3;
  }
  atualizarEstatisticas();
}

function renderCartoes() {
  const lista = document.getElementById('lista-cartoes');
  if (!lista) return;
  if (currentCartoes.length === 0) {
    lista.innerHTML = '<p class="empty-state-inline">Nenhum cartão cadastrado ainda.</p>';
    return;
  }
  lista.innerHTML = currentCartoes.map((c) => `
    <article class="cartao-item" data-id="${escapeHtml(c.id)}">
      <div class="cartao-info-main">
        <div class="cartao-info">
          <span class="cartao-nome">${escapeHtml(c.cartaoNome)}${c.finalCartao ? ' <span class="cartao-final">*' + escapeHtml(c.finalCartao) + '</span>' : ''}</span>
          <span class="cartao-banco">${escapeHtml(c.bancoNome)}</span>
        </div>
        <div class="cartao-meta-row">
          <span class="tag ${String(c.origemCartao || 'manual') === 'pluggy' ? 'tag-pluggy' : 'tag-manual'}">${String(c.origemCartao || 'manual') === 'pluggy' ? 'Pluggy' : 'Manual'}</span>
          <span class="cartao-tipo tag">${escapeHtml(c.tipoCartao)}</span>
          ${c.bandeira ? `<span class="cartao-bandeira tag">${escapeHtml(c.bandeira)}</span>` : ''}
          <span class="tag tag-bank">Fecha dia ${escapeHtml(c.diaFechamentoFatura || '1')}</span>
          ${c.diaVencimentoFatura ? `<span class="tag tag-member">Vence dia ${escapeHtml(c.diaVencimentoFatura)}</span>` : ''}
        </div>
      </div>
      <div class="cartao-actions">
        ${String(c.origemCartao || 'manual') === 'pluggy' ? `<button class="btn btn-outline btn-sm btn-apelido-cartao" data-id="${escapeHtml(c.id)}" data-nome="${escapeHtml(c.cartaoNome || '')}">Apelido</button>` : ''}
        <button class="btn btn-danger btn-sm btn-remover-cartao" data-id="${escapeHtml(c.id)}">Remover</button>
      </div>
    </article>
  `).join('');

  lista.querySelectorAll('.btn-apelido-cartao').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const atual = btn.dataset.nome || '';
      const apelido = prompt('Defina um apelido para o cartão Pluggy:', atual);
      if (apelido === null) return;
      const nome = String(apelido).trim();
      if (!nome) {
        alert('Informe um apelido válido.');
        return;
      }

      btn.disabled = true;
      try {
        const res = await fetch(`${API_URL}/cartoes/${encodeURIComponent(btn.dataset.id)}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ apelido: nome }),
        });
        const data = await safeReadResponseJson(res);
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar apelido do cartão');
        await carregarCartoes();
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });

  lista.querySelectorAll('.btn-remover-cartao').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Inativar este cartão?')) return;
      btn.disabled = true;
      try {
        const res = await fetch(`${API_URL}/cartoes/${encodeURIComponent(btn.dataset.id)}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        const data = await safeReadResponseJson(res);
        if (!res.ok) throw new Error(data.error || 'Erro ao remover cartão');
        await carregarCartoes();
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

document.getElementById('form-cartao').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cartaoFeedback = document.getElementById('cartao-feedback');
  cartaoFeedback.classList.add('hidden');
  const btnAdd = e.target.querySelector('button[type="submit"]');
  btnAdd.disabled = true;

  const payload = {
    bancoNome:   document.getElementById('cartao-banco').value.trim(),
    cartaoNome:  document.getElementById('cartao-nome').value.trim(),
    finalCartao: document.getElementById('cartao-final').value.trim(),
    bandeira:    document.getElementById('cartao-bandeira').value,
    tipoCartao:  document.getElementById('cartao-tipo').value,
    diaFechamentoFatura: document.getElementById('cartao-fechamento').value,
    diaVencimentoFatura: document.getElementById('cartao-vencimento').value,
  };

  try {
    const res = await fetch(`${API_URL}/cartoes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar cartão');
    mostrarFeedbackEl(cartaoFeedback, 'success', 'Cartão cadastrado com sucesso!');
    e.target.reset();
    await carregarCartoes();
  } catch (err) {
    mostrarFeedbackEl(cartaoFeedback, 'error', err.message);
  } finally {
    btnAdd.disabled = false;
  }
});

// ─── Compras parceladas: carregar e renderizar ────────────────────────────────
async function carregarComprasParceladas() {
  if (!currentControleId) return;
  try {
    const res = await fetch(`${API_URL}/compras-parceladas`, { headers: controleHeaders() });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    if (!res.ok) throw new Error('Erro ao carregar compras parceladas');
    currentComprasParceladas = await res.json();
    renderComprasParceladas();
  } catch (err) {
    console.warn('Erro ao carregar compras parceladas:', err.message);
  }
}

function renderComprasParceladas() {
  const lista = document.getElementById('lista-compras');
  if (!lista) return;
  if (currentComprasParceladas.length === 0) {
    lista.innerHTML = '<p class="empty-state-inline">Nenhuma compra parcelada registrada.</p>';
    return;
  }
  lista.innerHTML = currentComprasParceladas.map((c) => {
    const cartao = currentCartoes.find((k) => k.id === c.cartaoId);
    const cartaoLabel = cartao ? `${escapeHtml(cartao.cartaoNome)} (${escapeHtml(cartao.bancoNome)})` : escapeHtml(c.cartaoId);
    return `
    <article class="compra-item">
      <div class="compra-info">
        <span class="compra-nome">${escapeHtml(c.descricao)}</span>
        <span class="compra-cartao">${cartaoLabel}</span>
        <div class="compra-meta-row">
          <span class="compra-parcela tag">${escapeHtml(String(c.parcelaAtual))}/${escapeHtml(String(c.totalParcelas))} parcelas</span>
          <span class="tag tag-bank">${escapeHtml(c.categoria || 'Categoria')}</span>
          <span class="tag tag-member">${escapeHtml(getMemberLabel(c.responsavel))}</span>
        </div>
        <span class="compra-valor">${formatarValor(c.valorParcela)}/mês</span>
      </div>
      <span class="tag tag-status-${(c.status || 'ativa').toLowerCase()}">${escapeHtml(c.status || 'ativa')}</span>
    </article>
    `;
  }).join('');
}

document.getElementById('form-importar-parcela').addEventListener('submit', async (e) => {
  e.preventDefault();
  const impFeedback = document.getElementById('imp-feedback');
  impFeedback.classList.add('hidden');
  const btnImp = e.target.querySelector('button[type="submit"]');
  btnImp.disabled = true;
  btnImp.textContent = 'Importando...';

  const payload = {
    cartaoId:           document.getElementById('imp-cartao').value,
    descricao:          document.getElementById('imp-descricao').value.trim(),
    categoria:          document.getElementById('imp-categoria').value,
    responsavel:        document.getElementById('imp-responsavel').value,
    valorParcela:       document.getElementById('imp-valor-parcela').value,
    parcelaAtual:       document.getElementById('imp-parcela-atual').value,
    totalParcelas:      document.getElementById('imp-total-parcelas').value,
    parcelasRestantes:  document.getElementById('imp-parcelas-restantes').value,
    dataProximaParcela: document.getElementById('imp-proxima-data').value,
  };

  try {
    const res = await fetch(`${API_URL}/compras-parceladas/importar-existente`, {
      method: 'POST',
      headers: controleHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao importar parcelamento');
    mostrarFeedbackEl(impFeedback, 'success', `Parcelamento importado! ${data.parcelasGeradas} parcelas programadas.`);
    e.target.reset();
    await carregarComprasParceladas();
  } catch (err) {
    mostrarFeedbackEl(impFeedback, 'error', err.message);
  } finally {
    btnImp.disabled = false;
    btnImp.textContent = 'Importar parcelamento';
  }
});

// ─── Pluggy: Importação bancária ──────────────────────────────────────────────────
function getSelectedPluggyItemIds() {
  return Array.from(pluggyItemsList.querySelectorAll('.pluggy-item-checkbox:checked'))
    .map((input) => input.value);
}

function fecharModalPluggy() {
  modalPluggy.classList.add('hidden');
  pluggyFeedback.classList.add('hidden');
  pluggyItemsList.innerHTML = '';
  pluggyItemsCount.textContent = '0 banco';
}

function renderPluggyItems() {
  pluggyItemsList.innerHTML = '';
  pluggyItemsCount.textContent = `${currentPluggyItems.length} ${currentPluggyItems.length === 1 ? 'banco' : 'bancos'}`;

  if (currentPluggyItems.length === 0) {
    pluggyItemsList.innerHTML = '<p class="pluggy-empty">Nenhum banco vinculado ainda.</p>';
    return;
  }

  currentPluggyItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'pluggy-item';
    row.innerHTML = `
      <div class="pluggy-item-main">
        <input type="checkbox" class="pluggy-item-checkbox" value="${escapeHtml(item.itemId)}" />
        <div class="pluggy-item-text">
          <span class="pluggy-item-title">${escapeHtml(item.connectorName || 'Banco conectado')}</span>
          <span class="pluggy-item-subtitle">Vinculado a ${escapeHtml(getMemberLabel(item.memberEmail))}</span>
        </div>
      </div>
      <div class="pluggy-item-actions">
        <button class="btn btn-outline btn-sm btn-remover-pluggy" data-item-id="${escapeHtml(item.itemId)}">Remover</button>
      </div>
    `;
    pluggyItemsList.appendChild(row);
  });

  pluggyItemsList.querySelectorAll('.btn-remover-pluggy').forEach((button) => {
    button.addEventListener('click', () => removerPluggyItem(button.dataset.itemId));
  });
}

async function carregarPluggyItems() {
  const res = await fetch(`${API_URL}/pluggy/items`, { headers: controleHeaders() });
  if (res.status === 401) {
    removeToken();
    mostrarTelaLogin();
    return;
  }
  if (!res.ok) throw new Error('Erro ao carregar bancos vinculados');
  currentPluggyItems = await res.json();
  renderPluggyItems();
}

async function sincronizarCartoesPluggy(showFeedback = true) {
  if (!currentControleId) return;
  try {
    const res = await fetch(`${API_URL}/pluggy/items`, { headers: controleHeaders() });
    if (res.status === 401) { removeToken(); mostrarTelaLogin(); return; }
    if (!res.ok) throw new Error('Erro ao carregar itens Pluggy');
    const itens = await res.json();

    if (!itens.length) {
      if (showFeedback) alert('Nenhum banco Pluggy vinculado para sincronizar cartões.');
      return;
    }

    let total = 0;
    for (const item of itens) {
      const syncRes = await fetch(`${API_URL}/pluggy/items/${encodeURIComponent(item.itemId)}/sync-cartoes`, {
        method: 'POST',
        headers: controleHeaders(),
      });
      const data = await safeReadResponseJson(syncRes);
      if (!syncRes.ok) throw new Error(data.error || 'Erro ao sincronizar cartões Pluggy');
      total += Number(data.cartoesSincronizados || 0);
    }

    await carregarCartoes();
    if (showFeedback) alert(`Sincronização concluída. ${total} cartão(ões) Pluggy atualizados.`);
  } catch (err) {
    if (showFeedback) alert(err.message);
    else console.warn('Falha na sincronização silenciosa dos cartões Pluggy:', err.message);
  }
}

async function abrirModalPluggy() {
  pluggyFeedback.classList.add('hidden');

  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 30);
  pluggyDataFim.value = hoje.toISOString().split('T')[0];
  pluggyDataInicio.value = inicio.toISOString().split('T')[0];

  await carregarPluggyItems();
  modalPluggy.classList.remove('hidden');
}

async function removerPluggyItem(itemId) {
  if (!confirm('Remover este banco vinculado?')) return;

  try {
    const res = await fetch(`${API_URL}/pluggy/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: controleHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao remover banco');

    await carregarPluggyItems();
  } catch (err) {
    mostrarFeedbackEl(pluggyFeedback, 'error', err.message);
  }
}

async function conectarBancoPluggy() {
  const memberEmail = pluggyResponsavel.value;
  if (!memberEmail) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'Selecione o membro que será vinculado ao banco.');
    return;
  }

  btnPluggyConectar.disabled = true;
  btnPluggyConectar.textContent = 'Conectando...';
  pluggyFeedback.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/pluggy/connect-token`, {
      method: 'POST',
      headers: controleHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao obter token de conexão');

    const PluggyConnectCtor = window.PluggyConnect;
    if (!PluggyConnectCtor) {
      throw new Error('PluggyConnect nao carregou. Recarregue a pagina e tente novamente.');
    }

    const pluggyConnect = new PluggyConnectCtor({
      connectToken: data.connectToken,
      includeSandbox: true,
      onSuccess: async (payload) => {
        const resolvedItemId = payload?.item?.id || payload?.itemId || payload?.id || null;
        if (!resolvedItemId) {
          mostrarFeedbackEl(pluggyFeedback, 'error', 'Nao foi possivel identificar a conta conectada.');
          return;
        }

        try {
          const saveRes = await fetch(`${API_URL}/pluggy/items`, {
            method: 'POST',
            headers: controleHeaders(),
            body: JSON.stringify({ itemId: resolvedItemId, memberEmail }),
          });
          const saveData = await saveRes.json();
          if (!saveRes.ok) throw new Error(saveData.error || 'Erro ao vincular banco ao controle');

          await carregarPluggyItems();
          await carregarCartoes();
          mostrarFeedbackEl(pluggyFeedback, 'success', `${saveData.connectorName} vinculado a ${getMemberLabel(memberEmail)}. ${saveData.cartoesSincronizados || 0} cartão(ões) sincronizados.`);
        } catch (err) {
          mostrarFeedbackEl(pluggyFeedback, 'error', err.message);
        }
      },
      onError: (err) => {
        console.error('Pluggy widget error:', err);
        mostrarFeedbackEl(pluggyFeedback, 'error', 'Erro ao conectar ao banco. Tente novamente.');
      },
    });

    pluggyConnect.init();
  } catch (err) {
    mostrarFeedbackEl(pluggyFeedback, 'error', err.message);
  } finally {
    btnPluggyConectar.disabled = false;
    btnPluggyConectar.textContent = '+ Conectar banco';
  }
}

btnPluggyCancelar.addEventListener('click', fecharModalPluggy);
modalPluggy.querySelector('.modal-overlay').addEventListener('click', fecharModalPluggy);
btnPluggyConectar.addEventListener('click', conectarBancoPluggy);
btnSyncCartoesPluggy?.addEventListener('click', async () => {
  btnSyncCartoesPluggy.disabled = true;
  const original = btnSyncCartoesPluggy.textContent;
  btnSyncCartoesPluggy.textContent = 'Sincronizando...';
  await sincronizarCartoesPluggy(true);
  btnSyncCartoesPluggy.disabled = false;
  btnSyncCartoesPluggy.textContent = original;
});

btnImportarBanco.addEventListener('click', async () => {
  try {
    btnImportarBanco.disabled = true;
    btnImportarBanco.textContent = 'Carregando...';
    await abrirModalPluggy();
  } catch (err) {
    alert(err.message);
  } finally {
    btnImportarBanco.disabled = false;
    btnImportarBanco.textContent = '🏦 Importar do banco';
  }
});

btnPluggyConfirmar.addEventListener('click', async () => {
  const dataInicio  = pluggyDataInicio.value;
  const dataFim     = pluggyDataFim.value;
  const itemIds = getSelectedPluggyItemIds();

  if (!dataInicio || !dataFim) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'Preencha as datas.');
    return;
  }
  if (new Date(dataInicio) > new Date(dataFim)) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'A data de início deve ser anterior à data de fim.');
    return;
  }
  if (itemIds.length === 0) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'Selecione ao menos um banco para importar.');
    return;
  }

  btnPluggyConfirmar.disabled = true;
  btnPluggyConfirmar.textContent = 'Importando...';
  pluggyFeedback.classList.add('hidden');

  try {
    const res  = await fetch(`${API_URL}/pluggy/import`, {
      method: 'POST',
      headers: controleHeaders(),
      body: JSON.stringify({ itemIds, dataInicio, dataFim }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao importar');

    fecharModalPluggy();
    await carregarGastos();
    mostrarFeedback('success',
      data.imported > 0
        ? `${data.imported} transações importadas com sucesso!`
        : data.message || 'Nenhuma transação encontrada no período.'
    );
  } catch (err) {
    mostrarFeedbackEl(pluggyFeedback, 'error', err.message);
  } finally {
    btnPluggyConfirmar.disabled = false;
    btnPluggyConfirmar.textContent = 'Importar';
  }
});
