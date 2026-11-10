import test from 'node:test';
import assert from 'node:assert/strict';
import { ultimoDiaUtil, lerDataBR, janelaDesde, entrouNaJanela, descreverJanela } from '../src/entradas/periodo.js';
import { digitoFinal, assistentePeloDigito, montarEntradas } from '../src/entradas/montar_entradas.js';
import { coletarTriagem } from '../src/coleta/coletor.js';
import { processarLoteVT } from '../src/motor/hub_vt.js';
import { sanitizarProcessoLGPD } from '../src/coleta/sanitizacao_lgpd.js';
import { CONFIG } from '../src/config.js';

/* Dados INVENTADOS. */

test('último dia útil: terça → segunda; segunda → sexta; domingo → sexta', () => {
  assert.equal(ultimoDiaUtil(new Date(2026, 10, 10, 8)).getDate(), 9);   // ter 10/11 → seg 09/11
  assert.equal(ultimoDiaUtil(new Date(2026, 10, 9, 8)).getDate(), 6);    // seg 09/11 → sex 06/11
  assert.equal(ultimoDiaUtil(new Date(2026, 10, 8, 8)).getDate(), 6);    // dom 08/11 → sex 06/11
});

test('lerDataBR aceita dd/mm/aaaa e dd/mm/aa e recusa datas impossíveis', () => {
  assert.deepEqual(lerDataBR('06/11/2026'), new Date(2026, 10, 6));
  assert.deepEqual(lerDataBR('6/11/26'), new Date(2026, 10, 6));
  assert.equal(lerDataBR('31/02/2026'), null);
  assert.equal(lerDataBR('ontem'), null);
});

test('janela de segunda-feira cobre sexta a domingo e exclui hoje', () => {
  const agora = new Date(2026, 10, 9, 8, 30);
  const j = janelaDesde(ultimoDiaUtil(agora), agora);
  const item = iso => ({ dataEntradaTarefa: iso });
  assert.equal(entrouNaJanela(item('2026-11-06T00:00:00'), j), true);
  assert.equal(entrouNaJanela(item('2026-11-08T23:59:00'), j), true);
  assert.equal(entrouNaJanela(item('2026-11-09T07:00:00'), j), false);
  assert.equal(entrouNaJanela(item('2026-11-05T23:59:00'), j), false);
  assert.equal(entrouNaJanela({}, j), false);
  assert.deepEqual(descreverJanela(j), { legivel: 'de 06/11/2026 a 08/11/2026', arquivo: '06-11-2026 a 08-11-2026' });
  const terca = new Date(2026, 10, 10, 8);
  assert.equal(descreverJanela(janelaDesde(ultimoDiaUtil(terca), terca)).legivel, 'em 09/11/2026');
});

test('dígito final e assistente', () => {
  assert.equal(digitoFinal('0017784-75.2024.5.16.0002'), 4);
  assert.equal(assistentePeloDigito('0017784-75.2024.5.16.0002', CONFIG.DIVISAO_ASSISTENTES), 'Fábio Henrique');
  assert.equal(assistentePeloDigito('0016165-13.2024.5.16.0002', CONFIG.DIVISAO_ASSISTENTES), 'Alexsandro');
  assert.equal(digitoFinal('xyz'), null);
});

function item(i, entrada) {
  return { id: i, numeroProcesso: `00170${String(i).padStart(2, '0')}-10.2025.5.16.0002`, descricaoOrgaoJulgador: '2ª Vara do Trabalho de São Luís',
    classeJudicial: 'CumSen', faseProcessual: 'Execução', tarefa: 'Elaborar despacho', dataEntradaTarefa: entrada,
    nomeUsuarioResponsavel: 'SERVIDOR A', prioridadeProcessual: 0, segredoDeJustica: i === 3 };
}

function fetchFalso(itens) {
  const chamadas = [];
  const fn = async (url, opt) => {
    chamadas.push(url);
    const u = new URL(url);
    const json = body => ({ ok: true, status: 200, json: async () => body });
    if (u.pathname.endsWith('/processos') && opt.method === 'PATCH') return json({ qtdPaginas: 1, resultado: itens });
    const id = Number(u.pathname.split('/')[5]);
    if (u.pathname.endsWith('/partes')) {
      return json({ ATIVO: [{ nome: `TRABALHADOR ${id}`, tipoPessoa: 'F', tipoDocumento: 'CPF', cpf: '000', representantes: [{ numeroOab: 'MA1234' }] }],
        PASSIVO: [{ nome: 'EMPRESA ALFA LTDA', tipoPessoa: 'J', documento: '11.111.111/0001-11', tipoDocumento: 'CNPJ', pessoaJuridica: { nome: 'EMPRESA ALFA LTDA', cnpj: '11.111.111/0001-11' } }] });
    }
    if (u.pathname.endsWith('/assuntos')) return json([]);
    return json({ id, numero: itens.find(x => x.id === id).numeroProcesso, classeJudicial: { sigla: 'CumSen' }, segredoDeJustica: id === 3 });
  };
  return { fn, chamadas };
}

test('coletor com FILTRO_LISTAGEM só detalha os do período; arquivo .md sai completo', async () => {
  const agora = new Date(2026, 10, 9, 8, 30);
  const janela = janelaDesde(ultimoDiaUtil(agora), agora);
  const itens = [item(1, '2026-11-06T10:00:00'), item(2, '2026-11-08T09:00:00'), item(3, '2026-11-07T11:00:00'),
    item(4, '2026-10-01T09:00:00'), item(5, '2026-11-09T07:00:00')];
  const { fn, chamadas } = fetchFalso(itens);
  const coleta = await coletarTriagem({
    origin: 'https://pje.trt16.jus.br', xsrf: 'x', fetchFn: fn, esperar: async () => {},
    config: Object.assign({}, CONFIG, { FILTRO_LISTAGEM: it => entrouNaJanela(it, janela), DESCRICAO_FILTRO: 'teste', BUSCAR_PRIORIDADES: false })
  });
  assert.equal(coleta.totalNaCaixa, 5);
  assert.equal(coleta.registros.length, 3);
  assert.ok(!chamadas.some(u => /\/id\/4(\/|$)/.test(u)), 'não detalha quem está fora do período');

  const processos = processarLoteVT(coleta.registros, { agora });
  const { texto, nomeArquivo, qtd } = montarEntradas({
    processos, meta: { hostname: 'pje.trt16.jus.br', nomeCaixa: 'Minutar Despacho', geradoEm: agora, totalNaCaixa: 5,
      periodo: descreverJanela(janela), divisao: CONFIG.DIVISAO_ASSISTENTES, versao: 't' }
  });
  assert.equal(qtd, 3);
  assert.match(nomeArquivo, /^Entradas Minutar Despacho - 2ª Vara do Trabalho de São Luís \(TRT-16\) - 06-11-2026 a 08-11-2026 - gerado 09-11-2026 às 08h30\.md$/);
  const json = JSON.parse(texto.split('```json\n')[1].split('\n```')[0]);
  assert.deepEqual(json.processos.map(p => p.cnj), ['0017001-10.2025.5.16.0002', '0017003-10.2025.5.16.0002', '0017002-10.2025.5.16.0002']);
  assert.equal(json.processos[0].assistentePeloDigito, 'Fábio Henrique');
  const segredo = json.processos.find(p => p.segredoDeJustica);
  assert.equal(segredo.poloAtivo, 'SEGREDO DE JUSTIÇA');
  assert.ok(!texto.includes('TRABALHADOR 3'), 'segredo de justiça não expõe nomes');
  assert.ok(!texto.includes('000.000'), 'sem CPF');
  // 1 e 2: mesma reclamada + mesma OAB + mesma fase → lote
  assert.deepEqual(json.processos.filter(p => p.lotes.length).map(p => p.cnj).sort(),
    ['0017001-10.2025.5.16.0002', '0017002-10.2025.5.16.0002']);
});

test('sanitização continua valendo no caminho das entradas', () => {
  const r = sanitizarProcessoLGPD({ cnj: 'x', partes: { ATIVO: [{ nome: 'A', cpf: '1', emails: ['a@b'], tipoDocumento: 'CPF', documento: '1' }] } });
  assert.equal(r.partes.ATIVO[0].cpf, undefined);
  assert.equal(r.partes.ATIVO[0].documento, undefined);
});
