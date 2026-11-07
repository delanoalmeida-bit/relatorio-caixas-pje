import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizarProcessoLGPD } from '../src/coleta/sanitizacao_lgpd.js';

test('Sanitização LGPD remove CPFs, e-mails e telefones de partes e patronos', () => {
  const mockProcesso = {
    cnj: '0096500-55.2001.5.02.0312',
    partes: {
      ATIVO: [
        {
          nome: 'PARTE AUTORA PESSOA FISICA',
          tipo: 'RECORRENTE',
          tipoDocumento: 'CPF',
          documento: '123.456.789-00',
          cpf: '123.456.789-00',
          emails: ['autor@email.com'],
          dddCelular: '11',
          numeroCelular: '999999999',
          representantes: [
            {
              nome: 'DR ADVOGADO',
              numeroOab: 'SP123456',
              cpf: '987.654.321-00',
              documento: '987.654.321-00',
              emails: ['adv@escritorio.com'],
              dddCelular: '11',
              numeroCelular: '988888888'
            }
          ]
        }
      ],
      PASSIVO: [
        {
          nome: 'EMPRESA REU LTDA',
          tipo: 'RECORRIDO',
          tipoDocumento: 'CNPJ',
          documento: '12.345.678/0001-90'
        }
      ]
    }
  };

  const sanitizado = sanitizarProcessoLGPD(mockProcesso);
  const autor = sanitizado.partes.ATIVO[0];
  const adv = autor.representantes[0];
  const reu = sanitizado.partes.PASSIVO[0];

  // Dados sensíveis devem ser eliminados
  assert.equal(autor.documento, undefined, 'CPF de pessoa física deve ser removido');
  assert.equal(autor.cpf, undefined);
  assert.equal(autor.emails, undefined);
  assert.equal(autor.numeroCelular, undefined);

  assert.equal(adv.cpf, undefined);
  assert.equal(adv.documento, undefined);
  assert.equal(adv.emails, undefined);
  assert.equal(adv.numeroCelular, undefined);

  // Dados necessários devem ser preservados
  assert.equal(autor.nome, 'PARTE AUTORA PESSOA FISICA');
  assert.equal(autor.tipo, 'RECORRENTE');
  assert.equal(adv.nome, 'DR ADVOGADO');
  assert.equal(adv.numeroOab, 'SP123456');

  // CNPJ corporativo de pessoa jurídica deve ser preservado
  assert.equal(reu.documento, '12.345.678/0001-90');
});
