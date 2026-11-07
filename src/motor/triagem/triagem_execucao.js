import { avaliarPrevencao } from '../classificadores/prevencao_marcos.js';
import { analisarGapAutos } from '../classificadores/temporalidade_gap.js';
import { EXIGENCIA_RECURSAL } from '../classificadores/pessoas_juridicas.js';

/**
 * Motor de triagem especializado na fase de execução (Agravos de Petição e AIAP).
 */
export function triarRecursoExecucao(processoClassificado) {
  const cls = processoClassificado.classe;
  const pjs = processoClassificado.pjs;
  const partes = processoClassificado.partes;
  const temporalidade = processoClassificado.temporalidade || analisarGapAutos(processoClassificado.raw);
  const alertas = [];

  // 1. Heurística do Gap de Autos Físicos
  if (temporalidade.ehProcessoFisicoMigrado) {
    alertas.push({
      tipo: 'PROCESSO_FISICO_MIGRADO',
      nivel: 'AVISO',
      texto: temporalidade.alertaAutos
    });
  }

  // 2. Prevenção Histórica
  const prevencao = avaliarPrevencao(
    processoClassificado.dadosAcordaoAnterior,
    pjs.temFazendaPublica
  );
  if (prevencao.vinculaTurma) {
    alertas.push({
      tipo: 'PREVENCAO',
      nivel: 'INFO',
      texto: prevencao.descricao
    });
  }

  // 3. Delimitação de Matérias e Valores (CLT art. 897, § 1º)
  alertas.push({
    tipo: 'DELIMITACAO_INCONTROVERSO',
    nivel: 'CHECK',
    texto: 'Pressuposto específico do AP: verificar se houve delimitação justificada das matérias e valores impugnados (CLT art. 897, § 1º).'
  });

  // 4. Preparo na Execução (Garantia do Juízo)
  let garantiaJuizo = 'Exige juízo integralmente garantido por penhora ou depósito (CLT art. 884). Custas ao final (CLT art. 789-A).';
  if (pjs.temFazendaPublica) {
    garantiaJuizo = 'Fazenda Pública: execução por precatório/RPV (CF art. 100). Sem exigência de penhora prévia.';
  } else if (pjs.temMassaFalida) {
    garantiaJuizo = 'Massa Falida: habilitação no juízo falimentar; sem constrição ou penhora direta (Súmula 86 TST).';
  } else if (pjs.temRecuperacaoJudicial) {
    garantiaJuizo = 'Recuperação Judicial: juízo da recuperação é competente para atos de constrição patrimonial.';
  }

  // 5. MPT
  if (pjs.temFazendaPublica && !partes.mptPresente) {
    alertas.push({
      tipo: 'RETIFICAR_MPT',
      nivel: 'ALERTA_VISUAL',
      texto: 'RETIFICAR — INCLUIR MPT (Fazenda Pública presente no polo da execução).'
    });
  }

  return {
    rota: 'EXECUCAO',
    sigla: cls.sigla,
    ehAgravoPeticao: cls.sigla === 'AP',
    ehAgravoInstrumento: cls.sigla === 'AIAP',
    garantiaJuizo,
    prevencao,
    temporalidade,
    alertas
  };
}
