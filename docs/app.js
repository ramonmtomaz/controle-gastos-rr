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
let pluggyItemId     = null;
let currentControleId   = null;
let currentControleNome = null;
let currentUser         = null; // { email, name, picture }

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
const modalConfirm   = document.getElementById('modal-confirm');
const modalCancel    = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

// ─── Elementos: Pluggy ───────────────────────────────────────────────────────────
const btnImportarBanco  = document.getElementById('btn-importar-banco');
const modalPluggy       = document.getElementById('modal-pluggy');
const pluggyDataInicio  = document.getElementById('pluggy-data-inicio');
const pluggyDataFim     = document.getElementById('pluggy-data-fim');
const pluggyResponsavel = document.getElementById('pluggy-responsavel');
const pluggyFeedback    = document.getElementById('pluggy-feedback');
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
    lobbyUserName.textContent   = user.name;
    lobbyUserPicture.src        = user.picture || '';
    lobbyUserPicture.alt        = user.name;
    // preenche tb elementos do dashboard para não precisar re-buscar depois
    userNameEl.textContent      = user.name;
    userPictureEl.src           = user.picture || '';
    userPictureEl.alt           = user.name;
  }
  loginScreen.classList.add('hidden');
  appScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  carregarControles();
}

function voltarLobby() {
  currentControleId   = null;
  currentControleNome = null;
  appScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  carregarControles();
}

// ─── Logout ───────────────────────────────────────────────────────────────────
btnLobbyLogout.addEventListener('click', async () => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
  removeToken();
  mostrarTelaLogin();
});

btnLogout.addEventListener('click', async () => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
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

// ─── Dashboard: abrir controle ────────────────────────────────────────────────
function abrirControle(id, nome) {
  currentControleId   = id;
  currentControleNome = nome;
  controleNomeEl.textContent = nome;
  lobbyScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  document.getElementById('input-data').valueAsDate = new Date();
  carregarGastos();
}

btnLobby.addEventListener('click', voltarLobby);

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
    renderizarTabela();
    atualizarResumo();
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

  const payload = {
    data:        document.getElementById('input-data').value,
    valor:       document.getElementById('input-valor').value,
    tipo:        document.getElementById('input-tipo').value,
    categoria:   document.getElementById('input-categoria').value,
    descricao:   document.getElementById('input-descricao').value,
    responsavel: document.getElementById('input-responsavel').value,
  };

  try {
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
    await carregarGastos();
  } catch {
    mostrarFeedback('error', 'Erro de conexão com o servidor.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Adicionar';
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
  return gastos.filter((g) => {
    if (tipo && g.tipo !== tipo) return false;
    if (resp && g.responsavel !== resp) return false;
    if (busca) {
      return (
        g.descricao.toLowerCase().includes(busca) ||
        g.categoria.toLowerCase().includes(busca) ||
        g.responsavel.toLowerCase().includes(busca)
      );
    }
    return true;
  });
}

[filterSearch, filterTipo, filterResp].forEach((el) =>
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Data">${formatarData(g.data)}</td>
      <td data-label="Tipo"><span class="tag tag-${g.tipo.toLowerCase()}">${escapeHtml(g.tipo)}</span></td>
      <td data-label="Categoria">${escapeHtml(g.categoria)}</td>
      <td data-label="Descrição">${escapeHtml(g.descricao) || '—'}</td>
      <td data-label="Responsável"><span class="tag tag-${g.responsavel.toLowerCase()}">${escapeHtml(g.responsavel)}</span></td>
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
}

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

function formatarValor(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
}

// ─── Pluggy: Importação bancária ──────────────────────────────────────────────────
function fecharModalPluggy() {
  modalPluggy.classList.add('hidden');
  pluggyItemId = null;
  pluggyFeedback.classList.add('hidden');
  pluggyResponsavel.value = '';
}

btnPluggyCancelar.addEventListener('click', fecharModalPluggy);
modalPluggy.querySelector('.modal-overlay').addEventListener('click', fecharModalPluggy);

btnImportarBanco.addEventListener('click', async () => {
  btnImportarBanco.disabled = true;
  btnImportarBanco.textContent = 'Conectando...';
  try {
    const res  = await fetch(`${API_URL}/pluggy/connect-token`, {
      method: 'POST',
      headers: controleHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao obter token de conexão');

    // Abre o widget do Pluggy
    const pluggyConnect = new PluggyConnect({
      connectToken: data.connectToken,
      includeSandbox: true,
      onSuccess: ({ item }) => {
        pluggyItemId = item.id;
        // Preenche datas padrão: últimos 30 dias
        const hoje   = new Date();
        const inicio = new Date();
        inicio.setDate(inicio.getDate() - 30);
        pluggyDataFim.value   = hoje.toISOString().split('T')[0];
        pluggyDataInicio.value = inicio.toISOString().split('T')[0];
        modalPluggy.classList.remove('hidden');
      },
      onError: (err) => {
        console.error('Pluggy widget error:', err);
        alert('Erro ao conectar ao banco. Tente novamente.');
      },
    });
    pluggyConnect.init();
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
  const responsavel = pluggyResponsavel.value;

  if (!dataInicio || !dataFim) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'Preencha as datas.');
    return;
  }
  if (!responsavel) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'Selecione o responsável.');
    return;
  }
  if (new Date(dataInicio) > new Date(dataFim)) {
    mostrarFeedbackEl(pluggyFeedback, 'error', 'A data de início deve ser anterior à data de fim.');
    return;
  }

  btnPluggyConfirmar.disabled = true;
  btnPluggyConfirmar.textContent = 'Importando...';
  pluggyFeedback.classList.add('hidden');

  try {
    const res  = await fetch(`${API_URL}/pluggy/import`, {
      method: 'POST',
      headers: controleHeaders(),
      body: JSON.stringify({ itemId: pluggyItemId, dataInicio, dataFim, responsavel }),
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
