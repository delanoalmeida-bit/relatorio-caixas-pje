import { CONFIG } from '../config.js';
import { sanitizarProcessoLGPD } from './sanitizacao_lgpd.js';

/** Sessão ausente/expirada: não adianta tentar de novo. */
export class ErroSessao extends Error {}

class ErroHttp extends Error {
  constructor(status, caminho) {
    super(`HTTP ${status} em ${caminho}`);
    this.status = status;
  }
}

const esperaPadrao = ms => new Promise(r => setTimeout(r, ms));

export function lerCookie(textoCookies, nome) {
  for (const parte of String(textoCookies || '').split(';')) {
    const c = parte.trim();
    if (c.startsWith(nome + '=')) return decodeURIComponent(c.substring(nome.length + 1));
  }
  return null;
}

function corpoListagem(pagina, tamanho) {
  return {
    pagina, tamanhoPagina: tamanho,
    subCaixa: null, tipoAtividade: null, processos: null,
    nomeConclusoMagistrado: null, usuarioResponsavel: null,
    faseProcessualString: null, numeroProcesso: null,
    juizoDigital: false, filtroImpedimento: false,
    ordenacaoColuna: null, condicaoNegativaNosItensSelecionados: false,
    expedientesPreparados: false, ordenacaoCrescente: true,
    filtrarPorResponsavel: false
  };
}

/**
 * Coleta a caixa configurada (CONFIG.AGRUPAMENTO) usando a sessão do usuário no PJe.
 * Pool paralelo adaptativo + novas tentativas com espera crescente + repescagem final.
 *
 * @returns {Promise<{registros: object[], falhas: {cnj:string, idProcesso:number, motivo:string}[],
 *   totalNaCaixa: number, totalSelecionados: number, criterio: string, segundos: number}>}
 */
export async function coletarTriagem({
  origin, xsrf, fetchFn = (...a) => fetch(...a), config = CONFIG,
  aoProgresso = () => {}, esperar = esperaPadrao, agora = () => Date.now()
}) {
  const inicio = agora();
  const apiBase = `${origin}/pje-comum-api/api`;
  const controle = { limite: config.CONCORRENCIA };

  async function requisitar(caminho, {
    metodo = 'GET', corpo = null, tentativas = config.TENTATIVAS,
    tempoLimite = config.TEMPO_LIMITE_REQUISICAO_MS, aoTentar = null
  } = {}) {
    let ultimoErro = null;
    for (let t = 0; t <= tentativas; t++) {
      if (t > 0) await esperar(config.ESPERA_BASE_MS * 2 ** (t - 1));
      if (aoTentar) aoTentar(t + 1, ultimoErro);
      const abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = abort ? setTimeout(() => abort.abort(), tempoLimite) : null;
      try {
        const headers = { 'X-XSRF-TOKEN': xsrf };
        if (corpo) headers['Content-Type'] = 'application/json';
        const res = await fetchFn(apiBase + caminho, {
          method: metodo, credentials: 'include', headers,
          body: corpo ? JSON.stringify(corpo) : undefined,
          signal: abort ? abort.signal : undefined
        });
        if (res.status === 401 || res.status === 403) {
          throw new ErroSessao('Sessão do PJe ausente ou expirada. Faça login nesta aba e clique de novo.');
        }
        if (res.status === 429) {
          controle.limite = Math.max(config.CONCORRENCIA_MINIMA, Math.floor(controle.limite / 2));
          ultimoErro = new ErroHttp(429, caminho);
          continue;
        }
        if (res.status >= 500) { ultimoErro = new ErroHttp(res.status, caminho); continue; }
        if (!res.ok) throw new ErroHttp(res.status, caminho); // 4xx: não insiste
        return await res.json();
      } catch (e) {
        if (e instanceof ErroSessao || (e instanceof ErroHttp && e.status < 500 && e.status !== 429)) throw e;
        ultimoErro = e; // rede, tempo limite, JSON inválido
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw ultimoErro || new Error('falha desconhecida em ' + caminho);
  }

  // 1. Listagem (1ª página, depois as demais em paralelo)
  const lista = { paginasLidas: 0, qtdPaginas: 0, tentativa: 1, erro: null };
  const avisarLista = () => aoProgresso({ fase: 'listagem', feitos: 0, total: 0, ...lista });
  avisarLista();
  const caminhoLista = `/agrupamentotarefas/${config.AGRUPAMENTO}/processos`;
  const listar = async pagina => {
    const r = await requisitar(caminhoLista, {
      metodo: 'PATCH', corpo: corpoListagem(pagina, config.TAMANHO_PAGINA_LISTAGEM),
      tempoLimite: config.TEMPO_LIMITE_LISTAGEM_MS || config.TEMPO_LIMITE_REQUISICAO_MS,
      aoTentar: (n, erro) => {
        if (n > 1) { lista.tentativa = Math.max(lista.tentativa, n); lista.erro = String((erro && erro.message) || erro || ''); avisarLista(); }
      }
    });
    lista.paginasLidas++;
    avisarLista();
    return r;
  };
  const primeira = await listar(1);
  const paginas = [primeira];
  const qtdPaginas = primeira.qtdPaginas || 1;
  lista.qtdPaginas = qtdPaginas;
  avisarLista();
  if (qtdPaginas > 1) {
    const resto = await Promise.all(Array.from({ length: qtdPaginas - 1 }, (_, i) => listar(i + 2)));
    paginas.push(...resto);
  }
  const todos = paginas.flatMap(p => p.resultado || []);

  const caixa = `Caixa ${config.NOME_CAIXA || 'agrupamento ' + config.AGRUPAMENTO}`;
  let selecionados = todos;
  let criterio = `${caixa}, todos os processos`;
  if (config.SOMENTE_SEM_RESPONSAVEL) {
    const sem = todos.filter(p => !p.idUsuarioResponsavel && !p.idUsuarioResponsavelSecretaria);
    if (sem.length > 0) {
      selecionados = sem;
      criterio = `${caixa}, processos sem responsável`;
    } else {
      criterio = `${caixa}, todos os processos (nenhum estava sem responsável)`;
    }
  }

  // 2. Detalhes de cada processo (3 GETs em paralelo por processo)
  async function detalhar(item) {
    const id = item.id;
    const [processo, partes, assuntos] = await Promise.all([
      requisitar(`/processos/id/${id}`),
      requisitar(`/processos/id/${id}/partes`),
      requisitar(`/processos/id/${id}/assuntos`)
    ]);
    // Prioridade legal: só quando a listagem indica uma; falha aqui não derruba o processo.
    let prioridades = null;
    if (config.BUSCAR_PRIORIDADES && item.prioridadeProcessual) {
      try { prioridades = await requisitar(`/processos/id/${id}/prioridades/descricao`, { tentativas: 1 }); }
      catch (e) { if (e instanceof ErroSessao) throw e; prioridades = null; }
    }
    return sanitizarProcessoLGPD({
      cnj: item.numeroProcesso, idProcesso: id, listagem: item, processo, partes, assuntos, prioridades
    });
  }

  const total = selecionados.length;
  const registros = new Array(total);
  const pendentes = [];
  let feitos = 0;
  let proximo = 0;

  async function trabalhador(n) {
    while (proximo < total) {
      if (n >= controle.limite) return; // pool encolheu após 429
      const i = proximo++;
      try {
        registros[i] = await detalhar(selecionados[i]);
      } catch (e) {
        if (e instanceof ErroSessao) throw e;
        pendentes.push(i);
      }
      feitos++;
      aoProgresso({ fase: 'detalhes', feitos, total, falhas: pendentes.length, segundos: (agora() - inicio) / 1000 });
    }
  }
  await Promise.all(Array.from({ length: Math.min(config.CONCORRENCIA, total) }, (_, n) => trabalhador(n)));

  // 3. Repescagem: uma passada serial, mais calma, só nos que falharam
  const falhas = [];
  for (let k = 0; k < pendentes.length; k++) {
    const i = pendentes[k];
    aoProgresso({ fase: 'repescagem', feitos: k, total: pendentes.length });
    try {
      await esperar(config.ESPERA_BASE_MS);
      registros[i] = await detalhar(selecionados[i]);
    } catch (e) {
      if (e instanceof ErroSessao) throw e;
      falhas.push({ cnj: selecionados[i].numeroProcesso, idProcesso: selecionados[i].id,
        motivo: String((e && e.message) || e) });
    }
  }

  return {
    registros: registros.filter(Boolean),
    falhas,
    totalNaCaixa: todos.length,
    totalSelecionados: total,
    criterio,
    segundos: (agora() - inicio) / 1000
  };
}
