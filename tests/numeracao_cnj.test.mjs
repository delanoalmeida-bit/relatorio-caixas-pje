import test from 'node:test';
import assert from 'node:assert/strict';
import { origemNumeracao, digitoFinal } from '../src/motor/classificadores/numeracao_cnj.js';
import { analisarGapAutos } from '../src/motor/classificadores/temporalidade_gap.js';

test('físico até 2012: dígito é o último do número físico', () => {
  assert.deepEqual(origemNumeracao('0132300-70.2008.5.16.0002'), { origem: 'fisico', ambiguo: false });
  assert.equal(digitoFinal('0132300-70.2008.5.16.0002'), 3);
});

test('PJe a partir de 2014, mesmo terminado em 00', () => {
  assert.equal(digitoFinal('0017784-75.2024.5.16.0002'), 4);
  assert.equal(digitoFinal('0016500-11.2019.5.16.0002'), 0);
  assert.equal(origemNumeracao('0016500-11.2019.5.16.0002').origem, 'pje');
});

test('2013: abaixo de 0016000 é físico; não terminado em 00 é PJe', () => {
  assert.equal(digitoFinal('0012300-10.2013.5.16.0002'), 3);
  assert.equal(digitoFinal('0016087-10.2013.5.16.0002'), 7);
});

test('2013 ambíguo (≥ 0016000 terminado em 00): decide pela autuação', () => {
  const cnj = '0016100-10.2013.5.16.0002';
  assert.deepEqual(origemNumeracao(cnj), { origem: 'pje', ambiguo: true });
  assert.equal(digitoFinal(cnj, { autuadoEm: '2013-01-20T10:00:00-03:00' }), 1);
  assert.equal(digitoFinal(cnj, { autuadoEm: '2013-05-20T10:00:00-03:00' }), 0);
  assert.equal(digitoFinal(cnj, { autuadoEm: '2020-03-01T10:00:00-03:00' }), 1, 'data da migração → físico');
});

test('relatório: só marca como físico a numeração antiga', () => {
  assert.equal(analisarGapAutos({ cnj: '0132300-70.2008.5.16.0002' }).ehProcessoFisicoMigrado, true);
  assert.equal(analisarGapAutos({ cnj: '0017784-75.2024.5.16.0002' }).ehProcessoFisicoMigrado, false);
});

test('entrada inválida', () => {
  assert.equal(digitoFinal('xyz'), null);
  assert.equal(origemNumeracao(''), null);
});
