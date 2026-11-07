import { classificarClasse, ROTA_TRIAGEM } from './classificadores/classes_trabalhistas.js';
import { classificarAssuntos } from './classificadores/assuntos_cnj.js';
import { diagnosticarPJsProcesso } from './classificadores/pessoas_juridicas.js';
import { estruturarPartesERepresentantes } from './classificadores/partes_representantes.js';
import { analisarGapAutos } from './classificadores/temporalidade_gap.js';
import { triarRecursoConhecimento } from './triagem/triagem_conhecimento.js';
import { triarRecursoExecucao } from './triagem/triagem_execucao.js';
import { identificarClustersPatronoAssunto } from './heuristicas/correlacao_patrono_assunto.js';
import { avaliarTempestividadeGrosseira } from './heuristicas/tempestividade_grosseira.js';
import { identificarSindicatos } from './classificadores/sindicatos.js';

/**
 * Hub Orquestrador Central de Triagem.
 * Processa um único registro bruto do PJe e produz o objeto enriquecido.
 */
export function enriquecerProcesso(registroBruto, configuracoes = {}) {
  const cnj = (registroBruto.cnj || (registroBruto.processo && registroBruto.processo.numero) || '').trim();
  const idProcesso = registroBruto.idProcesso || (registroBruto.processo && registroBruto.processo.id) || null;

  // 1. Classificação de Classe e Rota
  const classe = classificarClasse(registroBruto.processo || registroBruto.listagem || {});

  // 2. Classificação de Assuntos e Ramos CNJ
  const assuntos = classificarAssuntos(registroBruto.assuntos || (registroBruto.processo && registroBruto.processo.assuntos) || []);

  // 3. Classificação de Pessoas Jurídicas e Prerrogativas
  const pjs = diagnosticarPJsProcesso(registroBruto.partes || {}, configuracoes.termosFazenda);

  // 4. Estruturação de Partes, Patronos e MPT
  const partes = estruturarPartesERepresentantes(registroBruto.partes || {}, configuracoes.termosFazenda);

  // 4b. Identificação de Entidades Sindicais
  const sindicatos = identificarSindicatos(registroBruto.partes || {});

  // 5. Temporalidade e Gap de Autos
  const temporalidade = analisarGapAutos(registroBruto);

  // 6. Análise Preliminar de Tempestividade (se timeline de documentos estiver presente)
  const tempestividade = avaliarTempestividadeGrosseira(
    registroBruto.documentos || [],
    pjs.temFazendaPublica
  );

  const dadosBase = {
    cnj,
    idProcesso,
    raw: registroBruto,
    classe,
    assuntos,
    pjs,
    partes,
    sindicatos,
    temporalidade,
    tempestividade,
    dadosAcordaoAnterior: registroBruto.dadosAcordaoAnterior || null
  };

  // 7. Roteamento para o Motor Especializado
  let resultadoTriagem = null;
  if (classe.rota === ROTA_TRIAGEM.EXECUCAO) {
    resultadoTriagem = triarRecursoExecucao(dadosBase);
  } else {
    resultadoTriagem = triarRecursoConhecimento(dadosBase);
  }

  return Object.assign({}, dadosBase, { triagem: resultadoTriagem });
}

/**
 * Processa um lote completo de processos, executa correlação serial e consolida estatísticas.
 */
export function processarLoteTriagem(listaRegistrosBrutos, configuracoes = {}) {
  const processosEnriquecidos = [];
  const estatisticas = {
    total: 0,
    conhecimento: 0,
    execucao: 0,
    originaisOuOutras: 0,
    porClasse: {},
    fazendaPublicaTotal: 0,
    fazendaSemMpt: 0,
    comRecuperacaoJudicial: 0,
    comMassaFalida: 0,
    comSindicato: 0,
    processosFisicosMigrados: 0
  };

  for (const item of listaRegistrosBrutos) {
    if (!item || item.erro) continue;
    const proc = enriquecerProcesso(item, configuracoes);
    processosEnriquecidos.push(proc);

    estatisticas.total++;
    const sigla = proc.classe.sigla || 'OUTROS';
    estatisticas.porClasse[sigla] = (estatisticas.porClasse[sigla] || 0) + 1;

    if (proc.classe.rota === ROTA_TRIAGEM.EXECUCAO) {
      estatisticas.execucao++;
    } else if (proc.classe.rota === ROTA_TRIAGEM.CONHECIMENTO) {
      estatisticas.conhecimento++;
    } else {
      estatisticas.originaisOuOutras++;
    }

    if (proc.pjs.temFazendaPublica) {
      estatisticas.fazendaPublicaTotal++;
      if (!proc.partes.mptPresente) {
        estatisticas.fazendaSemMpt++;
      }
    }

    if (proc.pjs.temRecuperacaoJudicial) estatisticas.comRecuperacaoJudicial++;
    if (proc.pjs.temMassaFalida) estatisticas.comMassaFalida++;
    if (proc.sindicatos && proc.sindicatos.temSindicato) estatisticas.comSindicato++;
    if (proc.temporalidade.ehProcessoFisicoMigrado) estatisticas.processosFisicosMigrados++;
  }

  // 8. Heurística de Contencioso Serial em Lote
  const clustersSeriais = identificarClustersPatronoAssunto(processosEnriquecidos);

  return {
    processos: processosEnriquecidos,
    estatisticas,
    clustersSeriais
  };
}
