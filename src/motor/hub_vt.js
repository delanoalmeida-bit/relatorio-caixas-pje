import { classificarAssuntos } from './classificadores/assuntos_cnj.js';
import { diagnosticarPJsProcesso } from './classificadores/pessoas_juridicas.js';
import { estruturarPartesERepresentantes } from './classificadores/partes_representantes.js';
import { analisarGapAutos } from './classificadores/temporalidade_gap.js';
import { identificarSindicatos } from './classificadores/sindicatos.js';

/*
 * Motor do 1º grau (Varas do Trabalho). Reaproveita os classificadores do projeto original
 * (partes, OAB, Fazenda, sindicato, assuntos, processo físico) e troca as regras de recurso
 * (preparo, tempestividade, MPT) por dados de gestão da caixa: fase, tarefa, tempo parado,
 * responsável, prioridade legal e prazo expirado.
 */

const DIA_MS = 86400000;
const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();

/** "Conhecimento" | "Liquidação" | "Execução" | outro texto do PJe | "não informada". */
export function faseDoProcesso(registro) {
  const l = registro.listagem || {};
  const p = registro.processo || {};
  const bruta = limpar(l.faseProcessual || p.labelFaseProcessual || p.faseProcessual);
  if (!bruta) return 'não informada';
  const n = bruta.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (n.startsWith('CONHEC')) return 'Conhecimento';
  if (n.startsWith('LIQUID')) return 'Liquidação';
  if (n.startsWith('EXEC')) return 'Execução';
  return bruta.charAt(0).toUpperCase() + bruta.slice(1).toLowerCase();
}

/** Texto da prioridade legal, aceitando os formatos que o endpoint possa devolver. */
export function textoPrioridades(bruto) {
  if (!bruto) return [];
  const itens = Array.isArray(bruto) ? bruto : [bruto];
  const textos = [];
  for (const it of itens) {
    if (typeof it === 'string') { if (limpar(it)) textos.push(limpar(it)); continue; }
    if (it && typeof it === 'object') {
      const t = it.descricao || it.descricaoPrioridade || it.nome || it.prioridade ||
        (it.prioridadeProcesso && it.prioridadeProcesso.descricao);
      if (limpar(t)) textos.push(limpar(t));
    }
  }
  return Array.from(new Set(textos));
}

function ehOrgaoPublico(parte) {
  return Boolean(parte && parte.pessoaJuridica && parte.pessoaJuridica.orgaoPublico === true);
}

export function enriquecerProcessoVT(registro, { agora = new Date(), termosFazenda = null } = {}) {
  const l = registro.listagem || {};
  const p = registro.processo || {};
  const cnj = limpar(registro.cnj || p.numero || l.numeroProcesso);

  const classe = {
    sigla: limpar((p.classeJudicial && p.classeJudicial.sigla) || l.classeJudicial) || 'OUTROS',
    nome: limpar(p.classeJudicial && p.classeJudicial.descricao)
  };

  const partesBrutas = registro.partes || {};
  const partes = estruturarPartesERepresentantes(partesBrutas, termosFazenda);
  const pjs = diagnosticarPJsProcesso(partesBrutas, termosFazenda);

  // Ente público: lista de nomes do projeto original + indicador "orgaoPublico" do cadastro PJe.
  const entes = new Map();
  for (const e of pjs.entesFazenda || []) entes.set(limpar(e.nome), { nome: limpar(e.nome), polo: e.polo });
  for (const polo of Object.keys(partesBrutas)) {
    for (const parte of partesBrutas[polo] || []) {
      if (ehOrgaoPublico(parte) && limpar(parte.nome)) entes.set(limpar(parte.nome), { nome: limpar(parte.nome), polo: polo.toLowerCase() });
    }
  }

  const entrada = l.dataEntradaTarefa || null;
  const tEntrada = entrada ? new Date(entrada).getTime() : NaN;
  const diasNaTarefa = isNaN(tEntrada) ? null : Math.max(0, Math.floor((agora.getTime() - tEntrada) / DIA_MS));

  const prioridades = textoPrioridades(registro.prioridades);
  const temPrioridade = Boolean(l.prioridadeProcessual) || prioridades.length > 0;

  return {
    cnj,
    idProcesso: registro.idProcesso || p.id || l.id || null,
    raw: registro,
    classe,
    fase: faseDoProcesso(registro),
    tarefa: limpar(l.tarefa) || 'não informada',
    entrada,
    diasNaTarefa,
    responsavel: limpar(l.nomeUsuarioResponsavel) || null,
    conclusoA: limpar(l.nomeConclusoMagistrado) || null,
    prazoExpirado: Boolean(l.prazoExpirado || l.prazoExpiradoSecretaria || l.prazoExpiradoLocalizacao),
    temComentario: Boolean(l.temComentario || l.temComentarioSecretaria),
    temPrioridade,
    prioridades,
    qtdeAutores: Number(l.qtdeParteAutora) || (partes.ativos || []).length,
    qtdeReus: Number(l.qtdeParteRe) || (partes.passivos || []).length,
    sumarissimo: /SUM/i.test(classe.sigla),
    assuntos: classificarAssuntos(registro.assuntos || []),
    partes,
    pjs,
    entesPublicos: Array.from(entes.values()),
    sindicatos: identificarSindicatos(partesBrutas),
    temporalidade: analisarGapAutos(registro)
  };
}

export function processarLoteVT(registros, opcoes = {}) {
  return registros.filter(r => r && !r.erro).map(r => enriquecerProcessoVT(r, opcoes));
}
