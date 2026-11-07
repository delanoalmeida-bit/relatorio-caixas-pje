import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarClasse, ROTA_TRIAGEM } from '../src/motor/classificadores/classes_trabalhistas.js';

test('Classes de Conhecimento mapeiam para rota CONHECIMENTO', () => {
  const rot = classificarClasse('ROT');
  assert.equal(rot.rota, ROTA_TRIAGEM.CONHECIMENTO);
  assert.equal(rot.codigo, 1009);

  const rorsum = classificarClasse('RORSum');
  assert.equal(rorsum.rota, ROTA_TRIAGEM.CONHECIMENTO);
  assert.equal(rorsum.rito, 'SUMARISSIMO');

  const remnec = classificarClasse('RemNecRO');
  assert.equal(remnec.rota, ROTA_TRIAGEM.CONHECIMENTO);

  const airo = classificarClasse('AIRO');
  assert.equal(airo.rota, ROTA_TRIAGEM.CONHECIMENTO);
});

test('Classes de Execução mapeiam para rota EXECUCAO', () => {
  const ap = classificarClasse('AP');
  assert.equal(ap.rota, ROTA_TRIAGEM.EXECUCAO);
  assert.equal(ap.codigo, 1004);

  const aiap = classificarClasse('AIAP');
  assert.equal(aiap.rota, ROTA_TRIAGEM.EXECUCAO);
});

test('Classes com siglas novas realizam inferência dinâmica', () => {
  const customAp = classificarClasse('AP-Incidente');
  assert.equal(customAp.rota, ROTA_TRIAGEM.EXECUCAO);
  assert.equal(customAp.desconhecida, true);

  const customMs = classificarClasse('MS-Especial');
  assert.equal(customMs.rota, ROTA_TRIAGEM.ORIGINARIA);
});
