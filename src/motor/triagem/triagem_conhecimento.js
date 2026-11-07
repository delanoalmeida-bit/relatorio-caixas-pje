import { CATEGORIA_PJ, EXIGENCIA_RECURSAL } from '../classificadores/pessoas_juridicas.js';

/**
 * Motor de triagem específico para recursos da fase de conhecimento.
 */
export function triarRecursoConhecimento(processoClassificado) {
  const cls = processoClassificado.classe;
  const pjs = processoClassificado.pjs;
  const partes = processoClassificado.partes;
  const alertas = [];

  const ehSumarissimo = cls.sigla === 'RORSum';
  const ehRemessa = cls.sigla === 'RemNecRO' || cls.sigla === 'RemNec';
  const ehAgravoInstrumento = cls.sigla === 'AIRO';

  // 1. Verificação de Rito Sumaríssimo
  if (ehSumarissimo) {
    alertas.push({
      tipo: 'RITO_SUMARISSIMO',
      nivel: 'INFO',
      texto: 'Procedimento Sumaríssimo (CLT art. 852-A): dispensa relatório no acórdão (CLT art. 895, § 1º, IV); apreciação prioritária.'
    });
  }

  // 2. Verificação de Duplo Grau Obrigatório / Remessa Necessária
  if (ehRemessa) {
    alertas.push({
      tipo: 'REMESSA_NECESSARIA',
      nivel: 'ATENCAO',
      texto: 'Remessa Necessária (CPC art. 496 e Súmula 303 TST): verificar se o valor da condenação líquida atinge o teto de isenção de remessa.'
    });
  }

  // 3. Preparo recursal
  const recorrente = partes.ativos[0] || {};
  const pjRecorrente = pjs.partesClassificadas.find(p => p.poloOriginal === 'ativo');

  let exigenciaPreparo = EXIGENCIA_RECURSAL.PREPARO_INTEGRAL;
  if (pjRecorrente) {
    exigenciaPreparo = pjRecorrente.exigenciaRecursal;
  }

  if (pjs.temFazendaPublica && !partes.mptPresente) {
    alertas.push({
      tipo: 'MPT_PENDENTE',
      nivel: 'AVISO',
      texto: 'Fazenda Pública no polo sem intervenção registrada do MPT. Verificar necessidade de vista regimental ao Ministério Público.'
    });
  }

  return {
    rota: 'CONHECIMENTO',
    rito: cls.rito,
    ehSumarissimo,
    ehRemessa,
    ehAgravoInstrumento,
    exigenciaPreparo,
    alertas
  };
}
