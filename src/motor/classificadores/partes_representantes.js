import { carregarTermosPadrao } from './pessoas_juridicas.js';
import { normaliza } from './utils_texto.js';

/**
 * Valida se um número de OAB possui formato legítimo (ao menos 3 caracteres e ao menos 1 dígito numérico).
 * @param {string} oab
 * @returns {boolean}
 */
export function validarNumeroOab(oab) {
  if (!oab || typeof oab !== 'string') return false;
  const limpo = oab.trim().toUpperCase();
  return limpo.length >= 3 && /\d/.test(limpo);
}

/**
 * Processa e estrutura as partes, advogados e intervenção ministerial.
 */
export function estruturarPartesERepresentantes(partesDictOuArray, termosConfig = null) {
  const cfg = termosConfig || carregarTermosPadrao();
  const partes = [];

  if (Array.isArray(partesDictOuArray)) {
    for (const p of partesDictOuArray) {
      partes.push(p);
    }
  } else if (partesDictOuArray && typeof partesDictOuArray === 'object') {
    for (const polo of Object.keys(partesDictOuArray)) {
      const lista = partesDictOuArray[polo] || [];
      for (const p of lista) {
        partes.push(Object.assign({}, p, { poloOriginal: polo }));
      }
    }
  }

  const ativos = [];
  const passivos = [];
  const terceiros = [];
  const patronos = new Map(); // OAB -> { numeroOab, nome, partesRepresentadas: [] }
  let mptPresente = false;
  let mptNome = null;

  for (const p of partes) {
    const nome = (p.nome || '').trim();
    const nomeNorm = normaliza(nome);
    const tipo = (p.tipo || '').trim().toUpperCase();
    const poloOrig = (p.poloOriginal || p.polo || '').toLowerCase();

    // Detecção de MPT
    const ehCustosLegis = tipo === 'CUSTOS LEGIS' || tipo.includes('MINISTERIO PUBLICO') || tipo.includes('PROCURADORIA DO TRABALHO');
    const bateMptTexto = cfg.regexMpt && cfg.regexMpt.some(rx => rx.test(nomeNorm));

    if (ehCustosLegis || bateMptTexto) {
      mptPresente = true;
      if (!mptNome) {
        mptNome = nome + (p.tipo ? ` (${p.tipo})` : '');
      }
    }

    // Normaliza documento e CNPJ da parte
    const docOriginal = p.documento || p.numeroDocumento || p.cnpj || p.cpf || (p.pessoaJuridica && p.pessoaJuridica.cnpj) || null;
    p.documento = docOriginal;
    p.cnpj = (docOriginal && docOriginal.includes('/')) ? docOriginal : (p.pessoaJuridica && p.pessoaJuridica.cnpj) || null;

    if (poloOrig === 'ativo') {
      ativos.push(p);
    } else if (poloOrig === 'passivo') {
      passivos.push(p);
    } else {
      terceiros.push(p);
    }

    // Advogados / Representantes (Identificação por cadastro de OAB válido sem expor nomes de pessoas)
    const reps = p.representantes || [];
    for (const r of reps) {
      const oab = (r.numeroOab || '').trim().toUpperCase();
      if (!validarNumeroOab(oab)) continue;

      if (!patronos.has(oab)) {
        patronos.set(oab, {
          numeroOab: oab,
          nome: `OAB ${oab}`,
          partesRepresentadas: [nome]
        });
      } else {
        const item = patronos.get(oab);
        if (!item.partesRepresentadas.includes(nome)) {
          item.partesRepresentadas.push(nome);
        }
      }
    }
  }

  // Resumo visual de partes (ex: "AUTOR x REU" ou "ENTE PUBLICO e mais N")
  const nomeAtivoPrincipal = ativos[0] ? ativos[0].nome : 'Polo Ativo';
  const nomePassivoPrincipal = passivos[0] ? passivos[0].nome : 'Polo Passivo';
  
  let rotuloAtivo = nomeAtivoPrincipal;
  if (ativos.length > 1) {
    rotuloAtivo += ` e mais ${ativos.length - 1}`;
  }

  let rotuloPassivo = nomePassivoPrincipal;
  if (passivos.length > 1) {
    rotuloPassivo += ` e mais ${passivos.length - 1}`;
  }

  const tituloPartes = `${rotuloAtivo}  ×  ${rotuloPassivo}`;

  return {
    totalPartes: partes.length,
    ativos,
    passivos,
    terceiros,
    patronos: Array.from(patronos.values()),
    mptPresente,
    mptNome: mptNome || (mptPresente ? 'Ministério Público do Trabalho' : null),
    tituloPartes,
    nomeAtivoPrincipal,
    nomePassivoPrincipal
  };
}

/**
 * Retorna os rótulos contextuais dos polos de acordo com a classe e rota do processo,
 * evitando o uso estático de "Ativo / Passivo".
 * @param {string} siglaClasse - Ex: 'RO', 'ROT', 'ROMSum', 'AP', 'AIAP', 'MSCiv'
 * @param {string} rota - Ex: 'CONHECIMENTO', 'EXECUCAO', 'ORIGINARIA'
 * @returns {{ poloAtivoRotulo: string, poloPassivoRotulo: string }}
 */
export function obterRotulosPolosContextuais(siglaClasse = '', rota = '') {
  const sigla = (siglaClasse || '').toUpperCase().trim();
  const rotaUpper = (rota || '').toUpperCase().trim();

  // 1. Agravos (Agravo de Petição, Agravo de Instrumento, Agravo Interno/Regimental)
  if (
    sigla === 'AP' || 
    sigla.startsWith('AI') || 
    sigla.startsWith('AG') || 
    sigla.includes('AGRAVO')
  ) {
    return {
      poloAtivoRotulo: 'Agravante',
      poloPassivoRotulo: 'Agravado(a)'
    };
  }

  // 2. Recursos Ordinários e Recursos em Geral no 2º Grau
  if (
    sigla === 'RO' || 
    sigla === 'ROT' || 
    sigla === 'ROMSUM' || 
    sigla === 'RECORD' || 
    sigla.startsWith('RO')
  ) {
    return {
      poloAtivoRotulo: 'Recorrente',
      poloPassivoRotulo: 'Recorrido(a)'
    };
  }

  // 3. Embargos de Declaração
  if (sigla.includes('ED') || sigla.includes('EMBARGO')) {
    return {
      poloAtivoRotulo: 'Embargante',
      poloPassivoRotulo: 'Embargado(a)'
    };
  }

  // 4. Mandado de Segurança
  if (sigla.startsWith('MS') || sigla.includes('MANDADO')) {
    return {
      poloAtivoRotulo: 'Impetrante',
      poloPassivoRotulo: 'Impetrado(a)'
    };
  }

  // 5. Originárias e Ações em 1º Grau (PetCiv, AçCiv, ACP, etc.)
  if (
    rotaUpper === 'ORIGINARIA' || 
    sigla.startsWith('PET') || 
    sigla.startsWith('AC') || 
    sigla.includes('CIV') || 
    sigla.includes('TRAB')
  ) {
    return {
      poloAtivoRotulo: 'Reclamante',
      poloPassivoRotulo: 'Reclamada'
    };
  }

  // Padrão de 2º Grau (quase sempre é recursal)
  return {
    poloAtivoRotulo: 'Recorrente',
    poloPassivoRotulo: 'Recorrido(a)'
  };
}

