import { validarNumeroOab } from '../classificadores/partes_representantes.js';

/**
 * Heurística de correlação serial: identifica padrões de processos semelhantes
 * onde o mesmo cadastro de OAB patrocina múltiplos processos com cesta idêntica/semelhante de assuntos,
 * cruzando também eventual coincidência de reclamada no polo passivo.
 */
export function identificarClustersPatronoAssunto(processosEnriquecidos) {
  const mapaExato = new Map(); // "oab__assinatura" -> [processos]
  const mapaPorPatrono = new Map(); // "oab" -> [processos]

  for (const proc of processosEnriquecidos) {
    const patronos = (proc.partes && proc.partes.patronos) || [];
    const assinatura = (proc.assuntos && proc.assuntos.assinaturaTematica) || 'SEM_ASSUNTOS';

    for (const pat of patronos) {
      const oab = (pat.numeroOab || '').trim().toUpperCase();
      // Ignora patronos sem número válido de OAB para evitar falsos agrupamentos
      if (!validarNumeroOab(oab)) continue;

      // Agrupamento por patrono
      if (!mapaPorPatrono.has(oab)) {
        mapaPorPatrono.set(oab, {
          patrono: pat,
          processos: []
        });
      }
      mapaPorPatrono.get(oab).processos.push(proc);

      // Agrupamento exato: patrono + matérias idênticas
      const chaveExata = `${oab}__${assinatura}`;
      if (!mapaExato.has(chaveExata)) {
        mapaExato.set(chaveExata, {
          chave: chaveExata,
          oabKey: oab,
          patrono: pat,
          assinatura,
          assuntosNomes: (proc.assuntos && proc.assuntos.itens.map(a => a.nome)) || [],
          processos: []
        });
      }
      mapaExato.get(chaveExata).processos.push(proc);
    }
  }

  // Filtra apenas clusters com 2 ou mais processos
  const clustersSeriais = [];
  for (const [chave, dados] of mapaExato.entries()) {
    if (dados.processos.length >= 2 && dados.assinatura !== 'SEM_ASSUNTOS') {
      const processosRelacionados = dados.processos.map(p => ({
        cnj: p.cnj,
        siglaClasse: (p.classe && p.classe.sigla) || 'OUTROS',
        tituloPartes: (p.partes && p.partes.tituloPartes) || 'Partes não informadas'
      }));

      // Determinação das razões do agrupamento
      const razoes = ['mesmo cadastro de OAB'];

      // Verificação de assuntos (idênticos vs semelhantes)
      const todasAssinaturasIguais = dados.processos.every(p => 
        p.assuntos && p.assuntos.assinaturaTematica === dados.assinatura
      );
      if (todasAssinaturasIguais) {
        razoes.push('assuntos idênticos');
      } else {
        razoes.push('assuntos semelhantes');
      }

      // Verificação de mesma reclamada no polo passivo
      const conjuntosReclamadas = dados.processos.map(p => {
        const passivos = (p.partes && p.partes.passivos) || [];
        const recs = new Set();
        for (const r of passivos) {
          const doc = (r.documento || r.cnpj || '').trim();
          const nome = (r.nome || '').trim().toUpperCase();
          if (doc) recs.add(doc);
          if (nome) recs.add(nome);
        }
        return recs;
      });

      let temMesmaReclamada = false;
      if (conjuntosReclamadas.length >= 2) {
        const primeiro = conjuntosReclamadas[0];
        for (const rec of primeiro) {
          if (conjuntosReclamadas.slice(1).every(c => c.has(rec))) {
            temMesmaReclamada = true;
            break;
          }
        }
      }

      if (temMesmaReclamada) {
        razoes.push('mesma reclamada');
      }

      const motivo = `Agrupado em razão de:\n• ${razoes.join('\n• ')}`;
      const rotulo = `Processos semelhantes: ${dados.processos.length} processos (${razoes.join(', ')})`;

      const clusterItem = {
        idCluster: chave,
        patronoNome: 'mesmo cadastro de OAB',
        numeroOab: dados.oabKey,
        qtdProcessos: dados.processos.length,
        cnjs: dados.processos.map(p => p.cnj),
        processosRelacionados,
        assuntosResumo: dados.assuntosNomes.slice(0, 3).join(', ') + (dados.assuntosNomes.length > 3 ? ` (+${dados.assuntosNomes.length - 3})` : ''),
        rotulo,
        motivo,
        razoes
      };
      clustersSeriais.push(clusterItem);

      // Marca diretamente os processos pertencentes a este lote
      for (const p of dados.processos) {
        p.ehProcessosSemelhantes = true;
        p.ehContenciosoEmEscala = true; // alias de compatibilidade
        p.clusterEscala = clusterItem;
      }
    }
  }

  // Ordena clusters com mais processos primeiro
  clustersSeriais.sort((a, b) => b.qtdProcessos - a.qtdProcessos);

  return {
    totalClustersSeriais: clustersSeriais.length,
    clusters: clustersSeriais,
    totalProcessosEmLoteSerial: clustersSeriais.reduce((acc, c) => acc + c.qtdProcessos, 0)
  };
}
