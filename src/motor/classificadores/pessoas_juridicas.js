import { DADOS_TERMOS_FAZENDA } from '../dados/termos_fazenda.js';
import { normaliza, normalizaRegexPattern } from './utils_texto.js';

export const CATEGORIA_PJ = {
  FAZENDA_PUBLICA: 'FAZENDA_PUBLICA',
  ESTATAL_REGIME_COMUM: 'ESTATAL_REGIME_COMUM',
  RECUPERACAO_JUDICIAL: 'RECUPERACAO_JUDICIAL',
  MASSA_FALIDA: 'MASSA_FALIDA',
  FILANTROPICA: 'FILANTROPICA',
  PRIVADA_COMUM: 'PRIVADA_COMUM'
};

export const EXIGENCIA_RECURSAL = {
  PREPARO_ISENTO_TOTAL: 'PREPARO_ISENTO_TOTAL',
  ISENCAO_DEPOSITO_CUSTAS_DEVIDAS: 'ISENCAO_DEPOSITO_CUSTAS_DEVIDAS',
  DEPOSITO_PELA_METADE: 'DEPOSITO_PELA_METADE',
  PREPARO_INTEGRAL: 'PREPARO_INTEGRAL'
};

export const PRERROGATIVA_PRAZO = {
  DOBRO: 'DOBRO',
  SIMPLES: 'SIMPLES'
};

const RX_RECUPERACAO_JUDICIAL = /\b(RECUPERACAO\s+JUDICIAL|EM\s+RECUPERACAO|RECUPERANDA)\b/i;
const RX_MASSA_FALIDA = /\b(MASSA\s+FALIDA|FALIDA|FALIDO|FALENCIA)\b/i;
const RX_FILANTROPICA = /\b(SANTA\s+CASA|BENEFICENTE|FILANTROPICA|CRUZ\s+VERMELHA|APAE)\b/i;

const RX_ESTATAIS_COMUNS = [
  /\bBANCO\s+DO\s+BRASIL\b/i,
  /\bPETROBRAS\b/i,
  /\bPETROLEO\s+BRASILEIRO\b/i,
  /\bCAIXA\s+ECONOMICA\s+FEDERAL\b/i
];

function linhasParaRegex(linhas) {
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  return (linhas || []).map(l => l.trim()).filter(Boolean).map(l => new RegExp(normalizaRegexPattern(l), 'i'));
}

let cacheRegex = null;

export function carregarTermosPadrao() {
  if (cacheRegex) return cacheRegex;

  const dados = (typeof DADOS_TERMOS_FAZENDA !== 'undefined') ? DADOS_TERMOS_FAZENDA : { termosA: [], termosB: [], termosVeto: [], termosMpt: [] };
  cacheRegex = {
    regexA: linhasParaRegex(dados.termosA),
    regexB: linhasParaRegex(dados.termosB),
    regexVeto: linhasParaRegex(dados.termosVeto),
    regexMpt: linhasParaRegex(dados.termosMpt)
  };
  return cacheRegex;
}

export function classificarPartePJ(parte, configuracaoTermos = null) {
  const cfg = configuracaoTermos || carregarTermosPadrao();
  const nome = (parte && parte.nome ? parte.nome : '').trim();
  const nomeNorm = normaliza(nome);
  const tipoParte = (parte && parte.tipo ? parte.tipo : '').toUpperCase();

  const bateA = cfg.regexA.some(rx => rx.test(nomeNorm));
  const bateB = cfg.regexB.some(rx => rx.test(nomeNorm));
  const bateVeto = cfg.regexVeto.some(rx => rx.test(nomeNorm));
  const ehFazenda = bateB || (bateA && !bateVeto);

  if (ehFazenda) {
    return {
      categoria: CATEGORIA_PJ.FAZENDA_PUBLICA,
      nome,
      tipo: tipoParte,
      poloOriginal: parte.poloOriginal || parte.polo || '',
      prerrogativaPrazo: PRERROGATIVA_PRAZO.DOBRO,
      exigenciaRecursal: EXIGENCIA_RECURSAL.PREPARO_ISENTO_TOTAL,
      detalhes: 'Isenção integral de custas (CLT art. 790-A) e depósito recursal (DL 779/69); prazo em dobro (CPC art. 183).'
    };
  }

  const ehEstatalComum = RX_ESTATAIS_COMUNS.some(rx => rx.test(nomeNorm));
  if (ehEstatalComum) {
    return {
      categoria: CATEGORIA_PJ.ESTATAL_REGIME_COMUM,
      nome,
      tipo: tipoParte,
      poloOriginal: parte.poloOriginal || parte.polo || '',
      prerrogativaPrazo: PRERROGATIVA_PRAZO.SIMPLES,
      exigenciaRecursal: EXIGENCIA_RECURSAL.PREPARO_INTEGRAL,
      detalhes: 'Empresa estatal em regime concorrencial comum (CF art. 173, § 1º, II): sem prazo em dobro e sem isenção de preparo.'
    };
  }

  if (RX_MASSA_FALIDA.test(nomeNorm)) {
    return {
      categoria: CATEGORIA_PJ.MASSA_FALIDA,
      nome,
      tipo: tipoParte,
      poloOriginal: parte.poloOriginal || parte.polo || '',
      prerrogativaPrazo: PRERROGATIVA_PRAZO.SIMPLES,
      exigenciaRecursal: EXIGENCIA_RECURSAL.PREPARO_ISENTO_TOTAL,
      detalhes: 'Massa falida: isenção integral de depósito recursal e custas (Súmula nº 86 do TST).'
    };
  }

  if (RX_RECUPERACAO_JUDICIAL.test(nomeNorm)) {
    return {
      categoria: CATEGORIA_PJ.RECUPERACAO_JUDICIAL,
      nome,
      tipo: tipoParte,
      poloOriginal: parte.poloOriginal || parte.polo || '',
      prerrogativaPrazo: PRERROGATIVA_PRAZO.SIMPLES,
      exigenciaRecursal: EXIGENCIA_RECURSAL.ISENCAO_DEPOSITO_CUSTAS_DEVIDAS,
      detalhes: 'Empresa em recuperação judicial: isenta apenas do depósito recursal (CLT art. 899, § 10); recolhimento de custas permanece obrigatório.'
    };
  }

  if (RX_FILANTROPICA.test(nomeNorm)) {
    return {
      categoria: CATEGORIA_PJ.FILANTROPICA,
      nome,
      tipo: tipoParte,
      poloOriginal: parte.poloOriginal || parte.polo || '',
      prerrogativaPrazo: PRERROGATIVA_PRAZO.SIMPLES,
      exigenciaRecursal: EXIGENCIA_RECURSAL.ISENCAO_DEPOSITO_CUSTAS_DEVIDAS,
      detalhes: 'Entidade filantrópica: isenta do depósito recursal (CLT art. 899, § 10).'
    };
  }

  return {
    categoria: CATEGORIA_PJ.PRIVADA_COMUM,
    nome,
    tipo: tipoParte,
    poloOriginal: parte.poloOriginal || parte.polo || '',
    prerrogativaPrazo: PRERROGATIVA_PRAZO.SIMPLES,
    exigenciaRecursal: EXIGENCIA_RECURSAL.PREPARO_INTEGRAL,
    detalhes: 'Sociedade de direito privado comum: preparo integral (custas + depósito recursal).'
  };
}

export function diagnosticarPJsProcesso(partesArrayOuObjeto, configuracaoTermos = null) {
  let partes = [];
  if (Array.isArray(partesArrayOuObjeto)) {
    partes = partesArrayOuObjeto;
  } else if (partesArrayOuObjeto && typeof partesArrayOuObjeto === 'object') {
    for (const polo of Object.keys(partesArrayOuObjeto)) {
      const lista = partesArrayOuObjeto[polo] || [];
      for (const p of lista) {
        partes.push(Object.assign({}, p, { poloOriginal: polo }));
      }
    }
  }

  const classificadas = partes.map(p => classificarPartePJ(p, configuracaoTermos));
  const entesFazenda = classificadas.filter(p => p.categoria === CATEGORIA_PJ.FAZENDA_PUBLICA);
  const recJudicial = classificadas.filter(p => p.categoria === CATEGORIA_PJ.RECUPERACAO_JUDICIAL);
  const massasFalidas = classificadas.filter(p => p.categoria === CATEGORIA_PJ.MASSA_FALIDA);
  const estataisComuns = classificadas.filter(p => p.categoria === CATEGORIA_PJ.ESTATAL_REGIME_COMUM);

  return {
    totalPartes: partes.length,
    temFazendaPublica: entesFazenda.length > 0,
    temRecuperacaoJudicial: recJudicial.length > 0,
    temMassaFalida: massasFalidas.length > 0,
    temEstatalComum: estataisComuns.length > 0,
    temPrazoEmDobro: entesFazenda.length > 0,
    partesClassificadas: classificadas,
    entesFazenda: entesFazenda.map(e => ({ nome: e.nome, tipo: e.tipo, polo: e.poloOriginal })),
    recuperandas: recJudicial.map(r => r.nome),
    falidas: massasFalidas.map(f => f.nome)
  };
}
