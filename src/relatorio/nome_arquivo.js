/**
 * Nome do arquivo legível para qualquer usuário:
 *   "Relatório de Triagem - 9ª Turma - Cadeira 4 (TRT-2) - 04-11-2026 às 22h47.pdf"
 * Órgão julgador por extenso (como o PJe escreve), data no formato brasileiro DD-MM-AAAA.
 * Sem \ / : * ? " < > | (proibidos em nome de arquivo no Windows).
 */

const PROIBIDOS = /[\\/:*?"<>|\u0000-\u001f]/g;

function limparParaArquivo(texto) {
  return String(texto || '').replace(PROIBIDOS, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Um órgão no lote → nome dele por extenso; mais de um → "Vários órgãos julgadores". */
export function nomeOrgaoLegivel(descricoes) {
  const distintas = Array.from(new Set((descricoes || []).map(d => String(d || '').replace(/\s+/g, ' ').trim()).filter(Boolean)));
  if (distintas.length === 0) return 'Órgão julgador não identificado';
  if (distintas.length > 1) return 'Vários órgãos julgadores';
  return limparParaArquivo(distintas[0]);
}

/** "pje.trt2.jus.br" → "TRT2". */
export function siglaTribunal(hostname) {
  const m = String(hostname || '').match(/\b(trt\d+|tst|csjt)\b/i);
  return m ? m[1].toUpperCase() : (String(hostname || '').split('.')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'PJE');
}

/** "TRT2" → "TRT-2". */
export function tribunalLegivel(hostname) {
  return siglaTribunal(hostname).replace(/^TRT(\d+)$/, 'TRT-$1');
}

const dois = n => String(n).padStart(2, '0');

/** Data/hora LOCAL no padrão brasileiro: "04-11-2026 às 22h47". */
export function dataHoraBR(data) {
  return `${dois(data.getDate())}-${dois(data.getMonth() + 1)}-${data.getFullYear()} às ${dois(data.getHours())}h${dois(data.getMinutes())}`;
}

export function nomeArquivoRelatorio({ hostname, descricoesOJ, data }) {
  return `Relatório de Triagem - ${nomeOrgaoLegivel(descricoesOJ)} (${tribunalLegivel(hostname)}) - ${dataHoraBR(data)}.pdf`;
}

export function nomeArquivoDados({ hostname, descricoesOJ, data }) {
  return `Dados da Triagem - ${nomeOrgaoLegivel(descricoesOJ)} (${tribunalLegivel(hostname)}) - ${dataHoraBR(data)}.txt`;
}
