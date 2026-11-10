import { identificarLotes, trabalhadoresDoProcesso, oabsDoTrabalhador } from '../relatorio/reclamadas_lotes.js';
import { formatarData } from '../relatorio/dados_relatorio_vt.js';
import { nomeOrgaoLegivel, tribunalLegivel, dataHoraBR } from '../relatorio/nome_arquivo.js';

/*
 * Arquivo das entradas do período (botão "entradas de ontem"): uma tabela para quem lê e um
 * bloco JSON para o assistente de triagem diária. Mesmos dados (já sanitizados) do relatório
 * completo; nada é enviado para fora do navegador.
 */

const SEGREDO = 'SEGREDO DE JUSTIÇA';
const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
const semProibidos = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim();
const celula = s => limpar(s).replace(/\|/g, '/');

function ehSegredo(proc) {
  const r = proc.raw || {};
  return Boolean((r.listagem && r.listagem.segredoDeJustica) || (r.processo && r.processo.segredoDeJustica));
}

/** Dígito final do número sequencial do CNJ: "0017784-75.2024..." → 4. */
export function digitoFinal(cnj) {
  const m = String(cnj || '').match(/^(\d{7})-/);
  return m ? Number(m[1][6]) : null;
}

/** Assistente de juiz pela regra do dígito final (CONFIG.DIVISAO_ASSISTENTES). */
export function assistentePeloDigito(cnj, divisao = []) {
  const d = digitoFinal(cnj);
  if (d === null) return null;
  const regra = divisao.find(r => (r.digitos || []).includes(d));
  return regra ? regra.nome : null;
}

function nomes(lista, max = 4) {
  const n = (lista || []).map(p => limpar(p.nome)).filter(Boolean);
  if (!n.length) return 'não informado';
  return n.length <= max ? n.join('; ') : n.slice(0, max).join('; ') + ` e mais ${n.length - max}`;
}

function alertas(proc, lotes) {
  const a = [];
  if (proc.temPrioridade) a.push('Prioridade' + (proc.prioridades.length ? `: ${proc.prioridades.join('; ')}` : ''));
  if (proc.prazoExpirado) a.push('Prazo expirado no PJe');
  if (proc.entesPublicos.length) a.push('Ente público');
  if (proc.pjs.temRecuperacaoJudicial) a.push('Recuperação judicial');
  if (proc.pjs.temMassaFalida) a.push('Massa falida');
  if (proc.sindicatos && proc.sindicatos.temSindicato) a.push('Sindicato');
  if (proc.temComentario) a.push('Comentário no PJe');
  if (ehSegredo(proc)) a.push('Segredo de justiça');
  for (const n of lotes) a.push(`Lote ${n}`);
  return a;
}

/**
 * @param {object} args
 * @param {object[]} args.processos   saída de processarLoteVT() (só os do período)
 * @param {{cnj:string, motivo:string}[]} [args.naoLidos]
 * @param {{hostname:string, nomeCaixa:string, geradoEm:Date, totalNaCaixa:number,
 *   periodo:{legivel:string, arquivo:string}, divisao:object[], versao:string}} args.meta
 * @returns {{texto:string, nomeArquivo:string, qtd:number}}
 */
export function montarEntradas({ processos, naoLidos = [], meta }) {
  const ordenados = processos.slice().sort((a, b) =>
    (new Date(a.entrada || 0).getTime() || 0) - (new Date(b.entrada || 0).getTime() || 0) ||
    String(a.cnj).localeCompare(String(b.cnj)));

  // Lotes dentro do período: mesma reclamada + mesma OAB do trabalhador + mesma fase.
  const lotesPorCnj = new Map();
  let numero = 0;
  const publicos = ordenados.filter(p => !ehSegredo(p));
  for (const fase of Array.from(new Set(publicos.map(p => p.fase)))) {
    for (const l of identificarLotes(publicos.filter(p => p.fase === fase))) {
      numero++;
      for (const p of l.processos) {
        if (!lotesPorCnj.has(p.cnj)) lotesPorCnj.set(p.cnj, []);
        lotesPorCnj.get(p.cnj).push(numero);
      }
    }
  }

  const ojs = ordenados.map(p => limpar((p.raw.listagem || {}).descricaoOrgaoJulgador)).filter(Boolean);
  const orgao = nomeOrgaoLegivel(ojs);
  const tribunal = tribunalLegivel(meta.hostname);

  const dados = ordenados.map((p, i) => {
    const segredo = ehSegredo(p);
    const lotes = lotesPorCnj.get(p.cnj) || [];
    return {
      ordem: i + 1,
      cnj: p.cnj,
      idProcesso: p.idProcesso,
      classe: p.classe.sigla,
      fase: p.fase,
      tarefa: p.tarefa,
      entradaNaTarefa: formatarData(p.entrada, true),
      digitoFinal: digitoFinal(p.cnj),
      assistentePeloDigito: assistentePeloDigito(p.cnj, meta.divisao),
      responsavelNoPJe: p.responsavel || null,
      poloAtivo: segredo ? SEGREDO : nomes(p.partes.ativos),
      poloPassivo: segredo ? SEGREDO : nomes(p.partes.passivos),
      reclamante: segredo ? SEGREDO : (trabalhadoresDoProcesso(p).map(t => limpar(t.nome))[0] || null),
      oabsDoTrabalhador: segredo ? [] : oabsDoTrabalhador(p),
      entesPublicos: segredo ? [] : p.entesPublicos.map(e => `${e.nome} (polo ${e.polo})`),
      recuperacaoJudicial: Boolean(p.pjs.temRecuperacaoJudicial),
      massaFalida: Boolean(p.pjs.temMassaFalida),
      sindicato: Boolean(p.sindicatos && p.sindicatos.temSindicato),
      prioridades: p.temPrioridade ? (p.prioridades.length ? p.prioridades : ['indicada pelo PJe']) : [],
      prazoExpirado: p.prazoExpirado,
      comentarioNoPJe: p.temComentario,
      segredoDeJustica: segredo,
      lotes,
      assuntos: ((p.assuntos && p.assuntos.itens) || []).map(a => a.nome).filter(Boolean),
      _alertas: alertas(p, lotes)
    };
  });

  const linhas = [];
  linhas.push(`# Entradas na caixa ${meta.nomeCaixa} — ${orgao} (${tribunal})`);
  linhas.push('');
  linhas.push(`- Período: processos que entraram na caixa ${meta.periodo.legivel}`);
  linhas.push(`- Gerado em: ${formatarData(meta.geradoEm.toISOString(), true)}`);
  linhas.push(`- Processos do período ainda na caixa: ${dados.length} (total na caixa: ${meta.totalNaCaixa})`);
  if (naoLidos.length) linhas.push(`- Não lidos (refazer no PJe): ${naoLidos.map(n => n.cnj).join(', ')}`);
  linhas.push('- Quem entrou no período e já saiu da caixa não aparece aqui.');
  linhas.push('');
  if (dados.length) {
    linhas.push('| # | Processo | Classe | Fase | Entrada | Assistente (dígito) | Partes | Alertas |');
    linhas.push('|---|---|---|---|---|---|---|---|');
    for (const d of dados) {
      const partes = d.segredoDeJustica ? SEGREDO : `${d.poloAtivo} x ${d.poloPassivo}`;
      linhas.push(`| ${d.ordem} | ${d.cnj} | ${d.classe} | ${d.fase} | ${d.entradaNaTarefa} | ` +
        `${celula(d.assistentePeloDigito || '?')} (${d.digitoFinal ?? '?'}) | ${celula(partes)} | ${celula(d._alertas.join('; ') || '—')} |`);
    }
  } else {
    linhas.push('Nenhum processo do período está na caixa.');
  }
  linhas.push('');
  linhas.push('## Dados para o assistente de triagem');
  linhas.push('');
  linhas.push('```json');
  linhas.push(JSON.stringify({
    caixa: meta.nomeCaixa, orgao, tribunal, periodo: meta.periodo.legivel,
    geradoEm: formatarData(meta.geradoEm.toISOString(), true), totalNaCaixa: meta.totalNaCaixa,
    naoLidos: naoLidos.map(n => n.cnj), versao: meta.versao,
    processos: dados.map(({ _alertas, ...resto }) => resto)
  }, null, 1));
  linhas.push('```');
  linhas.push('');

  const nomeArquivo = `Entradas ${semProibidos(meta.nomeCaixa)} - ${orgao} (${tribunal}) - ${meta.periodo.arquivo}` +
    ` - gerado ${dataHoraBR(meta.geradoEm)}.md`;
  return { texto: linhas.join('\n'), nomeArquivo, qtd: dados.length };
}
