import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeOrgaoLegivel, siglaTribunal, tribunalLegivel, dataHoraBR, nomeArquivoRelatorio, nomeArquivoDados } from '../src/relatorio/nome_arquivo.js';

const PROIBIDOS_WINDOWS = /[\\/:*?"<>|]/;

test('órgão julgador por extenso, como o PJe escreve', () => {
  assert.equal(nomeOrgaoLegivel(['9ª Turma - Cadeira 4', ' 9ª Turma -  Cadeira 4 ']), '9ª Turma - Cadeira 4');
  assert.equal(nomeOrgaoLegivel(['9ª Turma - Cadeira 4', '9ª Turma - Cadeira 3']), 'Vários órgãos julgadores');
  assert.equal(nomeOrgaoLegivel([]), 'Órgão julgador não identificado');
  assert.doesNotMatch(nomeOrgaoLegivel(['SDI-1: Seção / Especializada']), PROIBIDOS_WINDOWS);
});

test('tribunal pelo endereço do PJe', () => {
  assert.equal(siglaTribunal('pje.trt2.jus.br'), 'TRT2');
  assert.equal(tribunalLegivel('pje.trt2.jus.br'), 'TRT-2');
  assert.equal(tribunalLegivel('pje.trt15.jus.br'), 'TRT-15');
  assert.equal(tribunalLegivel('localhost'), 'LOCALHOST');
});

test('data no padrão brasileiro DD-MM-AAAA', () => {
  assert.equal(dataHoraBR(new Date(2026, 0, 5, 8, 7)), '05-01-2026 às 08h07');
});

test('nome completo legível, sem caracteres proibidos no Windows', () => {
  const args = { hostname: 'pje.trt2.jus.br', descricoesOJ: ['9ª Turma - Cadeira 4'], data: new Date(2026, 10, 4, 22, 47) };
  const nome = nomeArquivoRelatorio(args);
  assert.equal(nome, 'Relatório de Triagem - 9ª Turma - Cadeira 4 (TRT-2) - 04-11-2026 às 22h47.pdf');
  assert.doesNotMatch(nome, PROIBIDOS_WINDOWS);
  assert.equal(nomeArquivoDados(args), 'Dados da Triagem - 9ª Turma - Cadeira 4 (TRT-2) - 04-11-2026 às 22h47.txt');
});
