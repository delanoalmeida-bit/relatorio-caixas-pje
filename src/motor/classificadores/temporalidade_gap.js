import { origemNumeracao } from './numeracao_cnj.js';

/**
 * Módulo de temporalidade e heurística do Gap Temporal (CNJ vs Peça mais antiga).
 * Distingue processos 100% digitais de processos físicos migrados para o PJe na fase de execução.
 */

export function extrairAnoCnj(cnj) {
  if (!cnj) return null;
  const m = String(cnj).match(/\d{7}-\d{2}\.(\d{4})\.\d\.\d{2}\.\d{4}/);
  if (m) return parseInt(m[1], 10);
  // Fallback: se formato for sem pontuação
  const m2 = String(cnj).match(/\d{9}(\d{4})\d{7}/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

export function analisarGapAutos(processoOuRegistro) {
  const cnj = (processoOuRegistro && (processoOuRegistro.cnj || (processoOuRegistro.processo && processoOuRegistro.processo.numero))) || '';
  const anoCnj = extrairAnoCnj(cnj);

  // Busca dados da peça mais antiga ou metadados de listagem
  let anoPecaMaisAntiga = null;
  let tipoPecaMaisAntiga = '';

  const pecaAntiga = processoOuRegistro.pecaMaisAntiga || (processoOuRegistro.documentos && processoOuRegistro.documentos[0]);
  if (pecaAntiga) {
    tipoPecaMaisAntiga = pecaAntiga.descricao || pecaAntiga.tipo || pecaAntiga.titulo || '';
    const dt = pecaAntiga.dataInclusao || pecaAntiga.juntadoEm || pecaAntiga.criadoEm;
    if (dt) {
      anoPecaMaisAntiga = new Date(dt).getFullYear();
    }
  }

  // Se não temos a timeline de documentos, avalia data de autuação ou entrada no PJe
  if (!anoPecaMaisAntiga) {
    const p = processoOuRegistro.processo || processoOuRegistro;
    const dtAutuacao = p.autuadoEm || p.distribuidoEm || (processoOuRegistro.listagem && processoOuRegistro.listagem.dataEntradaTarefa);
    if (dtAutuacao) {
      anoPecaMaisAntiga = new Date(dtAutuacao).getFullYear();
    }
  }

  let gap = 0;
  if (anoCnj && anoPecaMaisAntiga) {
    gap = anoPecaMaisAntiga - anoCnj;
  }

  let ehProcessoFisicoMigrado = false;
  let alertaAutos = 'Autos digitais integrais';

  // Regra primária: numeração de processo físico (ano ≤ 2012, ou 2013 abaixo de 0016000 ou
  // anterior à implantação do PJe). Ver numeracao_cnj.js. Vale também para o padrão do TRT-2
  // (0096500-55.2001 → físico; 1000647-56.2018 → nativo).
  const p0 = processoOuRegistro.processo || processoOuRegistro;
  const origem = cnj ? origemNumeracao(cnj, { autuadoEm: p0.autuadoEm || null }) : null;
  const ehFaixaFisica = Boolean(origem && origem.origem === 'fisico');

  const tipoNorm = tipoPecaMaisAntiga.toUpperCase();
  const temCertidaoMigracao = tipoNorm.includes('TERMO DE ABERTURA') || tipoNorm.includes('MIGRACAO') || tipoNorm.includes('TERMO DE MIGRACAO');

  if (ehFaixaFisica) {
    ehProcessoFisicoMigrado = true;
    if (gap > 0) {
      alertaAutos = `Processo físico migrado (origem papel/legado, CNJ ${cnj}, gap de ${gap} anos: CNJ ${anoCnj} vs PJe ${anoPecaMaisAntiga}). Fase de conhecimento ausente do sistema digital.`;
    } else {
      alertaAutos = `Processo físico migrado (origem papel/legado, CNJ ${cnj}). Fase de conhecimento ausente do sistema digital.`;
    }
  } else if (temCertidaoMigracao) {
    ehProcessoFisicoMigrado = true;
    alertaAutos = `Processo com termo de migração digital identificado (${tipoPecaMaisAntiga}).`;
  } else {
    ehProcessoFisicoMigrado = false;
    alertaAutos = 'Autos digitais integrais';
  }

  // Semântica de "Em triagem desde" (redistribuição ou entrada na tarefa)
  const dtInicio = (processoOuRegistro.processo && processoOuRegistro.processo.dataInicio) ||
                   (processoOuRegistro.listagem && processoOuRegistro.listagem.dataEntradaTarefa) || null;

  return {
    cnj,
    anoCnj,
    anoPecaMaisAntiga,
    tipoPecaMaisAntiga,
    gap,
    ehProcessoFisicoMigrado,
    alertaAutos,
    emTriagemDesde: dtInicio,
    badge: ehProcessoFisicoMigrado ? 'Processo físico' : 'NATIVO DIGITAL'
  };
}
