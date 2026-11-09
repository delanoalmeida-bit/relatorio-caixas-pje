/*
 * Aviso no centro da tela do PJe, sobre uma camada escura que bloqueia cliques na página
 * enquanto o relatório é gerado (para ninguém navegar sem querer). Enquanto roda, o navegador
 * também pede confirmação se a aba for fechada ou recarregada.
 * Só textContent (nunca innerHTML com dado do PJe).
 */

const ID = 'relatorio-triagem-overlay';

function el(doc, tag, estilo, texto) {
  const n = doc.createElement(tag);
  if (estilo) n.style.cssText = estilo;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

const ESTILO_BOTAO = 'margin:18px 10px 0 0;padding:10px 18px;border:0;border-radius:8px;cursor:pointer;' +
  'font:600 15px system-ui,sans-serif;';

export function criarOverlay(doc = document, win = (typeof window !== 'undefined' ? window : null)) {
  const antigo = doc.getElementById(ID);
  if (antigo) antigo.remove();

  const fundo = el(doc, 'div',
    'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.72);' +
    'display:flex;align-items:center;justify-content:center;');
  fundo.id = ID;
  const caixa = el(doc, 'div',
    'width:min(620px,92vw);background:#0f172a;color:#fff;padding:32px 36px;border-radius:16px;' +
    'font:17px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 24px 64px rgba(0,0,0,.6);' +
    'border:1px solid #334155;text-align:left;');
  const titulo = el(doc, 'div', 'font-size:24px;font-weight:800;margin-bottom:6px;', 'Gerando o relatório da caixa');
  const alerta = el(doc, 'div',
    'background:#facc15;color:#0f172a;font-weight:800;font-size:16px;padding:10px 14px;border-radius:8px;margin:12px 0 18px;',
    'NÃO FECHE ESTA ABA E NÃO MUDE DE PÁGINA até o PDF ser baixado. Pode usar outras abas ou programas enquanto isso.');
  const msg = el(doc, 'div', 'font-size:18px;margin-bottom:6px;white-space:pre-line;min-height:27px;', 'Iniciando...');
  const detalhe = el(doc, 'div', 'font-size:14px;color:#94a3b8;margin-bottom:14px;white-space:pre-line;min-height:21px;', '');
  const trilho = el(doc, 'div', 'background:#1e293b;border-radius:8px;overflow:hidden;height:12px;');
  const barra = el(doc, 'div', 'background:#38bdf8;width:0%;height:100%;transition:width .3s;');
  const acoes = el(doc, 'div', '');
  trilho.appendChild(barra);
  caixa.append(titulo, alerta, msg, detalhe, trilho, acoes);
  fundo.appendChild(caixa);
  doc.body.appendChild(fundo);

  // Confirmação do navegador ao fechar/recarregar enquanto roda.
  const segurar = ev => { ev.preventDefault(); ev.returnValue = ''; return ''; };
  if (win && win.addEventListener) win.addEventListener('beforeunload', segurar);
  const liberar = () => { if (win && win.removeEventListener) win.removeEventListener('beforeunload', segurar); };

  const botao = (texto, cor, acao) => {
    const b = el(doc, 'button', ESTILO_BOTAO + `background:${cor};color:#0f172a;`, texto);
    b.type = 'button';
    b.addEventListener('click', acao);
    acoes.appendChild(b);
    return b;
  };
  const fechar = () => { liberar(); fundo.remove(); };

  return {
    status(texto, pct) {
      msg.textContent = texto;
      if (typeof pct === 'number') barra.style.width = Math.max(0, Math.min(100, pct)) + '%';
    },
    detalhe(texto) { detalhe.textContent = texto || ''; },
    definirTitulo(texto) { titulo.textContent = texto; },
    concluir(texto, { baixarDeNovo, baixarDados, detalheFinal, rotuloBaixarDeNovo } = {}) {
      liberar();
      titulo.textContent = 'Relatório pronto';
      titulo.style.color = '#4ade80';
      alerta.style.display = 'none';
      msg.textContent = texto;
      detalhe.textContent = detalheFinal || 'O PDF foi baixado (veja a pasta Downloads). Pode fechar este aviso.';
      barra.style.width = '100%';
      barra.style.background = '#4ade80';
      acoes.textContent = '';
      botao('Fechar', '#4ade80', fechar);
      if (baixarDeNovo) botao(rotuloBaixarDeNovo || 'Baixar o PDF de novo', '#e2e8f0', baixarDeNovo);
      if (baixarDados) botao('Dados brutos (.txt)', '#94a3b8', baixarDados);
    },
    erro(texto) {
      liberar();
      titulo.textContent = 'Relatório: erro';
      titulo.style.color = '#f87171';
      alerta.style.display = 'none';
      msg.textContent = texto;
      barra.style.background = '#f87171';
      acoes.textContent = '';
      botao('Fechar', '#e2e8f0', fechar);
    }
  };
}
