import test from 'node:test';
import assert from 'node:assert/strict';
import { coletarTriagem, ErroSessao, lerCookie } from '../src/coleta/coletor.js';
import { CONFIG } from '../src/config.js';

const CFG = Object.assign({}, CONFIG, { ESPERA_BASE_MS: 1, TAMANHO_PAGINA_LISTAGEM: 2, SOMENTE_SEM_RESPONSAVEL: true });
const semEspera = () => Promise.resolve();

const resposta = (status, corpo) => ({ status, ok: status >= 200 && status < 300, json: async () => corpo });

/** PJe falso: 3 processos em 2 páginas; o 3º tem responsável. `regras` altera respostas. */
function pjeFalso(regras = {}) {
  const itens = [
    { id: 1, numeroProcesso: '1000001-00.2026.5.02.0001', idUsuarioResponsavelSecretaria: null },
    { id: 2, numeroProcesso: '1000002-00.2026.5.02.0001', idUsuarioResponsavelSecretaria: null },
    { id: 3, numeroProcesso: '1000003-00.2026.5.02.0001', idUsuarioResponsavelSecretaria: 99 }
  ];
  const chamadas = [];
  const fetchFn = async (url, opts) => {
    const caminho = url.replace('https://pje.x.jus.br/pje-comum-api/api', '');
    chamadas.push(caminho);
    if (regras[caminho]) {
      const r = regras[caminho].shift();
      if (r instanceof Error) throw r;
      if (r) return r;
    }
    if (caminho.startsWith('/agrupamentotarefas/')) {
      const { pagina } = JSON.parse(opts.body);
      assert.equal(opts.headers['X-XSRF-TOKEN'], 'tok');
      return resposta(200, { qtdPaginas: 2, resultado: itens.slice((pagina - 1) * 2, pagina * 2) });
    }
    const m = caminho.match(/\/processos\/id\/(\d+)(\/\w+)?/);
    if (m[2] === '/partes') {
      return resposta(200, { ATIVO: [{ nome: 'FULANO', tipoPessoa: 'F', cpf: '123.456.789-00', emails: ['a@b.c'] }] });
    }
    if (m[2] === '/assuntos') return resposta(200, []);
    return resposta(200, { id: Number(m[1]), relator: { nome: 'REL', cpf: '000.000.000-00', email: 'r@x' } });
  };
  return { fetchFn, chamadas };
}

const base = extra => Object.assign({ origin: 'https://pje.x.jus.br', xsrf: 'tok', config: CFG, esperar: semEspera }, extra);

test('lê o cookie Xsrf-Token', () => {
  assert.equal(lerCookie('a=1; Xsrf-Token=abc%3D; b=2', 'Xsrf-Token'), 'abc=');
  assert.equal(lerCookie('a=1', 'Xsrf-Token'), null);
});

test('pagina a listagem, filtra sem responsável e sanitiza', async () => {
  const { fetchFn } = pjeFalso();
  const r = await coletarTriagem(base({ fetchFn }));
  assert.equal(r.totalNaCaixa, 3);
  assert.equal(r.totalSelecionados, 2);
  assert.equal(r.registros.length, 2);
  assert.equal(r.falhas.length, 0);
  assert.match(r.criterio, /sem responsável/);
  const texto = JSON.stringify(r.registros);
  assert.doesNotMatch(texto, /123\.456|000\.000|@/, 'CPF/e-mail não pode sobrar');
  assert.equal(r.registros[0].processo.relator.nome, 'REL');
});

test('429 e 500 são tentados de novo e o pool encolhe', async () => {
  const { fetchFn } = pjeFalso({
    '/processos/id/1/partes': [resposta(429, {}), resposta(500, {})],
    '/processos/id/2': [new TypeError('Failed to fetch')]
  });
  const r = await coletarTriagem(base({ fetchFn }));
  assert.equal(r.registros.length, 2);
  assert.equal(r.falhas.length, 0);
});

test('falha persistente vai para "não lidos" após a repescagem', async () => {
  const sempre500 = Array.from({ length: 20 }, () => resposta(500, {}));
  const { fetchFn } = pjeFalso({ '/processos/id/2/assuntos': sempre500 });
  const r = await coletarTriagem(base({ fetchFn }));
  assert.equal(r.registros.length, 1);
  assert.equal(r.falhas.length, 1);
  assert.equal(r.falhas[0].cnj, '1000002-00.2026.5.02.0001');
  assert.match(r.falhas[0].motivo, /HTTP 500/);
});

test('sessão expirada (401/403) para tudo com mensagem clara', async () => {
  const { fetchFn } = pjeFalso({ [`/agrupamentotarefas/${CONFIG.AGRUPAMENTO}/processos`]: [resposta(403, {})] });
  await assert.rejects(coletarTriagem(base({ fetchFn })), ErroSessao);
});

test('nenhum sem responsável: entra a caixa inteira', async () => {
  const { fetchFn } = pjeFalso();
  const comTodos = async (url, opts) => {
    const res = await fetchFn(url, opts);
    if (!url.includes('/agrupamentotarefas/')) return res;
    const corpo = await res.json();
    corpo.resultado = corpo.resultado.map(i => Object.assign({}, i, { idUsuarioResponsavelSecretaria: 5 }));
    return resposta(200, corpo);
  };
  const r = await coletarTriagem(base({ fetchFn: comTodos }));
  assert.equal(r.totalSelecionados, 3);
  assert.match(r.criterio, /todos/);
});

test('lista que falha é tentada de novo e o progresso informa a tentativa', async () => {
  const { fetchFn } = pjeFalso({ [`/agrupamentotarefas/${CONFIG.AGRUPAMENTO}/processos`]: [resposta(502, {})] });
  const eventos = [];
  const r = await coletarTriagem(base({ fetchFn, aoProgresso: p => eventos.push(p) }));
  assert.equal(r.totalNaCaixa, 3);
  const lista = eventos.filter(e => e.fase === 'listagem');
  assert.ok(lista.some(e => e.tentativa === 2 && /502/.test(e.erro)), 'deveria avisar a 2ª tentativa');
  assert.ok(lista.some(e => e.qtdPaginas === 2 && e.paginasLidas === 2), 'deveria contar as páginas lidas');
});
