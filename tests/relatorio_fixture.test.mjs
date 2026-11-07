import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';
import { gerarRelatorio } from '../src/relatorio/gerar.js';
import { sanitizarProcessoLGPD } from '../src/coleta/sanitizacao_lgpd.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// Dados reais NÃO ficam neste repositório (LGPD). Por padrão lê do projeto antigo, ao lado.
const DADOS_PATH = process.env.TRIAGEM_FIXTURE ||
  path.join(DIR, '..', '..', 'PROJETO_TRIAGEM', 'triagem_copy.json');
const SEM_DADOS = !fs.existsSync(DADOS_PATH);
// O PDF contém nomes reais: só é gravado em disco se um caminho for pedido explicitamente
// (TRIAGEM_PDF_SAIDA). Sem isso, a conferência é feita só em memória.
const SAIDA_PDF = process.env.TRIAGEM_PDF_SAIDA || null;

test('PDF completo a partir da amostra real de 322 processos', { skip: SEM_DADOS && 'fixture real ausente' }, () => {
  const registros = fs.readFileSync(DADOS_PATH, 'utf8').split('\n').filter(Boolean)
    .map(l => sanitizarProcessoLGPD(JSON.parse(l)));

  const geradoEm = new Date(2026, 10, 4, 14, 32);
  const { rel, doc } = gerarRelatorio({
    registros,
    falhas: [{ cnj: '0000000-00.2026.5.02.0000', motivo: 'HTTP 500 em /processos/id/1/partes' }],
    meta: { hostname: 'pje.trt2.jus.br', totalNaCaixa: 323, criterio: 'Caixa Triagem, processos sem responsável', geradoEm, versao: 'teste' },
    JsPDF: jsPDF
  });

  assert.equal(rel.nomeArquivo, 'Relatório de Triagem - 9ª Turma - Cadeira 4 (TRT-2) - 04-11-2026 às 14h32.pdf');
  assert.equal(rel.fichas.length, 322);
  assert.equal(rel.indice, undefined, 'índice por CNJ foi retirado');
  assert.equal(rel.numeros, undefined, 'resumo em números foi retirado');
  assert.ok(rel.reclamadas.every(r => r.processos.length > 1), 'só reclamadas com 2+ processos');
  assert.equal(rel.naoLidos.length, 1);

  // Ordem por entrada na triagem
  const entradas = registros.map(r => [r.cnj, r.listagem.dataEntradaTarefa]);
  const mapa = new Map(entradas);
  const datas = rel.fichas.map(f => new Date(mapa.get(f.cnj)).getTime());
  for (let i = 1; i < datas.length; i++) assert.ok(datas[i - 1] <= datas[i], 'fichas fora de ordem');

  // Segredo de justiça: nenhum nome de parte desses processos aparece nas fichas
  const segredos = registros.filter(r => r.listagem.segredoDeJustica);
  assert.equal(segredos.length, 4);
  for (const s of segredos) {
    const ficha = rel.fichas.find(f => f.cnj === s.cnj);
    const texto = ficha.linhas.flat().map(c => c[1]).join(' ');
    for (const parte of Object.values(s.partes).flat()) {
      if ((parte.nome || '').trim().length > 3) assert.ok(!texto.includes(parte.nome.trim()), `vazou ${s.cnj}`);
    }
  }
  // ...e nenhum nome de pessoa física desses processos aparece em seção nenhuma
  // (exceto quem também está num processo público do lote, ex.: o mesmo perito)
  const tudo = JSON.stringify(rel);
  const nomesPublicos = new Set(registros.filter(r => !r.listagem.segredoDeJustica)
    .flatMap(r => Object.values(r.partes || {}).flat().map(p => (p.nome || '').trim())));
  for (const s of segredos) {
    for (const parte of Object.values(s.partes).flat()) {
      if (parte.tipoPessoa === 'F' && (parte.nome || '').trim().length > 3 && !nomesPublicos.has(parte.nome.trim())) {
        assert.ok(!tudo.includes(parte.nome.trim()), `vazou pessoa física de ${s.cnj}`);
      }
    }
  }

  // Fazenda sem MPT bate com o gate do projeto original (24 AP + os de outras classes)
  assert.ok(rel.fazendaSemMpt.length >= 24);

  const bytes = Buffer.from(doc.output('arraybuffer'));
  if (SAIDA_PDF) fs.writeFileSync(SAIDA_PDF, bytes);
  const bruto = bytes.toString('latin1');
  assert.ok(doc.getNumberOfPages() > 20, 'PDF curto demais');
  assert.match(bruto, /\/Outlines/, 'sem marcadores');
  assert.ok((bruto.match(/\/Subtype \/Link/g) || []).length > 100, 'links internos insuficientes');
  console.log(`PDF: ${SAIDA_PDF || '(só em memória)'} (${doc.getNumberOfPages()} páginas, ${(bytes.length / 1024).toFixed(0)} KB)`);
});
