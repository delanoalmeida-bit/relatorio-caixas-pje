import test from 'node:test';
import assert from 'node:assert/strict';
import { identificarSindicatos } from '../src/motor/classificadores/sindicatos.js';

test('identificarSindicatos detecta sindicato no polo ativo', () => {
  const partes = {
    ativo: [
      { nome: 'SINDICATO DOS TRABALHADORES EM TRANSPORTES RODOVIARIOS', tipo: 'AUTOR' }
    ],
    passivo: [
      { nome: 'EMPRESA DE ONIBUS LTDA', tipo: 'REU' }
    ]
  };

  const res = identificarSindicatos(partes);
  assert.equal(res.temSindicato, true);
  assert.equal(res.sindicatos.length, 1);
  assert.equal(res.rotulo, 'Sindicato (ativo)');
});

test('identificarSindicatos detecta federação ou sigla sindicato (SINPRO)', () => {
  const partes = [
    { nome: 'SINPRO SP - SINDICATO DOS PROFESSORES DE SP', polo: 'ativo' }
  ];

  const res = identificarSindicatos(partes);
  assert.equal(res.temSindicato, true);
  assert.equal(res.sindicatos.length, 1);
});

test('identificarSindicatos retorna falso quando não há entidade sindical', () => {
  const partes = {
    ativo: [{ nome: 'JOAO DA SILVA' }],
    passivo: [{ nome: 'BANCO SANTANDER BRASIL S.A.' }]
  };

  const res = identificarSindicatos(partes);
  assert.equal(res.temSindicato, false);
  assert.equal(res.sindicatos.length, 0);
  assert.equal(res.rotulo, null);
});
