import { normaliza } from '../motor/classificadores/utils_texto.js';
import { validarNumeroOab } from '../motor/classificadores/partes_representantes.js';
import { identificarSindicatos } from '../motor/classificadores/sindicatos.js';

/*
 * No 2º grau a empresa pode estar no polo ativo (quando é ela quem recorre): 133 de 322
 * processos da amostra real. Por isso "reclamada" não é "polo passivo", e sim:
 *   reclamada   = pessoa jurídica / ente (tipoPessoa != 'F') no polo ativo ou passivo,
 *                 exceto sindicato (que atua do lado do trabalhador);
 *   trabalhador = pessoa física no polo ativo ou passivo (+ sindicato).
 * Lote = mesma reclamada + mesma OAB de advogado do lado do trabalhador.
 */

function partesDosPolos(proc) {
  const p = proc.partes || {};
  return [...(p.ativos || []), ...(p.passivos || [])];
}

function ehPessoaFisica(parte) {
  if (parte.tipoPessoa) return parte.tipoPessoa === 'F';
  return parte.tipoDocumento === 'CPF';
}

function ehSindicato(parte) {
  return identificarSindicatos([parte]).temSindicato;
}

function cnpjDe(parte) {
  const doc = parte.cnpj || parte.documento || '';
  return /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/.test(doc) ? doc.trim() : null;
}

/** Chave estável da reclamada: raiz do CNPJ (agrupa filiais) ou nome normalizado. */
export function chaveReclamada(parte) {
  const cnpj = cnpjDe(parte);
  if (cnpj) return 'CNPJ:' + cnpj.replace(/\D/g, '').slice(0, 8);
  return 'NOME:' + normaliza(parte.nome).replace(/[^A-Z0-9]+/g, ' ').trim();
}

export function reclamadasDoProcesso(proc) {
  return partesDosPolos(proc).filter(p => !ehPessoaFisica(p) && !ehSindicato(p) && (p.nome || '').trim());
}

export function trabalhadoresDoProcesso(proc) {
  return partesDosPolos(proc).filter(p => ehPessoaFisica(p) || ehSindicato(p));
}

export function oabsDoTrabalhador(proc) {
  const oabs = new Set();
  for (const t of trabalhadoresDoProcesso(proc)) {
    for (const r of t.representantes || []) {
      const oab = (r.numeroOab || '').trim().toUpperCase();
      if (validarNumeroOab(oab)) oabs.add(oab);
    }
  }
  return Array.from(oabs);
}

/**
 * Agrupa processos por reclamada.
 * @returns {{chave:string, nome:string, cnpjs:string[], processos:object[]}[]} — mais processos primeiro.
 */
export function agruparPorReclamada(processos) {
  const mapa = new Map();
  for (const proc of processos) {
    const vistas = new Set();
    for (const parte of reclamadasDoProcesso(proc)) {
      const chave = chaveReclamada(parte);
      if (!mapa.has(chave)) mapa.set(chave, { chave, nome: parte.nome.trim(), cnpjs: new Set(), processos: [] });
      const reg = mapa.get(chave);
      const cnpj = cnpjDe(parte);
      if (cnpj) reg.cnpjs.add(cnpj);
      if (!vistas.has(chave)) { reg.processos.push(proc); vistas.add(chave); }
    }
  }
  return Array.from(mapa.values())
    .map(r => Object.assign(r, { cnpjs: Array.from(r.cnpjs) }))
    .sort((a, b) => b.processos.length - a.processos.length || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Lotes: 2+ processos com a mesma reclamada e a mesma OAB do lado do trabalhador.
 * Um processo pode estar em mais de um lote (redundância proposital).
 * @returns {{numero:number, reclamadas:string[], processos:object[], assuntosComuns:string[]}[]}
 */
export function identificarLotes(processos, nomeAssunto = a => a.nome) {
  const mapa = new Map();
  for (const proc of processos) {
    const oabs = oabsDoTrabalhador(proc);
    const reclamadas = new Map(reclamadasDoProcesso(proc).map(p => [chaveReclamada(p), p.nome.trim()]));
    for (const [chaveRec, nomeRec] of reclamadas) {
      for (const oab of oabs) {
        const chave = chaveRec + '|' + oab;
        if (!mapa.has(chave)) mapa.set(chave, { reclamada: nomeRec, processos: [] });
        mapa.get(chave).processos.push(proc);
      }
    }
  }

  // O mesmo conjunto de processos pode surgir por várias chaves (dois advogados do mesmo
  // escritório, ou processo com várias reclamadas): vira um lote só, com todas as reclamadas.
  const unicos = new Map();
  for (const lote of mapa.values()) {
    if (lote.processos.length < 2) continue;
    const assinatura = lote.processos.map(p => p.cnj).sort().join(',');
    if (!unicos.has(assinatura)) unicos.set(assinatura, { reclamadas: [], processos: lote.processos });
    const u = unicos.get(assinatura);
    if (!u.reclamadas.includes(lote.reclamada)) u.reclamadas.push(lote.reclamada);
  }

  const lotes = Array.from(unicos.values())
    .sort((a, b) => b.processos.length - a.processos.length || a.reclamadas[0].localeCompare(b.reclamadas[0], 'pt-BR'));

  return lotes.map((lote, i) => {
    const conjuntos = lote.processos.map(p => new Set(((p.assuntos && p.assuntos.itens) || []).map(nomeAssunto)));
    const comuns = conjuntos.length ? Array.from(conjuntos[0]).filter(a => conjuntos.every(c => c.has(a))) : [];
    return { numero: i + 1, reclamadas: lote.reclamadas, processos: lote.processos, assuntosComuns: comuns };
  });
}
