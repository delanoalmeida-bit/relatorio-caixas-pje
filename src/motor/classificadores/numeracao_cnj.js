/*
 * Origem da numeração CNJ e dígito final (TRT-16).
 *
 * Processos autuados em meio físico (até a implantação do PJe-JT na unidade) receberam no CNJ
 * o número físico de 5 dígitos seguido de "00": 01323-2008-002-16-00-1 → 0132300-70.2008.5.16.0002.
 * O dígito final desses processos é o último do número físico (o 5º do sequencial: 3).
 * Processos nascidos no PJe começam em 0016000 e usam o 7º dígito (0017784 → 4).
 *
 * Implantação do PJe-JT nas Varas de São Luís: 15/02/2013 (2ª, 3ª e 7ª VT) e 28/02/2013
 * (1ª, 4ª, 5ª e 6ª). Por isso: ano ≤ 2012 → físico; ano ≥ 2014 → PJe; 2013 depende do número
 * e, no caso ambíguo (≥ 0016000 terminado em 00), da data de autuação.
 */

export const IMPLANTACAO_PJE = '2013-02-15';
export const INICIO_FAIXA_PJE = 16000;

function partes(cnj) {
  const m = String(cnj || '').match(/(\d{7})-?\d{2}\.?(\d{4})/);
  return m ? { seq: m[1], ano: Number(m[2]) } : null;
}

/**
 * @param {string} cnj
 * @param {{autuadoEm?: string|Date|null, implantacao?: string}} [opcoes]
 * @returns {{origem: 'fisico'|'pje', ambiguo: boolean}|null}
 *   ambiguo = 2013, número ≥ 0016000 terminado em 00 e sem data de autuação que resolva.
 */
export function origemNumeracao(cnj, { autuadoEm = null, implantacao = IMPLANTACAO_PJE } = {}) {
  const p = partes(cnj);
  if (!p) return null;
  if (p.ano <= 2012) return { origem: 'fisico', ambiguo: false };
  if (p.ano >= 2014) return { origem: 'pje', ambiguo: false };
  const n = Number(p.seq);
  if (n < INICIO_FAIXA_PJE) return { origem: 'fisico', ambiguo: false };
  if (!p.seq.endsWith('00')) return { origem: 'pje', ambiguo: false };
  // 2013, ≥ 0016000 e terminado em 00: físico nº 160 a 199/2013 ou nativo do PJe.
  const d = autuadoEm ? new Date(autuadoEm) : null;
  if (d && !isNaN(d.getTime())) {
    // Nativo de 2013 foi autuado em 2013, depois da implantação. Migrado do físico traz a
    // autuação original (antes da implantação) ou a data da migração (anos depois).
    const nativo = d >= new Date(implantacao + 'T00:00:00-03:00') && d.getFullYear() === 2013;
    return { origem: nativo ? 'pje' : 'fisico', ambiguo: false };
  }
  return { origem: 'pje', ambiguo: true };
}

/**
 * Dígito final para a divisão de trabalho e os marcadores "Terminação".
 * Físico: 5º dígito do sequencial (despreza o "00"). PJe: 7º dígito.
 */
export function digitoFinal(cnj, opcoes = {}) {
  const p = partes(cnj);
  if (!p) return null;
  const o = origemNumeracao(cnj, opcoes);
  return Number(o.origem === 'fisico' ? p.seq[4] : p.seq[6]);
}
