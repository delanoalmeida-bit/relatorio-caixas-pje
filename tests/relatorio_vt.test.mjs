import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { jsPDF } from 'jspdf';
import { gerarRelatorio } from '../src/relatorio/gerar.js';
import { sanitizarProcessoLGPD } from '../src/coleta/sanitizacao_lgpd.js';
import { faseDoProcesso, textoPrioridades } from '../src/motor/hub_vt.js';

/*
 * Dados INVENTADOS, no formato real do PJe 1º grau (TRT-16, agrupamento 16),
 * conferido pela estrutura devolvida pela API em 07/11/2026. Nenhum dado real.
 */
const GERADO = new Date(2026, 10, 7, 15, 40);
const FASES = ['Conhecimento', 'Liquidação', 'Execução'];
const RESP = ['SERVIDOR A', 'SERVIDOR B', 'SERVIDOR C', null];
const EMPRESAS = [
  { nome: 'EMPRESA ALFA LTDA', cnpj: '11.111.111/0001-11' },
  { nome: 'EMPRESA ALFA LTDA', cnpj: '11.111.111/0002-92' },
  { nome: 'MUNICIPIO DE SAO LUIS', cnpj: '06.307.102/0001-30', orgaoPublico: true },
  { nome: 'COMERCIAL BETA S/A - EM RECUPERACAO JUDICIAL', cnpj: '22.222.222/0001-22' },
  { nome: 'MASSA FALIDA DE GAMA INDUSTRIA LTDA', cnpj: '33.333.333/0001-33' },
  { nome: 'SERVICOS DELTA EIRELI', cnpj: '44.444.444/0001-44' }
];

function registro(i) {
  const emp = EMPRESAS[i % EMPRESAS.length];
  const fase = FASES[i % 3];
  const sindical = i % 17 === 0;
  const entrada = new Date(2026, 3, 27 + (i * 1.3 | 0), 9, 0).toISOString().replace('Z', '');
  const cnj = `${i % 11 === 0 ? '0' : '1'}${String(1000 + i).padStart(6, '0')}-${String(i % 90).padStart(2, '0')}.20${i % 11 === 0 ? '15' : '24'}.5.16.0002`;
  const autor = sindical
    ? { nome: 'SINDICATO DOS TRABALHADORES DO COMERCIO DE SAO LUIS', tipo: 'AUTOR', tipoPessoa: 'J', documento: '55.555.555/0001-55', tipoDocumento: 'CNPJ',
      pessoaJuridica: { nome: 'SINDICATO', cnpj: '55.555.555/0001-55', numeroCpfResponsavel: '999.888.777-66', nomeResponsavel: 'DIRIGENTE X', login: 'x', orgaoPublico: false } }
    : { nome: `TRABALHADOR FICTICIO ${i}`, tipo: 'RECLAMANTE', tipoPessoa: 'F', documento: `000.000.${String(i).padStart(3, '0')}-00`, tipoDocumento: 'CPF', cpf: '000.000.000-00', emails: ['t@x.com'] };
  autor.representantes = [{ tipo: 'ADVOGADO', numeroOab: i % 4 === 0 ? 'MA1234' : `MA${5000 + i}`, nome: 'ADVOGADO FICTICIO', cpf: '111.111.111-11', email: 'adv@x.com', documento: '111' }];
  const reu = { nome: emp.nome, tipo: 'RECLAMADO', tipoPessoa: 'J', documento: emp.cnpj, tipoDocumento: 'CNPJ',
    pessoaJuridica: { nome: emp.nome, cnpj: emp.cnpj, orgaoPublico: Boolean(emp.orgaoPublico), numeroCpfResponsavel: '999.888.777-66', nomeResponsavel: 'SOCIO Y', login: 'y' },
    endereco: { logradouro: 'RUA FICTICIA' }, representantes: [] };
  return {
    cnj, idProcesso: i,
    listagem: {
      id: i, numeroProcesso: cnj, descricaoOrgaoJulgador: '2ª Vara do Trabalho de São Luís', idAgrupamento: 16,
      classeJudicial: i % 5 === 0 ? 'ATSum' : fase === 'Execução' ? 'CumSen' : 'ATOrd', segredoDeJustica: i === 7,
      faseProcessual: fase, tarefa: i % 9 === 0 ? 'Elaborar decisão' : 'Elaborar despacho', dataEntradaTarefa: entrada,
      nomeUsuarioResponsavel: RESP[i % 4], idUsuarioResponsavel: RESP[i % 4] ? 100 + (i % 4) : null,
      prazoExpirado: i % 13 === 0, temComentario: i % 10 === 0, prioridadeProcessual: i % 8 === 0 ? 164 : 0,
      qtdeParteAutora: sindical ? 81 : 1, qtdeParteRe: 1, nomeConclusoMagistrado: 'JUIZ FICTICIO'
    },
    processo: {
      id: i, numero: cnj, classeJudicial: { sigla: i % 5 === 0 ? 'ATSum' : 'ATOrd', descricao: i % 5 === 0 ? 'Ação Trabalhista - Rito Sumaríssimo' : 'Ação Trabalhista - Rito Ordinário' },
      autuadoEm: '2024-03-10T10:00:00', valorDaCausa: 10000 + i * 137.5, justicaGratuita: i % 2 === 0, segredoDeJustica: i === 7,
      labelFaseProcessual: fase, usuarioCadastroProcesso: { nome: 'X', login: 'y' }
    },
    partes: { ATIVO: [autor], PASSIVO: [reu] },
    assuntos: [{ principal: true, assunto: { codigo: '2581', descricao: 'Horas Extras', assuntoResumido: 'Duração do Trabalho / Horas Extras' } },
      { principal: false, assunto: { codigo: '1855', descricao: 'FGTS', assuntoResumido: 'FGTS' } }],
    prioridades: i % 8 === 0 ? (i % 16 === 0 ? [{ descricao: 'Idoso(a)' }] : 'Doença grave') : null
  };
}

const registros = Array.from({ length: 150 }, (_, i) => sanitizarProcessoLGPD(registro(i + 1)));

test('fase e prioridade aceitam variações do PJe', () => {
  assert.equal(faseDoProcesso({ listagem: { faseProcessual: 'EXECUCAO' } }), 'Execução');
  assert.equal(faseDoProcesso({ processo: { labelFaseProcessual: 'Liquidação' } }), 'Liquidação');
  assert.deepEqual(textoPrioridades([{ descricao: 'Idoso(a)' }, 'Idoso(a)']), ['Idoso(a)']);
  assert.deepEqual(textoPrioridades(null), []);
});

test('sanitização remove CPF de responsável legal da empresa', () => {
  const t = JSON.stringify(registros);
  assert.doesNotMatch(t, /999\.888|DIRIGENTE X|SOCIO Y|000\.000\.0|111\.111\.111-11|@x\.com|RUA FICTICIA/);
});

test('relatório da caixa Minutar Despacho (dados inventados)', () => {
  const { rel, doc } = gerarRelatorio({
    registros,
    falhas: [{ cnj: '1009999-00.2026.5.16.0002', motivo: 'HTTP 500 em /processos/id/9999/partes' }],
    meta: { hostname: 'pje.trt16.jus.br', totalNaCaixa: 151, criterio: 'Caixa Minutar Despacho, todos os processos',
      nomeCaixa: 'Minutar Despacho', geradoEm: GERADO, versao: 'teste' },
    JsPDF: jsPDF
  });
  assert.equal(rel.nomeArquivo, 'Relatório Minutar Despacho - 2ª Vara do Trabalho de São Luís (TRT-16) - 07-11-2026 às 15h40.pdf');
  assert.equal(rel.fichas.length, 150);
  assert.equal(rel.panorama.porFase.map(f => f.rotulo).join(','), 'Conhecimento,Liquidação,Execução');
  assert.equal(rel.panorama.porFase.reduce((s, f) => s + f.qtd, 0), 150);
  assert.equal(rel.panorama.porTempo.reduce((s, f) => s + f.qtd, 0), 150);
  assert.equal(rel.panorama.porResponsavel.at(-1).rotulo, 'Sem responsável');
  assert.equal(rel.prioridades.length, registros.filter(r => r.listagem.prioridadeProcessual).length);
  assert.ok(rel.entesPublicos.length > 0 && rel.recuperacaoFalencia.length > 0 && rel.sindicatos.length > 0);
  assert.ok(rel.lotes.length > 0 && rel.lotes.every(l => new Set(l.processos.map(p => p.fase)).size === 1), 'lote mistura fases');
  // Ordem por entrada na caixa
  const mapa = new Map(registros.map(r => [r.cnj, new Date(r.listagem.dataEntradaTarefa).getTime()]));
  const datas = rel.fichas.map(f => mapa.get(f.cnj));
  for (let i = 1; i < datas.length; i++) assert.ok(datas[i - 1] <= datas[i]);
  // Segredo de justiça não vaza nome
  assert.ok(!JSON.stringify(rel.fichas.find(f => f.cnj === registros[6].cnj)).includes('TRABALHADOR FICTICIO 7'));
  assert.ok(doc.getNumberOfPages() > 10);
  if (process.env.VT_PDF_SAIDA) fs.writeFileSync(process.env.VT_PDF_SAIDA, Buffer.from(doc.output('arraybuffer')));
});
