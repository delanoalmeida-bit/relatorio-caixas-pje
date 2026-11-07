import { processarLoteVT } from '../motor/hub_vt.js';
import { montarRelatorioVT } from './dados_relatorio_vt.js';
import { gerarPdfVT } from './pdf_vt.js';
import { nomeOrgaoLegivel, tribunalLegivel, dataHoraBR } from './nome_arquivo.js';

const semProibidos = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim();

/**
 * Registros coletados (já sanitizados) → { rel, doc }.
 * Mesmo caminho no navegador (main.js) e nos testes.
 */
export function gerarRelatorio({ registros, falhas = [], meta, JsPDF }) {
  const processos = processarLoteVT(registros.filter(r => r && !r.erro), { agora: meta.geradoEm });
  const rel = montarRelatorioVT({ processos, naoLidos: falhas, meta });
  const base = `${semProibidos(meta.nomeCaixa)} - ${nomeOrgaoLegivel(rel._descricoesOJ)} (${tribunalLegivel(meta.hostname)}) - ${dataHoraBR(meta.geradoEm)}`;
  rel.nomeArquivo = `Relatório ${base}.pdf`;
  rel.nomeArquivoDados = `Dados ${base}.txt`;
  const doc = gerarPdfVT(rel, JsPDF);
  return { rel, doc };
}
