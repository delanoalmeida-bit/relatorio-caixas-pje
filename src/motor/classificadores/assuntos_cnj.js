// Catálogo TPU (500 KB) removido: a API do PJe já traz descrição e caminho do assunto.

let catalogoAssuntos = null;

function getCatalogo() {
  if (catalogoAssuntos) return catalogoAssuntos;
  catalogoAssuntos = {};
  return catalogoAssuntos;
}

/**
 * Normaliza e classifica os assuntos de um processo.
 * Gera lista estruturada, ramo principal e assinatura temática (para correlação serial).
 */
export function classificarAssuntos(processoOuAssuntos, catalogoCustom = null) {
  const catalogo = catalogoCustom || getCatalogo();
  let rawAssuntos = [];

  if (Array.isArray(processoOuAssuntos)) {
    rawAssuntos = processoOuAssuntos;
  } else if (processoOuAssuntos && processoOuAssuntos.assuntos) {
    rawAssuntos = processoOuAssuntos.assuntos;
  }

  const assuntos = [];
  const codigos = new Set();
  const ramos = new Set();
  let principal = null;

  for (const item of rawAssuntos) {
    if (!item) continue;
    const a = item.assunto || item;
    const cod = String(a.codigo || item.idAssunto || item.id || '').trim();
    const descOriginal = a.descricao || a.assuntoResumido || item.descricao || '';
    const isPrincipal = Boolean(item.principal || a.principal);

    const infoTpu = catalogo[cod] || null;
    const nome = (infoTpu && infoTpu.nome) || descOriginal || `Assunto ${cod}`;
    const ramo = (infoTpu && infoTpu.ramo) || 'Direito do Trabalho';
    const caminho = (infoTpu && infoTpu.caminho) || [nome];

    const normalizado = {
      codigo: cod,
      nome,
      ramo,
      caminho,
      principal: isPrincipal
    };

    assuntos.push(normalizado);
    if (cod) codigos.add(cod);
    if (ramo) ramos.add(ramo);

    if (isPrincipal && !principal) {
      principal = normalizado;
    }
  }

  if (!principal && assuntos.length > 0) {
    principal = assuntos[0];
  }

  // Assinatura temática: códigos ordenados para identificar clusters idênticos
  const codigosOrdenados = Array.from(codigos).sort((a, b) => {
    const na = parseInt(a, 10) || 0;
    const nb = parseInt(b, 10) || 0;
    return na - nb;
  });
  const assinaturaTematica = codigosOrdenados.join(':');

  return {
    total: assuntos.length,
    itens: assuntos,
    principal: principal || { codigo: '', nome: 'Não especificado', ramo: 'Geral', caminho: [] },
    ramos: Array.from(ramos),
    assinaturaTematica,
    ehExecucao: ramos.has('Liquidação / Cumprimento / Execução') || assuntos.some(a => a.nome.toLowerCase().includes('execução') || a.nome.toLowerCase().includes('penhora'))
  };
}
