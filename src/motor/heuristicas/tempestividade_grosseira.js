/**
 * Módulo preliminar de triagem temporal: análise grosseira de tempestividade.
 * NÃO substitui a contagem legal de prazos (que depende do DJEN e feriados locais);
 * serve exclusivamente como sinalizador de anomalias gritantes na linha do tempo.
 */

export function avaliarTempestividadeGrosseira(documentosArray, ehFazendaPublica = false) {
  if (!Array.isArray(documentosArray) || documentosArray.length === 0) {
    return {
      analisado: false,
      flagAlerta: false,
      motivo: 'Timeline de documentos ausente ou incompleta.'
    };
  }

  // Identifica peças relevantes
  let certidaoPublicacao = null;
  let pecaRecursal = null;

  for (const doc of documentosArray) {
    const desc = (doc.descricao || doc.tipo || doc.titulo || '').toUpperCase();
    const dt = doc.juntadoEm || doc.dataInclusao || doc.criadoEm;

    if (!dt) continue;

    if (!certidaoPublicacao && (desc.includes('PUBLICACAO') || desc.includes('INTIMACAO') || desc.includes('NOTIFICACAO'))) {
      certidaoPublicacao = { doc, data: new Date(dt), desc };
    }

    if (!pecaRecursal && (desc.includes('AGRAVO DE PETICAO') || desc.includes('RECURSO ORDINARIO') || desc.includes('RAZOES DE RECURSO'))) {
      pecaRecursal = { doc, data: new Date(dt), desc };
    }
  }

  if (!certidaoPublicacao || !pecaRecursal) {
    return {
      analisado: false,
      flagAlerta: false,
      motivo: 'Não foi possível correlacionar a certidão de expediente com a peça recursal.'
    };
  }

  const msPorDia = 1000 * 60 * 60 * 24;
  const diasCorridos = Math.round((pecaRecursal.data - certidaoPublicacao.data) / msPorDia);

  // Limites amplos com margem de segurança para feriados/recesso
  const limiteTolerancia = ehFazendaPublica ? 45 : 30;
  const flagAlerta = diasCorridos > limiteTolerancia;

  let motivo = `Intervalo de ${diasCorridos} dias corridos entre a juntada da certidão (${certidaoPublicacao.data.toLocaleDateString('pt-BR')}) e a juntada do recurso (${pecaRecursal.data.toLocaleDateString('pt-BR')}).`;

  if (flagAlerta) {
    motivo += ` Atenção: ultrapassou a margem de segurança preliminar (${limiteTolerancia} dias). Exige conferência da data real de publicação no DJEN dentro do PDF.`;
  }

  return {
    analisado: true,
    flagAlerta,
    diasCorridos,
    limiteTolerancia,
    motivo,
    badge: flagAlerta ? 'FLAG: CONFERIR DJEN NO PDF' : 'TEMPO APARENTE REGULAR'
  };
}
