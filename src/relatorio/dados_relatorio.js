import { obterRotulosPolosContextuais } from '../motor/classificadores/partes_representantes.js';
import { ROTA_TRIAGEM } from '../motor/classificadores/classes_trabalhistas.js';
import { agruparPorReclamada, identificarLotes, trabalhadoresDoProcesso } from './reclamadas_lotes.js';
import { nomeArquivoRelatorio, nomeArquivoDados, siglaTribunal } from './nome_arquivo.js';

/*
 * Transforma o lote já classificado (motor/hub_triagem.js) na estrutura das seções do PDF.
 * Tudo sai como texto pronto. Especificação: documentacao/CONTEUDO_DO_RELATORIO.md
 */

export const SEGREDO = 'SEGREDO DE JUSTIÇA';

const dois = n => String(n).padStart(2, '0');

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

const simNao = v => (v === true ? 'sim' : v === false ? 'não' : 'não informado');
const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();

function ehSegredo(proc) {
  const r = proc.raw || {};
  return Boolean((r.listagem && r.listagem.segredoDeJustica) || (r.processo && r.processo.segredoDeJustica));
}

function nomeParte(proc, nome) {
  return ehSegredo(proc) ? SEGREDO : limpar(nome);
}

const TIPO_OBVIO = /RECORR|AGRAV|EMBARG|IMPETR|RECLAMA|AUTOR|\bR[EÉ]U\b|EXEQU|EXECUT/i;

function listaNomes(proc, partes) {
  if (!partes.length) return 'não informado';
  if (ehSegredo(proc)) return SEGREDO;
  return partes.map(p => {
    const tipo = limpar(p.tipo);
    return limpar(p.nome) + (tipo && !TIPO_OBVIO.test(tipo) ? ` (${tipo.toLowerCase()})` : '');
  }).join('; ');
}

const plural = rotulo => rotulo.replace(/\(a\)$/, '') + '(s)';

function tituloPartes(proc) {
  if (ehSegredo(proc)) return SEGREDO;
  const p = proc.partes || {};
  const resumo = lista => !lista || !lista.length ? 'não informado'
    : limpar(lista[0].nome) + (lista.length > 1 ? ` e mais ${lista.length - 1}` : '');
  return `${resumo(p.ativos)} x ${resumo(p.passivos)}`;
}

function textoAssunto(item) {
  const a = (item && item.assunto) || item || {};
  return limpar(a.assuntoResumido || a.descricao || item.descricao || `Assunto ${a.codigo || ''}`);
}

function assuntosDoProcesso(proc) {
  const brutos = (proc.raw && proc.raw.assuntos) || [];
  const itens = brutos.map(it => ({ texto: textoAssunto(it), principal: Boolean(it.principal || (it.assunto && it.assunto.principal)) }));
  itens.sort((a, b) => Number(b.principal) - Number(a.principal));
  return itens;
}

function descricaoOJ(proc) {
  const r = proc.raw || {};
  return limpar((r.listagem && r.listagem.descricaoOrgaoJulgador) ||
    (r.processo && r.processo.orgaoJulgador && r.processo.orgaoJulgador.descricao) || '');
}

function entradaTriagem(proc) {
  return (proc.raw && proc.raw.listagem && proc.raw.listagem.dataEntradaTarefa) || null;
}

function fazendaSemMpt(proc) {
  return Boolean(proc.pjs && proc.pjs.temFazendaPublica && proc.partes && !proc.partes.mptPresente);
}

function textoPolo(polo) {
  const p = String(polo || '').toLowerCase();
  return p === 'ativo' ? 'polo ativo' : p === 'passivo' ? 'polo passivo' : p ? `polo ${p}` : 'polo não identificado';
}

/** Linha curta usada nas listagens das seções 4 a 8. */
function linhaProcesso(proc) {
  return {
    ordem: proc._ordem,
    cnj: proc.cnj,
    classe: (proc.classe && proc.classe.sigla) || 'OUTROS',
    entrada: formatarData(entradaTriagem(proc)),
    partes: tituloPartes(proc),
    reclamante: ehSegredo(proc) ? SEGREDO
      : (trabalhadoresDoProcesso(proc).map(p => limpar(p.nome))[0] || 'não identificado')
  };
}

function montarFicha(proc, lotesDoProcesso) {
  const r = proc.raw || {};
  const listagem = r.listagem || {};
  const processo = r.processo || {};
  const classe = proc.classe || {};
  const rotulos = obterRotulosPolosContextuais(classe.sigla, classe.rota);
  const p = proc.partes || {};
  const terceiros = (p.terceiros || []).filter(t => (t.nome || '').trim());

  const alertas = [];
  if (fazendaSemMpt(proc)) alertas.push('Fazenda Pública sem MPT (retificar autuação)');
  else if (proc.pjs && proc.pjs.temFazendaPublica) alertas.push('Fazenda Pública (MPT cadastrado)');
  if (proc.temporalidade && proc.temporalidade.ehProcessoFisicoMigrado) alertas.push('Processo físico migrado (verificar prevenção)');
  if (proc.sindicatos && proc.sindicatos.temSindicato) {
    for (const s of proc.sindicatos.sindicatos) alertas.push(`Sindicato no ${textoPolo(s.polo)}`);
  }
  for (const n of lotesDoProcesso) alertas.push(`Lote nº ${n}`);
  if (ehSegredo(proc)) alertas.push('Segredo de justiça');

  const assuntos = assuntosDoProcesso(proc);
  const relator = limpar(listagem.nomeRelator || (processo.relator && processo.relator.nome));
  const fase = classe.rota === ROTA_TRIAGEM.EXECUCAO ? 'Execução'
    : classe.rota === ROTA_TRIAGEM.CONHECIMENTO ? 'Conhecimento'
      : limpar(processo.labelFaseProcessual || listagem.faseProcessual) || 'não informado';

  // Cada linha = lista de pares [rótulo, valor]; pares curtos ficam lado a lado.
  const linhas = [
    [['CNJ', proc.cnj]],
    [['Classe', `${classe.sigla || 'OUTROS'}${classe.nome ? ' - ' + classe.nome : ''}`], ['Fase', fase]],
    [['Órgão julgador', descricaoOJ(proc) || 'não informado'], ['Relator', relator || 'não informado']],
    [['Entrada na triagem', formatarData(entradaTriagem(proc), true)],
      ['Autuação (2º grau)', formatarData(processo.autuadoEm || processo.distribuidoEm)]],
    [[plural(rotulos.poloAtivoRotulo), listaNomes(proc, p.ativos || [])]],
    [[plural(rotulos.poloPassivoRotulo), listaNomes(proc, p.passivos || [])]]
  ];
  if (terceiros.length) linhas.push([['Outros participantes', listaNomes(proc, terceiros)]]);
  linhas.push(
    [['Assuntos', assuntos.length ? assuntos.map(a => a.texto + (a.principal ? ' (principal)' : '')).join('; ') : 'não informado']],
    [['Valor da causa', formatarValor(processo.valorDaCausa)], ['Justiça gratuita', simNao(processo.justicaGratuita)],
      ['Tutela/liminar', simNao(processo.tutelaOuLiminar)],
      ['Prioridade (PJe)', listagem.prioridadeProcessual > 0 ? 'sim' : 'não']],
    [['Alertas', alertas.length ? alertas.join('; ') : 'nenhum']]
  );
  return { ordem: proc._ordem, cnj: proc.cnj, linhas };
}

/**
 * @param {object} args
 * @param {object[]} args.processos  saída de processarLoteTriagem().processos
 * @param {{cnj:string, motivo:string}[]} [args.naoLidos]
 * @param {{hostname:string, totalNaCaixa:number, criterio:string, geradoEm:Date, versao:string, segundos?:number}} args.meta
 */
export function montarRelatorio({ processos, naoLidos = [], meta }) {
  // Ordem oficial: entrada na triagem (mais antigo primeiro), desempate pelo CNJ.
  const ordenados = processos.slice().sort((a, b) => {
    const da = new Date(entradaTriagem(a) || 0).getTime() || 0;
    const db = new Date(entradaTriagem(b) || 0).getTime() || 0;
    return da - db || String(a.cnj).localeCompare(String(b.cnj));
  });
  ordenados.forEach((p, i) => { p._ordem = i + 1; });
  const porOrdem = lista => lista.slice().sort((a, b) => a._ordem - b._ordem);

  // Segredo de justiça fica fora das listagens por reclamada/lote (revelaria a empresa);
  // continua nas fichas e nas demais seções, com as partes mascaradas.
  const publicos = ordenados.filter(p => !ehSegredo(p));
  const lotes = identificarLotes(publicos, a => a.nome);
  const lotesPorCnj = new Map();
  for (const l of lotes) for (const p of l.processos) {
    if (!lotesPorCnj.has(p.cnj)) lotesPorCnj.set(p.cnj, []);
    lotesPorCnj.get(p.cnj).push(l.numero);
  }

  const fazenda = ordenados.filter(fazendaSemMpt);
  const fisicos = ordenados.filter(p => p.temporalidade && p.temporalidade.ehProcessoFisicoMigrado);
  const comSindicato = ordenados.filter(p => p.sindicatos && p.sindicatos.temSindicato);
  const reclamadas = agruparPorReclamada(publicos);

  const descricoesOJ = ordenados.map(descricaoOJ);
  const ojs = Array.from(new Set(descricoesOJ.filter(Boolean)));

  const tribunal = siglaTribunal(meta.hostname).replace(/^TRT(\d+)$/, 'TRT-$1');

  return {
    nomeArquivo: nomeArquivoRelatorio({ hostname: meta.hostname, descricoesOJ, data: meta.geradoEm }),
    nomeArquivoDados: nomeArquivoDados({ hostname: meta.hostname, descricoesOJ, data: meta.geradoEm }),
    capa: {
      tribunal,
      orgao: ojs.length ? ojs.join('; ') : 'não identificado',
      geradoEm: formatarData(meta.geradoEm.toISOString(), true),
      criterio: meta.criterio || 'Caixa Triagem',
      totalNaCaixa: meta.totalNaCaixa ?? ordenados.length + naoLidos.length,
      noRelatorio: ordenados.length,
      naoLidos: naoLidos.length,
      versao: meta.versao || '',
      segundos: meta.segundos
    },
    fazendaSemMpt: fazenda.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Ente público', ehSegredo(p) ? SEGREDO : (p.pjs.entesFazenda || []).map(e => limpar(e.nome)).join('; ') || 'não identificado']
    })),
    fisicos: fisicos.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Ano do CNJ', String((p.temporalidade && p.temporalidade.anoCnj) || 'não informado')]
    })),
    sindicatos: comSindicato.map(p => Object.assign(linhaProcesso(p), {
      extra: ['Sindicato', p.sindicatos.sindicatos.map(s => `${nomeParte(p, s.nome)} (${textoPolo(s.polo)})`).join('; ')]
    })),
    // Só reclamadas com 2+ processos (as de processo único não ajudavam na triagem).
    reclamadas: reclamadas.filter(r => r.processos.length > 1).map(r => ({
      nome: r.nome,
      cnpjs: r.cnpjs,
      processos: porOrdem(r.processos).map(linhaProcesso)
    })),
    lotes: lotes.map(l => ({
      numero: l.numero,
      reclamadas: l.reclamadas,
      assuntosComuns: l.assuntosComuns,
      processos: porOrdem(l.processos).map(linhaProcesso)
    })),
    fichas: ordenados.map(p => montarFicha(p, lotesPorCnj.get(p.cnj) || [])),
    naoLidos: naoLidos.map(f => ({ cnj: f.cnj || String(f.idProcesso || ''), motivo: limpar(f.motivo) }))
  };
}
