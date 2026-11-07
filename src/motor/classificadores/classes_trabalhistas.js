/**
 * Mapeamento e classificação das classes processuais da Justiça do Trabalho (2º Grau).
 * Baseado na Tabela Processual Unificada (TPU) do CNJ.
 */

export const ROTA_TRIAGEM = {
  CONHECIMENTO: 'CONHECIMENTO',
  EXECUCAO: 'EXECUCAO',
  ORIGINARIA: 'ORIGINARIA',
  INCIDENTAL: 'INCIDENTAL'
};

export const CLASSES_CNJ = {
  // --- FASE DE RECURSO DE CONHECIMENTO ---
  'ROT': {
    codigo: 1009,
    sigla: 'ROT',
    nome: 'Recurso Ordinário Trabalhista',
    rota: ROTA_TRIAGEM.CONHECIMENTO,
    rito: 'ORDINARIO',
    descricao: 'Recurso ordinário contra decisões terminativas de 1º grau no rito comum.'
  },
  'RORSum': {
    codigo: 11993,
    sigla: 'RORSum',
    nome: 'Recurso Ordinário - Rito Sumaríssimo',
    rota: ROTA_TRIAGEM.CONHECIMENTO,
    rito: 'SUMARISSIMO',
    descricao: 'Recurso ordinário em procedimento sumaríssimo (art. 852-A CLT).'
  },
  'AIRO': {
    codigo: 1003,
    sigla: 'AIRO',
    nome: 'Agravo de Instrumento em Recurso Ordinário',
    rota: ROTA_TRIAGEM.CONHECIMENTO,
    rito: 'INSTRUMENTAL',
    descricao: 'Destinado a destrancar Recurso Ordinário denegado na origem.'
  },
  'RemNecRO': {
    codigo: 12048,
    sigla: 'RemNecRO',
    nome: 'Remessa Necessária / Recurso Ordinário Trabalhista',
    rota: ROTA_TRIAGEM.CONHECIMENTO,
    rito: 'REMESSA_NECESSARIA',
    descricao: 'Duplo grau obrigatório conjugado a recurso voluntário.'
  },
  'RemNec': {
    codigo: 199,
    sigla: 'RemNec',
    nome: 'Remessa Necessária Cível',
    rota: ROTA_TRIAGEM.CONHECIMENTO,
    rito: 'REMESSA_NECESSARIA',
    descricao: 'Duplo grau obrigatório exclusivo sem recurso voluntário.'
  },
  'RO': {
    codigo: 1009,
    sigla: 'RO',
    nome: 'Recurso Ordinário (Legado)',
    rota: ROTA_TRIAGEM.CONHECIMENTO,
    rito: 'ORDINARIO',
    descricao: 'Nomenclatura residual do Recurso Ordinário.'
  },

  // --- FASE DE RECURSO DE EXECUÇÃO ---
  'AP': {
    codigo: 1004,
    sigla: 'AP',
    nome: 'Agravo de Petição',
    rota: ROTA_TRIAGEM.EXECUCAO,
    rito: 'EXECUCAO',
    descricao: 'Recurso cabível contra decisões do juiz na fase de execução (art. 897, a, CLT).'
  },
  'AIAP': {
    codigo: 1003,
    sigla: 'AIAP',
    nome: 'Agravo de Instrumento em Agravo de Petição',
    rota: ROTA_TRIAGEM.EXECUCAO,
    rito: 'INSTRUMENTAL',
    descricao: 'Destinado a destrancar Agravo de Petição denegado na origem.'
  },
  'CPEx': {
    codigo: 261,
    sigla: 'CPEx',
    nome: 'Carta Precatória Executória',
    rota: ROTA_TRIAGEM.EXECUCAO,
    rito: 'PRECATORIA',
    descricao: 'Execução de atos por juízo deprecado.'
  },

  // --- AÇÕES ORIGINÁRIAS / COLETIVAS ---
  'MSCiv': {
    codigo: 119,
    sigla: 'MSCiv',
    nome: 'Mandado de Segurança Cível',
    rota: ROTA_TRIAGEM.ORIGINARIA,
    rito: 'MANDAMENTAL',
    descricao: 'Ação originária de mandado de segurança contra ato de autoridade.'
  },
  'MS': {
    codigo: 119,
    sigla: 'MS',
    nome: 'Mandado de Segurança (Legado)',
    rota: ROTA_TRIAGEM.ORIGINARIA,
    rito: 'MANDAMENTAL',
    descricao: 'Mandado de segurança de competência originária.'
  },
  'AR': {
    codigo: 47,
    sigla: 'AR',
    nome: 'Ação Rescisória',
    rota: ROTA_TRIAGEM.ORIGINARIA,
    rito: 'RESCISORIA',
    descricao: 'Ação autônoma de impugnação de decisão transitada em julgado.'
  },
  'TutCautAnt': {
    codigo: 12025,
    sigla: 'TutCautAnt',
    nome: 'Tutela Cautelar Antecedente',
    rota: ROTA_TRIAGEM.ORIGINARIA,
    rito: 'CAUTELAR',
    descricao: 'Procedimento antecedente para tutela cautelar em 2º grau.'
  },

  // --- RECURSOS INTERNOS / INCIDENTAIS ---
  'AgR': {
    codigo: 1248,
    sigla: 'AgR',
    nome: 'Agravo Regimental',
    rota: ROTA_TRIAGEM.INCIDENTAL,
    rito: 'REGIMENTAL',
    descricao: 'Recurso contra decisão monocrática de Relator para o Colegiado.'
  },
  'Ag': {
    codigo: 1248,
    sigla: 'Ag',
    nome: 'Agravo Interno',
    rota: ROTA_TRIAGEM.INCIDENTAL,
    rito: 'REGIMENTAL',
    descricao: 'Agravo interno CPC/RI.'
  },
  'ED': {
    codigo: 1238,
    sigla: 'ED',
    nome: 'Embargos de Declaração',
    rota: ROTA_TRIAGEM.INCIDENTAL,
    rito: 'DECLARATORIO',
    descricao: 'Embargos para sanar omissão, contradição ou obscuridade.'
  }
};

/**
 * Classifica a classe do processo a partir da sigla ou objeto de processo.
 * Se a sigla for desconhecida, faz inferência dinâmica para evitar falhas com novas classes.
 */
export function classificarClasse(processoOuSigla) {
  let sigla = '';
  let codigo = null;
  let descricaoOriginal = '';

  if (typeof processoOuSigla === 'string') {
    sigla = processoOuSigla.trim();
  } else if (processoOuSigla && typeof processoOuSigla === 'object') {
    const c = processoOuSigla.classeJudicial || processoOuSigla;
    sigla = (c.sigla || c.classeJudicial || '').trim();
    codigo = c.codigo || c.id || null;
    descricaoOriginal = c.descricao || '';
  }

  const definida = CLASSES_CNJ[sigla];
  if (definida) {
    return Object.assign({}, definida, {
      siglaReal: sigla,
      codigoReal: codigo || definida.codigo,
      desconhecida: false
    });
  }

  // Inferência dinâmica para siglas não cadastradas
  const siglaUpper = sigla.toUpperCase();
  let rota = ROTA_TRIAGEM.CONHECIMENTO;
  if (siglaUpper.includes('AP') || siglaUpper.includes('EXEC')) {
    rota = ROTA_TRIAGEM.EXECUCAO;
  } else if (siglaUpper.includes('MS') || siglaUpper.includes('RESC') || siglaUpper.includes('DC')) {
    rota = ROTA_TRIAGEM.ORIGINARIA;
  } else if (siglaUpper.includes('ED') || siglaUpper.includes('AGR')) {
    rota = ROTA_TRIAGEM.INCIDENTAL;
  }

  return {
    codigo: codigo || 0,
    sigla: sigla || 'OUTROS',
    nome: descricaoOriginal || sigla || 'Classe Não Catalogada',
    rota,
    rito: 'GENERICO',
    descricao: descricaoOriginal,
    desconhecida: true
  };
}
