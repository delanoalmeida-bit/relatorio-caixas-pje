import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classificarPartePJ,
  diagnosticarPJsProcesso,
  CATEGORIA_PJ,
  EXIGENCIA_RECURSAL,
  PRERROGATIVA_PRAZO
} from '../src/motor/classificadores/pessoas_juridicas.js';

test('Identifica Fazenda Pública com isenção integral e prazo em dobro', () => {
  const estado = classificarPartePJ({ nome: 'ESTADO DE SAO PAULO', tipo: 'AGRAVANTE' });
  assert.equal(estado.categoria, CATEGORIA_PJ.FAZENDA_PUBLICA);
  assert.equal(estado.prerrogativaPrazo, PRERROGATIVA_PRAZO.DOBRO);
  assert.equal(estado.exigenciaRecursal, EXIGENCIA_RECURSAL.PREPARO_ISENTO_TOTAL);

  const municipio = classificarPartePJ({ nome: 'MUNICIPIO DE GUARULHOS', tipo: 'RECORRENTE' });
  assert.equal(municipio.categoria, CATEGORIA_PJ.FAZENDA_PUBLICA);
});

test('Identifica Recuperação Judicial com isenção de depósito e custas devidas', () => {
  const rj = classificarPartePJ({ nome: 'EMPRESA BRASIL TRANSPORTES (EM RECUPERACAO JUDICIAL)', tipo: 'RECORRENTE' });
  assert.equal(rj.categoria, CATEGORIA_PJ.RECUPERACAO_JUDICIAL);
  assert.equal(rj.exigenciaRecursal, EXIGENCIA_RECURSAL.ISENCAO_DEPOSITO_CUSTAS_DEVIDAS);
  assert.equal(rj.prerrogativaPrazo, PRERROGATIVA_PRAZO.SIMPLES);
});

test('Identifica Massa Falida com isenção total pela Súmula 86 do TST', () => {
  const falida = classificarPartePJ({ nome: 'MASSA FALIDA DE INDUSTRIAS REUNIDAS S/A', tipo: 'RECORRENTE' });
  assert.equal(falida.categoria, CATEGORIA_PJ.MASSA_FALIDA);
  assert.equal(falida.exigenciaRecursal, EXIGENCIA_RECURSAL.PREPARO_ISENTO_TOTAL);
});

test('Identifica Estatais em regime comum sem privilégios fazendários', () => {
  const bb = classificarPartePJ({ nome: 'BANCO DO BRASIL SA', tipo: 'RECORRENTE' });
  assert.equal(bb.categoria, CATEGORIA_PJ.ESTATAL_REGIME_COMUM);
  assert.equal(bb.prerrogativaPrazo, PRERROGATIVA_PRAZO.SIMPLES);
  assert.equal(bb.exigenciaRecursal, EXIGENCIA_RECURSAL.PREPARO_INTEGRAL);
});

test('Caso de regressão VASP x Estado de São Paulo', () => {
  const partes = {
    ATIVO: [{ nome: 'ESTADO DE SAO PAULO', tipo: 'AGRAVANTE' }],
    PASSIVO: [
      { nome: 'VIACAO AEREA SAO PAULO S A', tipo: 'AGRAVADO' },
      { nome: 'EDITH AGNES SCHULZ', tipo: 'AGRAVADO' }
    ]
  };

  const diag = diagnosticarPJsProcesso(partes);
  assert.equal(diag.temFazendaPublica, true);
  assert.equal(diag.entesFazenda.length, 1);
  assert.equal(diag.entesFazenda[0].nome, 'ESTADO DE SAO PAULO');
  assert.equal(diag.entesFazenda[0].tipo, 'AGRAVANTE');

  const nomesFazenda = diag.entesFazenda.map(e => e.nome);
  assert.equal(nomesFazenda.includes('VIACAO AEREA SAO PAULO S A'), false);
});
