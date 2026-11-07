/**
 * Módulo de regras de prevenção recursal para Agravos de Petição e Recursos de 2º Grau.
 * Base normativa: Regimento Interno do TRT-2 (art. 82) e Ato GP nº 08/2014 (09/04/2014).
 */

export const MARCO_CADEIRAS_NUMERADAS = new Date('2014-04-09T00:00:00');

export function avaliarPrevencao(dadosJulgamentoAnterior, ehEntePublicoOuColetivo = false) {
  if (!dadosJulgamentoAnterior || !dadosJulgamentoAnterior.dataAcordaoAnterior) {
    if (ehEntePublicoOuColetivo) {
      return {
        tipoPrevencao: 'DISTRIBUICAO_DIRETA_PROVAVEL',
        vinculaTurma: false,
        vinculaCadeira: false,
        descricao: 'Possível distribuição direta por Ente Público / Execução Coletiva (conferir diretriz interna da Distribuição).'
      };
    }
    return {
      tipoPrevencao: 'SEM_REGISTRO_ANTERIOR',
      vinculaTurma: false,
      vinculaCadeira: false,
      descricao: 'Sem histórico de julgamento anterior registrado.'
    };
  }

  const dt = new Date(dadosJulgamentoAnterior.dataAcordaoAnterior);
  const posMarco2014 = dt >= MARCO_CADEIRAS_NUMERADAS;

  if (posMarco2014) {
    return {
      tipoPrevencao: 'TURMA_E_CADEIRA',
      vinculaTurma: true,
      vinculaCadeira: true,
      dataMarco: dt.toISOString().slice(0, 10),
      descricao: `Acórdão anterior em ${dt.toLocaleDateString('pt-BR')} (pós-Ato GP 08/2014): prevenção vincula Turma e Cadeira/Gabinete.`
    };
  }

  return {
    tipoPrevencao: 'APENAS_TURMA',
    vinculaTurma: true,
    vinculaCadeira: false,
    dataMarco: dt.toISOString().slice(0, 10),
    descricao: `Acórdão anterior em ${dt.toLocaleDateString('pt-BR')} (anterior a 09/04/2014): prevenção vincula apenas a Turma, sem fixar Cadeira numerada.`
  };
}
