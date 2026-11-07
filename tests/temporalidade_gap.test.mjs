import test from 'node:test';
import assert from 'node:assert/strict';
import { analisarGapAutos } from '../src/motor/classificadores/temporalidade_gap.js';

test('Processo físico migrado: sequencial iniciado por 0', () => {
  const registro = {
    cnj: '0096500-55.2001.5.02.0312',
    processo: {
      numero: '0096500-55.2001.5.02.0312',
      autuadoEm: '2026-02-10T10:00:00Z'
    }
  };

  const resultado = analisarGapAutos(registro);
  assert.equal(resultado.ehProcessoFisicoMigrado, true);
  assert.equal(resultado.badge, 'Processo físico');
  assert.ok(resultado.alertaAutos.includes('Processo físico migrado'));
});

test('Processo nativo digital: sequencial iniciado por 1 não deve ser marcado como físico', () => {
  const registro = {
    cnj: '1000647-56.2018.5.02.0069',
    processo: {
      numero: '1000647-56.2018.5.02.0069',
      autuadoEm: '2026-08-15T14:30:00Z'
    }
  };

  const resultado = analisarGapAutos(registro);
  assert.equal(resultado.ehProcessoFisicoMigrado, false);
  assert.equal(resultado.badge, 'NATIVO DIGITAL');
  assert.equal(resultado.alertaAutos, 'Autos digitais integrais');
});

test('Processo com certidão explícita de migração deve ser reconhecido mesmo se não iniciar por 0', () => {
  const registro = {
    cnj: '2000123-45.2015.5.02.0000',
    pecaMaisAntiga: {
      descricao: 'TERMO DE MIGRACAO PARA O PJE',
      dataInclusao: '2020-01-01T00:00:00Z'
    }
  };

  const resultado = analisarGapAutos(registro);
  assert.equal(resultado.ehProcessoFisicoMigrado, true);
  assert.ok(resultado.alertaAutos.includes('termo de migração digital identificado'));
});
