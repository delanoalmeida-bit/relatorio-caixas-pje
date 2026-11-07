import { agruparPorReclamada, identificarLotes, trabalhadoresDoProcesso } from './reclamadas_lotes.js';
import { siglaTribunal } from './nome_arquivo.js';

/*
 * 1º grau: transforma o lote classificado (motor/hub_vt.js) nas seções do PDF.
 * Tudo sai como texto pronto, no formato "Rótulo: valor". Especificação:
 * documentacao/CONTEUDO_DO_RELATORIO_VT.md
 */

export const SEGREDO = 'SEGREDO DE JUSTIÇA';
export const SEM_RESPONSAVEL = 'Sem responsável';
const ORDEM_FASES = ['Conhecimento', 'Liquidação', 'Execução'];
const MAX_NOMES_POLO = 6;

const dois = n => String(n).padStart(2, '0');
const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
const simNao = v => (v === true ? 'sim' : v === false ? 'não' : 'não informado');

export function formatarData(iso, comHora = false) {
  if (!iso) return 'não informado';
  const d = new Date(iso);
  if (isNaN(d)) return 'não informado';
  const base = `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
  return comHora ? `${base} ${dois(d.getHours())}:${dois(d.getMinutes())}` : base;
}

export function formatarValor(v) {
  if (v === null || v === undefined || v === '' || isNaN(Number(v))) return 'não informado';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const textoDias = d => (d === null || d === undefined ? 'não informado' : d === 1 ? '1 dia' : `${d} dias`);

function ehSegredo(proc) {
  const r = proc.raw || {};
  return Boolean((r.listagem && r.listagem.segredoDeJustica) || (r.processo && r.processo.segredoDeJustica));
}

function listaNomes(proc, partes) {
  if (!partes || !partes.length) return 'não informado';
  if (ehSegredo(proc)) return SEGREDO;
  const nomes = partes.map(p => limpar(p.nome)).filter(Boolean);
  if (nomes.length <= MAX_NOMES_POLO) return nomes.join('; ');
  return nomes.slice(0, MAX_NOMES_POLO).join('; ') + ` e mais ${nomes.length - MAX_NOMES_POLO}`;
}

function resumoPartes(proc) {
  if (ehSegredo(proc)) return SEGREDO;
  const p = proc.partes || {};
  const resumo = lista => !lista || !lista.length ? 'não informado'
    : limpar(lista[0].nome) + (lista.length > 1 ? ` e mais ${lista.length - 1}` : '');
  return `${resumo(p.ativos)} x ${resumo(p.passivos)}`;
}

function textoPolo(polo) {
  const p = String(polo || '').toLowerCase();
  return p === 'ativo' ? 'polo ativo' : p === 'passivo' ? 'polo passivo' : p ? `polo ${p}` : 'polo não identificado';
}

function assuntosDoProcesso(proc) {
  const brutos = (proc.raw && proc.raw.assuntos) || [];
  const itens = brutos.map(it => {
    const a = (it && it.assunto) || it || {};
    return {
      texto: limpar(a.assuntoResumido || a.descricao || `Assunto ${a.codigo || ''}`),
      principal: Boolean(it.principal)
    };
  });
  itens.sort((a, b) => Number(b.principal) - Number(a.principal));
  return itens;
}

const responsavel = proc => proc.responsavel || SEM_RESPONSAVEL;

/** Linha curta das listagens. */
function linhaProcesso(proc) {
  return {
    ordem: proc._ordem,
    cnj: proc.cnj,
    classe: proc.classe.sigla,
    fase: proc.fase,
    entrada: `${formatarData(proc.entrada)} (${textoDias(proc.diasNaTarefa)})`,
    responsavel: responsavel(proc),
    partes: resumoPartes(proc),
    reclamante: ehSegredo(proc) ? SEGREDO
      : (trabalhadoresDoProcesso(proc).map(p => limpar(p.nome))[0] || 'não identificado')
  };
}

function alertasDoProcesso(proc, lotesDoProcesso) {
  const a = [];
  if (proc.temPrioridade) a.push('Prioridade legal' + (proc.prioridades.length ? ` (${proc.prioridades.join('; ')})` : ''));
  if (proc.prazoExpirado) a.push('Prazo expirado no PJe');
  if (proc.sumarissimo) a.push('Rito sumaríssimo');
  for (const e of proc.entesPublicos) a.push(`Ente público no ${textoPolo(e.polo)}`);
  if (proc.pjs.temRecuperacaoJudicial) a.push('Empresa em recuperação judicial');
  if (proc.pjs.temMassaFalida) a.push('Massa falida');
  if (proc.sindicatos && proc.sindicatos.temSindicato) {
    for (const s of proc.sindicatos.sindicatos) a.push(`Sindicato no ${textoPolo(s.polo)}`);
  }
  if (proc.qtdeAutores > 1) a.push(`${proc.qtdeAutores} partes no polo ativo`);
  if (proc.temporalidade && proc.temporalidade.ehProcessoFisicoMigrado) a.push('Processo físico migrado');
  if (proc.temComentario) a.push('Há comentário no PJe');
  for (const n of lotesDoProcesso) a.push(`Lote nº ${n}`);
  if (ehSegredo(proc)) a.push('Segredo de justiça');
  return a;
}

function montarFicha(proc, lotesDoProcesso) {
  const processo = (proc.raw && proc.raw.processo) || {};
  const p = proc.partes || {};
  const terceiros = (p.terceiros || []).filter(t => limpar(t.nome));
  const assuntos = assuntosDoProcesso(proc);
  const alertas = alertasDoProcesso(proc, lotesDoProcesso);

  const linhas = [
    [['CNJ', proc.cnj], ['Fase', proc.fase]],
    [['Classe', `${proc.classe.sigla}${proc.classe.nome ? ' - ' + proc.classe.nome : ''}`]],
    [['Tarefa', proc.tarefa], ['Na caixa desde', `${formatarData(proc.entrada, true)} (${textoDias(proc.diasNaTarefa)})`]],
    [['Responsável', responsavel(proc)], ['Concluso a', proc.conclusoA || 'não informado']],
    [['Autuação', formatarData(processo.autuadoEm || processo.dataInicio)], ['Valor da causa', formatarValor(processo.valorDaCausa)],
      ['Justiça gratuita', simNao(processo.justicaGratuita)]],
    [['Polo ativo', listaNomes(proc, p.ativos)]],
    [['Polo passivo', listaNomes(proc, p.passivos)]]
  ];
  if (terceiros.length) linhas.push([['Outros participantes', listaNomes(proc, terceiros)]]);
  linhas.push(
    [['Assuntos', assuntos.length ? assuntos.map(a => a.texto + (a.principal ? ' (principal)' : '')).join('; ') : 'não informado']],
    [['Alertas', alertas.length ? alertas.join('; ') : 'nenhum']]
  );
  return { ordem: proc._ordem, cnj: proc.cnj, linhas };
}

/** Contagem simples → [{rotulo, qtd, maisAntigo}] em ordem decrescente (ou na ordem dada). */
function contar(processos, chave, ordemFixa = null) {
  const mapa = new Map();
  for (const p of processos) {
    const k = chave(p);
    if (!mapa.has(k)) mapa.set(k, { rotulo: k, qtd: 0, maisAntigo: null, maxDias: -1 });
    const r = mapa.get(k);
    r.qtd++;
    if ((p.diasNaTarefa ?? -1) > r.maxDias) { r.maxDias = p.diasNaTarefa ?? -1; r.maisAntigo = p.entrada; }
  }
  const lista = Array.from(mapa.values());
  if (ordemFixa) {
    const pos = k => { const i = ordemFixa.indexOf(k); return i < 0 ? ordemFixa.length : i; };
    lista.sort((a, b) => pos(a.rotulo) - pos(b.rotulo) || b.qtd - a.qtd);
  } else {
    lista.sort((a, b) => b.qtd - a.qtd || String(a.rotulo).localeCompare(String(b.rotulo), 'pt-BR'));
  }
  return lista.map(r => ({ rotulo: r.rotulo, qtd: r.qtd, maisAntigo: formatarData(r.maisAntigo), maxDias: r.maxDias < 0 ? null : r.maxDias }));
}

function faixasDeTempo(processos, limites) {
  const faixas = [];
  let anterior = -1;
  for (const lim of limites) {
    faixas.push({ rotulo: anterior < 0 ? `até ${lim} dias` : `${anterior + 1} a ${lim} dias`, min: anterior + 1, max: lim });
    anterior = lim;
  }
  faixas.push({ rotulo: `mais de ${anterior} dias`, min: anterior + 1, max: Infinity });
  const semData = processos.filter(p => p.diasNaTarefa === null).length;
  const linhas = faixas.map(f => ({
    rotulo: f.rotulo,
    qtd: processos.filter(p => p.diasNaTarefa !== null && p.diasNaTarefa >= f.min && p.diasNaTarefa <= f.max).length
  })).reverse(); // mais antigos primeiro
  if (semData) linhas.push({ rotulo: 'sem data de entrada', qtd: semData });
  return linhas;
}

/**
 * @param {object} args
 * @param {object[]} args.processos  saída de processarLoteVT()
 * @param {{cnj:string, motivo:string}[]} [args.naoLidos]
 * @param {{hostname:string, totalNaCaixa:number, criterio:string, nomeCaixa:string, geradoEm:Date, versao:string, faixasDias?:number[]}} args.meta
 */
export function montarRelatorioVT({ processos, naoLidos = [], meta }) {
  const ordenados = processos.slice().sort((a, b) => {
    const da = new Date(a.entrada || 0).getTime() || 0;
    const db = new Date(b.entrada || 0).getTime() || 0;
    return da - db || String(a.cnj).localeCompare(String(b.cnj));
  });
  ordenados.forEach((p, i) => { p._ordem = i + 1; });
  const porOrdem = lista => lista.slice().sort((a, b) => a._ordem - b._ordem);

  // Lotes: mesma reclamada + mesma OAB do lado do trabalhador + MESMA FASE
  // (despacho em bloco só faz sentido dentro da mesma fase). Segredo de justiça fica de fora.
  const publicos = ordenados.filter(p => !ehSegredo(p));
  const fases = Array.from(new Set(publicos.map(p => p.fase)))
    .sort((a, b) => (ORDEM_FASES.indexOf(a) + 1 || 9) - (ORDEM_FASES.indexOf(b) + 1 || 9));
  const lotes = [];
  for (const fase of fases) {
    for (const l of identificarLotes(publicos.filter(p => p.fase === fase), a => a.nome)) {
      lotes.push(Object.assign(l, { fase, numero: lotes.length + 1 }));
    }
  }
  const lotesPorCnj = new Map();
  for (const l of lotes) for (const p of l.processos) {
    if (!lotesPorCnj.has(p.cnj)) lotesPorCnj.set(p.cnj, []);
    lotesPorCnj.get(p.cnj).push(l.numero);
  }

  const descricoesOJ = ordenados.map(p => limpar((p.raw.listagem || {}).descricaoOrgaoJulgador)).filter(Boolean);
  const ojs = Array.from(new Set(descricoesOJ));
  const tribunal = siglaTribunal(meta.hostname).replace(/^TRT(\d+)$/, 'TRT-$1');

  const responsaveis = contar(ordenados, responsavel);
  // "Sem responsável" vai para o fim do quadro, para não se confundir com um servidor.
  responsaveis.sort((a, b) => (a.rotulo === SEM_RESPONSAVEL) - (b.rotulo === SEM_RESPONSAVEL));

  const comPrioridade = ordenados.filter(p => p.temPrioridade);
  const comPrazo = ordenados.filter(p => p.prazoExpirado);
  const comEnte = ordenados.filter(p => p.entesPublicos.length);
  const comRjMf = ordenados.filter(p => p.pjs.temRecuperacaoJudicial || p.pjs.temMassaFalida);
  const comSindicato = ordenados.filter(p => p.sindicatos && p.sindicatos.temSindicato);

  return {
    capa: {
      tribunal,
      orgao: ojs.length ? ojs.join('; ') : 'não identificado',
      caixa: meta.nomeCaixa || 'não informada',
      geradoEm: formatarData(meta.geradoEm.toISOString(), true),
      criterio: meta.criterio || '',
      totalNaCaixa: meta.totalNaCaixa ?? ordenados.length + naoLidos.length,
      noRelatorio: ordenados.length,
      naoLidos: naoLidos.length,
      maisAntigo: ordenados.length ? `${formatarData(ordenados[0].entrada)} (${textoDias(ordenados[0].diasNaTarefa)})` : 'não informado',
      versao: meta.versao || ''
    },
    panorama: {
      porFase: contar(ordenados, p => p.fase, ORDEM_FASES),
      porTempo: faixasDeTempo(ordenados, meta.faixasDias || [30, 60, 90, 120, 180]),
      porResponsavel: responsaveis,
      porTarefa: contar(ordenados, p => p.tarefa),
      porClasse: contar(ordenados, p => `${p.classe.sigla}${p.classe.nome ? ' - ' + p.classe.nome : ''}`),
      indicadores: [
        ['Com prioridade legal', comPrioridade.length],
        ['Com prazo expirado no PJe', comPrazo.length],
        ['Com ente público', comEnte.length],
        ['Com recuperação judicial ou massa falida', comRjMf.length],
        ['Com sindicato', comSindicato.length],
        ['Sem responsável', ordenados.filter(p => !p.responsavel).length],
        ['Com comentário no PJe', ordenados.filter(p => p.temComentario).length],
        ['Em segredo de justiça', ordenados.filter(ehSegredo).length],
        ['Em lotes (mesma reclamada + mesmo advogado + mesma fase)', lotesPorCnj.size]
      ]
    },
    prioridades: comPrioridade.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Prioridade', p.prioridades.length ? p.prioridades.join('; ') : 'indicada pelo PJe (descrição não obtida)']
    })),
    prazoExpirado: comPrazo.map(linhaProcesso),
    porResponsavel: responsaveis.map(r => ({
      nome: r.rotulo,
      processos: ordenados.filter(p => responsavel(p) === r.rotulo).map(linhaProcesso)
    })),
    entesPublicos: comEnte.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Ente público', ehSegredo(p) ? SEGREDO : p.entesPublicos.map(e => `${e.nome} (${textoPolo(e.polo)})`).join('; ')]
    })),
    recuperacaoFalencia: comRjMf.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Situação', ehSegredo(p) ? SEGREDO : [
        ...p.pjs.recuperandas.map(n => `${limpar(n)} (recuperação judicial)`),
        ...p.pjs.falidas.map(n => `${limpar(n)} (massa falida)`)
      ].join('; ')]
    })),
    sindicatos: comSindicato.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Sindicato', p.sindicatos.sindicatos.map(s => `${ehSegredo(p) ? SEGREDO : limpar(s.nome)} (${textoPolo(s.polo)})`).join('; ')]
    })),
    reclamadas: agruparPorReclamada(publicos).filter(r => r.processos.length > 1).map(r => ({
      nome: r.nome, cnpjs: r.cnpjs, processos: porOrdem(r.processos).map(linhaProcesso)
    })),
    lotes: lotes.map(l => ({
      numero: l.numero, fase: l.fase, reclamadas: l.reclamadas, assuntosComuns: l.assuntosComuns,
      processos: porOrdem(l.processos).map(linhaProcesso)
    })),
    fichas: ordenados.map(p => montarFicha(p, lotesPorCnj.get(p.cnj) || [])),
    naoLidos: naoLidos.map(f => ({ cnj: f.cnj || String(f.idProcesso || ''), motivo: limpar(f.motivo) })),
    _descricoesOJ: descricoesOJ
  };
}
