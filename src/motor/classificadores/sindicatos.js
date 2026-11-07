import { normaliza } from './utils_texto.js';

/**
 * Termos e expressões regulares para detecção de entidades sindicais
 * (Sindicatos, Federações, Confederações e Associações de Categoria Profissional/Econômica).
 */
const PADROES_SINDICATO = [
  /\bSINDICATO\b/,
  /\bFEDERACAO\b/,
  /\bCONFEDERACAO\b/,
  /\bSIND\b/,
  /\bSINPRO\b/,
  /\bSINPEEM\b/,
  /\bSINDIFICIOS\b/,
  /\bSINDESP\b/,
  /\bSINDISAN\b/,
  /\bSINDMOTO\b/,
  /\bSETHCO\b/,
  /\bSIEEESP\b/,
  /\bFEQUIMFAR\b/,
  /\bFENTECT\b/,
  /\bFUP\b/,
  /\bCUT\b/,
  /\bFORCA SINDICAL\b/,
  /\bUGT\b/,
  /\bCTB\b/
];

/**
 * Identifica se alguma das partes do processo é sindicato, federação ou confederação.
 * @param {Object|Array} partesDictOuArray
 * @returns {Object} { temSindicato: boolean, sindicatos: Array, rotulo: string }
 */
export function identificarSindicatos(partesDictOuArray) {
  const listaPartes = [];

  if (Array.isArray(partesDictOuArray)) {
    for (const p of partesDictOuArray) {
      listaPartes.push(p);
    }
  } else if (partesDictOuArray && typeof partesDictOuArray === 'object') {
    for (const polo of Object.keys(partesDictOuArray)) {
      const lista = partesDictOuArray[polo] || [];
      for (const p of lista) {
        listaPartes.push(Object.assign({}, p, { poloOriginal: polo }));
      }
    }
  }

  const sindicatosEncontrados = [];

  for (const p of listaPartes) {
    const nome = (p.nome || '').trim();
    const nomeNorm = normaliza(nome);
    const tipo = (p.tipo || '').trim().toUpperCase();
    const poloOrig = (p.poloOriginal || p.polo || '').toLowerCase();

    // Verifica se bate com algum dos padrões de entidade sindical
    const ehSindicato = PADROES_SINDICATO.some(rx => rx.test(nomeNorm));

    if (ehSindicato) {
      sindicatosEncontrados.push({
        nome,
        cnpj: p.numeroDocumento || p.cnpj || p.cpf || null,
        polo: poloOrig,
        tipo: tipo || 'ENTIDADE SINDICAL'
      });
    }
  }

  const temSindicato = sindicatosEncontrados.length > 0;
  let rotulo = null;

  if (temSindicato) {
    const polos = Array.from(new Set(sindicatosEncontrados.map(s => s.polo || 'indefinido')));
    rotulo = `Sindicato (${polos.join('/')})`;
  }

  return {
    temSindicato,
    sindicatos: sindicatosEncontrados,
    rotulo
  };
}
