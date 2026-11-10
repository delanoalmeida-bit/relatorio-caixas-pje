/*
 * Botão "entradas de ontem" (carregado pelo favorito, dentro da aba do PJe):
 * pergunta a data de início (padrão: último dia útil) → lista a caixa → detalha só os
 * processos que entraram no período → baixa um .md para o assistente de triagem diária.
 * O relatório completo da caixa (main.js) não é alterado.
 */
import { CONFIG } from '../config.js';
import { coletarTriagem, lerCookie, ErroSessao } from '../coleta/coletor.js';
import { processarLoteVT } from '../motor/hub_vt.js';
import { criarOverlay } from '../overlay/overlay.js';
import { ultimoDiaUtil, dataBR, lerDataBR, janelaDesde, entrouNaJanela, descreverJanela } from './periodo.js';
import { montarEntradas } from './montar_entradas.js';

function caixaEscolhida() {
  const c = typeof window !== 'undefined' && window.__relatorioCaixa;
  if (c && Number.isInteger(Number(c.id)) && Number(c.id) > 0) {
    return { id: Number(c.id), nome: String(c.nome || 'agrupamento ' + c.id) };
  }
  return { id: CONFIG.AGRUPAMENTO, nome: CONFIG.NOME_CAIXA };
}

function baixarTexto(nome, texto) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' }));
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}

/** Pergunta a data de início; Cancelar → null. Data inválida → pergunta de novo. */
function perguntarInicio(caixa) {
  const padrao = dataBR(ultimoDiaUtil(new Date()));
  let msg = `Caixa ${caixa.nome}: listar os processos que entraram a partir de qual dia?\n` +
    `(até ontem, inclusive; Enter = último dia útil)`;
  for (;;) {
    const r = window.prompt(msg, padrao);
    if (r === null) return null;
    const d = lerDataBR(r);
    if (d) return d;
    msg = `Data não reconhecida: "${r}". Use dd/mm/aaaa.`;
  }
}

async function executar() {
  const caixa = caixaEscolhida();
  const xsrf = lerCookie(document.cookie, 'Xsrf-Token');
  if (!xsrf) { window.alert('Não encontrei a sessão do PJe nesta aba. Faça login no PJe e clique de novo.'); return; }
  const inicio = perguntarInicio(caixa);
  if (!inicio) return;

  const janela = janelaDesde(inicio, new Date());
  const periodo = descreverJanela(janela);
  const overlay = criarOverlay(document, window);
  overlay.definirTitulo(`Entradas na caixa ${caixa.nome}`);
  const t0 = Date.now();
  const relogio = setInterval(() => overlay.detalhe(`Tempo decorrido: ${Math.round((Date.now() - t0) / 1000)} s`), 1000);

  try {
    const cfg = Object.assign({}, CONFIG, {
      AGRUPAMENTO: caixa.id, NOME_CAIXA: caixa.nome,
      FILTRO_LISTAGEM: item => entrouNaJanela(item, janela),
      DESCRICAO_FILTRO: `entradas ${periodo.legivel}`
    });
    const coleta = await coletarTriagem({
      origin: location.origin, xsrf, config: cfg,
      aoProgresso: p => {
        if (p.fase === 'listagem') overlay.status(`Lendo a lista da caixa ${caixa.nome}...`, 5);
        else if (p.fase === 'repescagem') overlay.status(`Tentando de novo os que falharam: ${p.feitos + 1}/${p.total}`, 95);
        else overlay.status(`Baixando os processos do período: ${p.feitos}/${p.total}`, 10 + Math.round((p.feitos / Math.max(1, p.total)) * 85));
      }
    });

    const geradoEm = new Date();
    const processos = processarLoteVT(coleta.registros, { agora: geradoEm });
    const { texto, nomeArquivo, qtd } = montarEntradas({
      processos, naoLidos: coleta.falhas,
      meta: {
        hostname: location.hostname, nomeCaixa: caixa.nome, geradoEm, totalNaCaixa: coleta.totalNaCaixa,
        periodo, divisao: CONFIG.DIVISAO_ASSISTENTES, versao: CONFIG.VERSAO
      }
    });
    baixarTexto(nomeArquivo, texto);
    clearInterval(relogio);
    overlay.concluir(
      `${qtd} processo(s) entraram ${periodo.legivel} e continuam na caixa (de ${coleta.totalNaCaixa}).` +
      (coleta.falhas.length ? `\n${coleta.falhas.length} não lido(s): veja no arquivo.` : '') +
      `\nArquivo: ${nomeArquivo}`,
      {
        baixarDeNovo: () => baixarTexto(nomeArquivo, texto),
        rotuloBaixarDeNovo: 'Baixar o arquivo de novo',
        detalheFinal: 'O arquivo .md foi baixado (pasta Downloads). Anexe-o ao assistente de triagem diária.'
      }
    );
  } catch (e) {
    clearInterval(relogio);
    overlay.erro(e instanceof ErroSessao ? e.message : `Algo deu errado: ${(e && e.message) || e}`);
  }
}

if (!window.__entradasRodando) {
  window.__entradasRodando = true;
  executar().finally(() => { window.__entradasRodando = false; });
}
