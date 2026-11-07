import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processarLoteTriagem } from '../src/motor/hub_triagem.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// Dados reais NÃO ficam neste repositório (LGPD). Por padrão lê do projeto antigo, ao lado.
const DADOS_PATH = process.env.TRIAGEM_FIXTURE ||
  path.join(DIR, '..', '..', 'PROJETO_TRIAGEM', 'triagem_copy.json');
const SEM_DADOS = !fs.existsSync(DADOS_PATH);

test('Processa lote real de 322 processos e valida gates de controle', { skip: SEM_DADOS && 'fixture real ausente' }, () => {

  const linhas = fs.readFileSync(DADOS_PATH, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const lista = [];
  for (const l of linhas) {
    try {
      const obj = JSON.parse(l);
      if (!obj.erro) lista.push(obj);
    } catch {
      continue;
    }
  }

  assert.equal(lista.length, 322, 'Deve conter exatamente 322 processos válidos');

  const resultado = processarLoteTriagem(lista);
  const { processos, estatisticas, clustersSeriais } = resultado;

  const apFazendaSemMpt = processos.filter(p =>
    p.classe.sigla === 'AP' &&
    p.pjs.temFazendaPublica &&
    !p.partes.mptPresente
  );

  console.log('--- Estatísticas do Lote Real de 322 Processos ---');
  console.log(`Total processado: ${estatisticas.total}`);
  console.log(`Fase de Conhecimento: ${estatisticas.conhecimento}`);
  console.log(`Fase de Execução: ${estatisticas.execucao}`);
  console.log(`Agravos de Petição (AP): ${estatisticas.porClasse['AP'] || 0}`);
  console.log(`AP + Fazenda Pública sem MPT: ${apFazendaSemMpt.length}`);
  console.log(`Fazenda Pública Total no lote: ${estatisticas.fazendaPublicaTotal}`);
  console.log(`Processos Físicos Migrados: ${estatisticas.processosFisicosMigrados}`);
  console.log(`Clusters de Contencioso Serial: ${clustersSeriais.totalClustersSeriais} (${clustersSeriais.totalProcessosEmLoteSerial} processos em lote serial)`);

  // GATES DE CONTROLE INEGOCIÁVEIS DO PROJETO (conforme HANDOFF.md):
  // 1. Total carregado: 322
  assert.equal(estatisticas.total, 322, 'Total de processos deve ser 322');

  // 2. Filtro AP isolado: 117
  assert.equal(estatisticas.porClasse['AP'], 117, 'Total de Agravos de Petição deve ser exatamente 117');

  // 3. AP + Fazenda sem MPT combinados: 24 (gate travado após correção do bug \bANA\b)
  assert.equal(apFazendaSemMpt.length, 24, 'Total de AP + Fazenda Pública sem MPT deve ser exatamente 24');

  // 4. Clusters de processos semelhantes detectados (14 legítimos, sem falsos positivos)
  assert.equal(clustersSeriais.totalClustersSeriais, 14, 'Deve identificar exatamente 14 clusters válidos');
  assert.equal(clustersSeriais.totalProcessosEmLoteSerial, 35, 'Total de processos em lote serial deve ser 35');

  // 5. Garantir que o processo 0003233 não foi agrupado falsamente
  const proc0003233 = processos.find(p => p.cnj.includes('0003233-18.2013.5.02.0018'));
  assert.ok(proc0003233, 'Processo 0003233 deve existir no lote');
  assert.equal(proc0003233.ehContenciosoEmEscala, undefined, 'Processo 0003233 não deve estar em cluster falso');
});
