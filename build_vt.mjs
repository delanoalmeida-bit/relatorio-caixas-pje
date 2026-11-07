/*
 * Empacota o gerador do 1º grau num arquivo só, para colar no Console do navegador
 * (aba do PJe). Saída: dist/relatorio-vt.txt (.txt de propósito: no Windows, um .js
 * aberto com duplo clique seria executado pelo sistema, não pelo navegador).
 *   node build_vt.mjs
 */
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './src/config.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(DIR, 'dist'), { recursive: true });
const r = await esbuild.build({
  entryPoints: [path.join(DIR, 'src', 'main.js')],
  bundle: true, minify: true, format: 'iife', write: false,
  target: ['chrome100', 'firefox100', 'edge100'],
  external: ['html2canvas', 'dompurify', 'canvg'],
  legalComments: 'none',
  banner: { js: `/* Relatório da caixa ${CONFIG.NOME_CAIXA} - PJe 1º grau - ${CONFIG.VERSAO} | baseado em github.com/paulodca/relatoriodetriagem | jsPDF (MIT) */` },
  logLevel: 'warning'
});
const saida = path.join(DIR, 'dist', 'relatorio-vt.txt');
fs.writeFileSync(saida, r.outputFiles[0].text);
console.log(`dist/relatorio-vt.txt ${(fs.statSync(saida).size / 1024).toFixed(0)} KB`);
