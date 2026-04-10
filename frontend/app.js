/* global API_URL */

// ─── Configuração ─────────────────────────────────────────────────────────────
// Em produção substitua pela URL do seu backend no Render (ou onde hospedar).
const API_URL = 'https://controle-gastos-rr.onrender.com';

// ─── Estado ───────────────────────────────────────────────────────────────────
let gastos = [];
let deleteTargetId = null;

// ─── Elementos ────────────────────────────────────────────────────────────────
const loginScreen    = document.getElementById('login-screen');
const app            = document.getElementById('app');
const btnLogin       = document.getElementById('btn-login');
const btnLogout      = document.getElementById('btn-logout');
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

// ─── Inicialização ────────────────────────────────────────────────────────────
(async function init() {
  // Verifica erros retornados na URL (ex: ?error=acesso_negado)
  const params = new URLSearchParams(window.location.search);
  const erro = params.get('error');
  if (erro) {
    const mensagens = {
      acesso_negado:    'Acesso negado. Seu e-mail não está autorizado.',
      falha_autenticacao: 'Falha na autenticação. Tente novamente.',
      sem_codigo:       'Código de autenticação ausente. Tente novamente.',
    };
    mostrarErroLogin(mensagens[erro] || 'Erro desconhecido.');
    history.replaceState({}, '', window.location.pathname);
  }

  // Define href do botão de login
  btnLogin.href = `${API_URL}/auth/google`;

  // Verifica se já está autenticado
  try {
    const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
    if (res.ok) {
      const { user } = await res.json();
      entrar(user);
    } else {
      mostrarLogin();
    }
  } catch {
    mostrarLogin();
  }
})();

// ─── Autenticação ─────────────────────────────────────────────────────────────
function entrar(user) {
  userNameEl.textContent = user.name;
  userPictureEl.src = user.picture || '';
  userPictureEl.alt = user.name;
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');

  // Pré-preenche data de hoje
  document.getElementById('input-data').valueAsDate = new Date();

  carregarGastos();
}

function mostrarLogin() {
  app.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

function mostrarErroLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  mostrarLogin();
}

btnLogout.addEventListener('click', async () => {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  mostrarLogin();
});

// ─── Dados ────────────────────────────────────────────────────────────────────
async function carregarGastos() {
  loadingEl.classList.remove('hidden');
  emptyStateEl.classList.add('hidden');
  tbodyGastos.innerHTML = '';

  try {
    const res = await fetch(`${API_URL}/gastos`, { credentials: 'include' });
    if (res.status === 401) { mostrarLogin(); return; }
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

// ─── Formulário ───────────────────────────────────────────────────────────────
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
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (res.status === 401) { mostrarLogin(); return; }

    const data = await res.json();
    if (!res.ok) {
      mostrarFeedback('error', data.error || 'Erro ao salvar lançamento.');
      return;
    }

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
function esconderFeedback() {
  formFeedback.classList.add('hidden');
}

// ─── Tabela ───────────────────────────────────────────────────────────────────
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
      <td>${formatarData(g.data)}</td>
      <td><span class="tag tag-${g.tipo.toLowerCase()}">${g.tipo}</span></td>
      <td>${g.categoria}</td>
      <td>${g.descricao || '—'}</td>
      <td><span class="tag tag-${g.responsavel.toLowerCase()}">${g.responsavel}</span></td>
      <td class="text-right ${g.tipo === 'Gasto' ? 'valor-gasto' : 'valor-investimento'}">
        ${formatarValor(g.valor)}
      </td>
      <td class="text-center">
        <button class="btn-delete" data-id="${g.id}" title="Remover">🗑</button>
      </td>
    `;
    tbodyGastos.appendChild(tr);
  });

  // Delegação de clique para excluir
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

  document.getElementById('total-gastos').textContent       = formatarValor(totalGastos);
  document.getElementById('total-investimentos').textContent= formatarValor(totalInvestimentos);
  document.getElementById('total-lancamentos').textContent  = lista.length;
}

// ─── Exclusão ─────────────────────────────────────────────────────────────────
function abrirModalDelete(id) {
  deleteTargetId = id;
  modalConfirm.classList.remove('hidden');
}

function fecharModal() {
  deleteTargetId = null;
  modalConfirm.classList.add('hidden');
}

modalCancel.addEventListener('click', fecharModal);
document.querySelector('.modal-overlay').addEventListener('click', fecharModal);

modalConfirmBtn.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  modalConfirmBtn.disabled = true;
  modalConfirmBtn.textContent = 'Removendo...';

  try {
    const res = await fetch(`${API_URL}/gastos/${deleteTargetId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) { mostrarLogin(); return; }
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Erro ao remover lançamento.');
      return;
    }
    fecharModal();
    await carregarGastos();
  } catch {
    alert('Erro de conexão com o servidor.');
  } finally {
    modalConfirmBtn.disabled = false;
    modalConfirmBtn.textContent = 'Remover';
  }
});

// ─── Formatação ───────────────────────────────────────────────────────────────
function formatarValor(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  });
}

function formatarData(iso) {
  if (!iso) return '—';
  // Trata tanto "YYYY-MM-DD" quanto ISO completo
  const [ano, mes, dia] = iso.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
}
