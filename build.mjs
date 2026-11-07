/*
 * Empacota o gerador num arquivo só e monta a página de instalação.
 *   node build.mjs
 * Saída em docs/ (pasta publicada pelo GitHub Pages):
 *   docs/relatorio.js       gerador completo (motor + jsPDF), carregado pelo favorito
 *   docs/index.html         página de instalação (botão para arrastar + 3 passos)
 *   docs/bookmarklet.txt    o favorito em texto, para instalar à mão
 * Usa a API JS do esbuild (os atalhos de node_modules/.bin quebram com o "&" de "R&D").
 */
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './src/config.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(DIR, 'docs');
fs.mkdirSync(SAIDA, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(DIR, 'src', 'main.js')],
  outfile: path.join(SAIDA, 'relatorio.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome100', 'firefox100', 'edge100'],
  // Dependências opcionais do jsPDF (doc.html/SVG) que o relatório não usa.
  external: ['html2canvas', 'dompurify', 'canvg'],
  legalComments: 'none',
  banner: { js: `/* relatorio-caixas-pje ${CONFIG.VERSAO} | baseado em github.com/paulodca/relatoriodetriagem | jsPDF (MIT) */` },
  logLevel: 'warning'
});

// O favorito é só um "carregador": baixa a versão mais recente do gerador a cada clique.
const carregador = `(function(){if(!/\\.jus\\.br$/.test(location.hostname)){alert('Abra o PJe e clique de novo.');return}` +
  `var s=document.createElement('script');s.src='${CONFIG.URL_SCRIPT}?v='+Math.floor(Date.now()/36e5);` +
  `s.onerror=function(){alert('Não consegui carregar o gerador do relatório (rede ou bloqueio do tribunal).')};` +
  `document.body.appendChild(s)})()`;
const bookmarklet = 'javascript:' + encodeURIComponent(carregador);
fs.writeFileSync(path.join(SAIDA, 'bookmarklet.txt'), bookmarklet + '\n');

const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório da caixa ${CONFIG.NOME_CAIXA} - PJe 1º grau</title>
<style>
  body { font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; max-width: 720px; margin: 40px auto; padding: 0 20px; background: #fff; }
  h1 { color: #1e3a8a; margin-bottom: 4px; }
  .sub { color: #475569; margin-top: 0; }
  ol li { margin: 14px 0; }
  .botao { display: inline-block; padding: 12px 22px; background: #1e3a8a; color: #fff; border-radius: 10px; font-weight: 700; text-decoration: none; cursor: grab; }
  .caixa { background: #f1f5f9; border-radius: 10px; padding: 14px 18px; margin: 24px 0; }
  code { background: #e2e8f0; padding: 1px 5px; border-radius: 4px; }
  small { color: #64748b; }
</style>
</head>
<body>
<h1>Relatório da caixa ${CONFIG.NOME_CAIXA}</h1>
<p class="sub">PJe 1º grau (Varas do Trabalho). Um clique no PJe e o navegador baixa um PDF com todos os processos da caixa.</p>

<ol>
  <li><strong>Mostre a barra de favoritos</strong> do navegador: <code>Ctrl+Shift+B</code>.</li>
  <li><strong>Arraste este botão</strong> para a barra de favoritos:<br><br>
    <a class="botao" href="${escAttr(bookmarklet)}" onclick="alert('Não clique aqui: arraste o botão para a barra de favoritos.');return false;">Relatório ${CONFIG.NOME_CAIXA}</a>
  </li>
  <li><strong>No PJe</strong> (logado, em qualquer tela), clique no favorito. Não feche a aba nem mude de página
    até o PDF baixar. O arquivo sai com nome como
    <code>Relatório ${CONFIG.NOME_CAIXA} - 2ª Vara do Trabalho de São Luís (TRT-16) - 07-11-2026 às 15h40.pdf</code>.</li>
</ol>

<div class="caixa">
  <strong>Privacidade.</strong> O relatório é montado dentro do seu navegador, com a sua sessão do PJe.
  Nenhum dado de processo é enviado para lugar nenhum. CPF, e-mail, telefone e endereço são descartados;
  em segredo de justiça, as partes não aparecem no PDF. O PDF contém nomes de partes: trate-o como documento interno.
</div>

<small>Versão ${CONFIG.VERSAO}. Baseado em github.com/paulodca/relatoriodetriagem (PJe 2º grau).</small>
</body>
</html>
`;
fs.writeFileSync(path.join(SAIDA, 'index.html'), html);

const kb = f => (fs.statSync(path.join(SAIDA, f)).size / 1024).toFixed(0) + ' KB';
console.log(`docs/relatorio.js ${kb('relatorio.js')} | docs/index.html ${kb('index.html')} | favorito ${bookmarklet.length} caracteres`);
