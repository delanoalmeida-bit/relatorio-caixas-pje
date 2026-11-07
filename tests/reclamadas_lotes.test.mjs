import test from 'node:test';
import assert from 'node:assert/strict';
import { processarLoteTriagem } from '../src/motor/hub_triagem.js';
import { agruparPorReclamada, identificarLotes, chaveReclamada } from '../src/relatorio/reclamadas_lotes.js';

let seq = 0;
function registro({ trabalhador, oab, empresa, cnpj, empresaNoAtivo = false, assuntos = ['13994'] }) {
  seq++;
  const pf = { nome: trabalhador, tipoPessoa: 'F', tipo: 'RECORRENTE', representantes: [{ nome: 'ADV', numeroOab: oab }] };
  const pj = { nome: empresa, tipoPessoa: 'J', documento: cnpj, tipoDocumento: 'CNPJ', tipo: 'RECORRIDO',
    representantes: [{ nome: 'ADV EMPRESA', numeroOab: 'SP999999' }] };
  return {
    cnj: `100000${seq}-00.2026.5.02.0001`,
    listagem: { classeJudicial: 'ROT', dataEntradaTarefa: `2026-09-0${seq}T10:00:00` },
    partes: empresaNoAtivo ? { ATIVO: [pj], PASSIVO: [pf] } : { ATIVO: [pf], PASSIVO: [pj] },
    assuntos: assuntos.map(c => ({ assunto: { codigo: c, descricao: 'Assunto ' + c } }))
  };
}

test('filiais (mesma raiz de CNPJ) são a mesma reclamada', () => {
  assert.equal(chaveReclamada({ nome: 'X', documento: '33.041.260/0001-64' }),
    chaveReclamada({ nome: 'X FILIAL', documento: '33.041.260/0652-90' }));
});

test('reclamada no polo ativo (empresa recorrente) também conta', () => {
  const { processos } = processarLoteTriagem([
    registro({ trabalhador: 'ANA', oab: 'SP100', empresa: 'ACME LTDA', cnpj: '11.111.111/0001-11' }),
    registro({ trabalhador: 'BIA', oab: 'SP100', empresa: 'ACME LTDA', cnpj: '11.111.111/0001-11', empresaNoAtivo: true })
  ]);
  const rec = agruparPorReclamada(processos);
  assert.equal(rec.length, 1);
  assert.equal(rec[0].processos.length, 2);
  const lotes = identificarLotes(processos);
  assert.equal(lotes.length, 1, 'mesma reclamada + mesma OAB do trabalhador = lote');
  assert.deepEqual(lotes[0].reclamadas, ['ACME LTDA']);
});

test('advogado da empresa não forma lote; advogado diferente do trabalhador também não', () => {
  const { processos } = processarLoteTriagem([
    registro({ trabalhador: 'CAIO', oab: 'SP200', empresa: 'BETA SA', cnpj: '22.222.222/0001-22' }),
    registro({ trabalhador: 'DUDA', oab: 'SP300', empresa: 'BETA SA', cnpj: '22.222.222/0001-22' })
  ]);
  assert.equal(identificarLotes(processos).length, 0);
});

test('assuntos em comum do lote', () => {
  const { processos } = processarLoteTriagem([
    registro({ trabalhador: 'EVA', oab: 'SP400', empresa: 'GAMA', cnpj: '33.333.333/0001-33', assuntos: ['1', '2'] }),
    registro({ trabalhador: 'FÁBIO', oab: 'SP400', empresa: 'GAMA', cnpj: '33.333.333/0001-33', assuntos: ['2', '3'] })
  ]);
  const [lote] = identificarLotes(processos);
  assert.deepEqual(lote.assuntosComuns, ['Assunto 2']);
});
