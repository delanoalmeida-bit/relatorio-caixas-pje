/*
 * Ponto de entrada no navegador (carregado pelo favorito, dentro da aba do PJe):
 * coletar → classificar → montar → PDF → download automático.
 */
import { jsPDF } from 'jspdf';
import { CONFIG } from './config.js';
import { coletarTriagem, lerCookie, ErroSessao } from './coleta/coletor.js';
import { gerarRelatorio } from './relatorio/gerar.js';
import { criarOverlay } from './overlay/overlay.js';

function textoProgresso(p) {
  if (p.fase === 'listagem') {
    const paginas = p.qtdPaginas ? ` (página ${p.paginasLidas} de ${p.qtdPaginas})` : '';
    return { texto: `Lendo a lista da caixa ${CONFIG.NOME_CAIXA}${paginas}...`, pct: 2 + Math.round((p.paginasLidas / Math.max(1, p.qtdPaginas || 1)) * 3) };
  }
  if (p.fase === 'repescagem') {
    return { texto: `Tentando de novo os que falharam: ${p.feitos + 1}/${p.total}`, pct: 96 };
  }
  const restante = p.feitos > 0 ? Math.round(((p.total - p.feitos) * p.segundos) / p.feitos) : null;
  const eta = restante !== null && p.feitos >= 10 ? ` | faltam ~${restante}s` : '';
  return {
    texto: `Baixando processos: ${p.feitos}/${p.total}${eta}` + (p.falhas ? `\n(${p.falhas} para tentar de novo no fim)` : ''),
    pct: 5 + Math.round((p.feitos / Math.max(1, p.total)) * 88)
  };
}

function baixarTexto(nome, texto) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}

async function executar() {
  const overlay = criarOverlay(document, window);
  // Relógio na tela: mostra que a página está viva mesmo quando o PJe demora a responder.
  const inicio = Date.now();
  let fase = 'listagem';
  let tentativaLista = 1;
  let erroLista = '';
  const relogio = setInterval(() => {
    const seg = Math.round((Date.now() - inicio) / 1000);
    let extra = '';
    if (fase === 'listagem') {
      extra = seg >= 10 ? '\nO PJe está montando a lista; em caixas grandes isso pode levar alguns minutos.' : '';
      if (tentativaLista > 1) extra += `\nTentativa ${tentativaLista} (a anterior falhou: ${erroLista}).`;
    }
    overlay.detalhe(`Tempo decorrido: ${seg} s${extra}`);
  }, 1000);
  try {
    const xsrf = lerCookie(document.cookie, 'Xsrf-Token');
    if (!xsrf) throw new ErroSessao('Não encontrei a sessão do PJe nesta aba. Faça login no PJe e clique de novo.');

    const coleta = await coletarTriagem({
      origin: location.origin,
      xsrf,
      aoProgresso: p => {
        fase = p.fase;
        if (p.fase === 'listagem') { tentativaLista = p.tentativa || 1; erroLista = p.erro || ''; }
        const { texto, pct } = textoProgresso(p);
        overlay.status(texto, pct);
      }
    });

    if (coleta.totalNaCaixa === 0) {
      clearInterval(relogio);
      overlay.erro(`A caixa ${CONFIG.NOME_CAIXA} está vazia. Confira o órgão selecionado no PJe.`);
      return;
    }

    fase = 'pdf';
    overlay.status('Montando o PDF...', 97);
    await new Promise(r => setTimeout(r, 30)); // deixa a mensagem aparecer
    const geradoEm = new Date();
    const { rel, doc } = gerarRelatorio({
      registros: coleta.registros,
      falhas: coleta.falhas,
      meta: {
        hostname: location.hostname, totalNaCaixa: coleta.totalNaCaixa, criterio: coleta.criterio,
        geradoEm, versao: CONFIG.VERSAO, segundos: coleta.segundos,
        nomeCaixa: CONFIG.NOME_CAIXA, faixasDias: CONFIG.FAIXAS_DIAS
      },
      JsPDF: jsPDF
    });
    doc.save(rel.nomeArquivo);
    clearInterval(relogio);

    const ndjson = coleta.registros.map(r => JSON.stringify(r)).join('\n') + '\n';
    overlay.concluir(
      `${rel.capa.noRelatorio} processos em ${Math.round(coleta.segundos)}s.` +
      (coleta.falhas.length ? `\n${coleta.falhas.length} não lidos (listados no fim do PDF).` : '') +
      `\nArquivo: ${rel.nomeArquivo}`,
      {
        baixarDeNovo: () => doc.save(rel.nomeArquivo),
        baixarDados: () => baixarTexto(rel.nomeArquivoDados, ndjson)
      }
    );
  } catch (e) {
    clearInterval(relogio);
    const texto = e instanceof ErroSessao ? e.message : `Algo deu errado: ${(e && e.message) || e}`;
    overlay.erro(texto);
  }
}

if (!window.__relatorioTriagemRodando) {
  window.__relatorioTriagemRodando = true;
  executar().finally(() => { window.__relatorioTriagemRodando = false; });
}
