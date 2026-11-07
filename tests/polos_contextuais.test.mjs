import test from 'node:test';
import assert from 'node:assert/strict';
import { obterRotulosPolosContextuais } from '../src/motor/classificadores/partes_representantes.js';

test('obterRotulosPolosContextuais retorna Agravante / Agravado(a) para Agravos', () => {
  assert.deepEqual(obterRotulosPolosContextuais('AP', 'EXECUCAO'), {
    poloAtivoRotulo: 'Agravante',
    poloPassivoRotulo: 'Agravado(a)'
  });
  assert.deepEqual(obterRotulosPolosContextuais('AIAP', 'EXECUCAO'), {
    poloAtivoRotulo: 'Agravante',
    poloPassivoRotulo: 'Agravado(a)'
  });
  assert.deepEqual(obterRotulosPolosContextuais('AgR', 'INCIDENTAL'), {
    poloAtivoRotulo: 'Agravante',
    poloPassivoRotulo: 'Agravado(a)'
  });
});

test('obterRotulosPolosContextuais retorna Recorrente / Recorrido(a) para Recursos Ordinários', () => {
  assert.deepEqual(obterRotulosPolosContextuais('RO', 'CONHECIMENTO'), {
    poloAtivoRotulo: 'Recorrente',
    poloPassivoRotulo: 'Recorrido(a)'
  });
  assert.deepEqual(obterRotulosPolosContextuais('ROT', 'CONHECIMENTO'), {
    poloAtivoRotulo: 'Recorrente',
    poloPassivoRotulo: 'Recorrido(a)'
  });
  assert.deepEqual(obterRotulosPolosContextuais('ROMSum', 'CONHECIMENTO'), {
    poloAtivoRotulo: 'Recorrente',
    poloPassivoRotulo: 'Recorrido(a)'
  });
});

test('obterRotulosPolosContextuais retorna Reclamante / Reclamada para originárias e 1º grau', () => {
  assert.deepEqual(obterRotulosPolosContextuais('PetCiv', 'ORIGINARIA'), {
    poloAtivoRotulo: 'Reclamante',
    poloPassivoRotulo: 'Reclamada'
  });
});

test('obterRotulosPolosContextuais retorna Impetrante / Impetrado(a) para Mandado de Segurança', () => {
  assert.deepEqual(obterRotulosPolosContextuais('MSCiv', 'ORIGINARIA'), {
    poloAtivoRotulo: 'Impetrante',
    poloPassivoRotulo: 'Impetrado(a)'
  });
});
