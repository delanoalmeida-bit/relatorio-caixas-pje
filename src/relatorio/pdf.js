/*
 * Desenha o relatório (estrutura de dados_relatorio.js) em PDF com jsPDF.
 * Texto real e selecionável, formato "Rótulo: valor" (legível por pessoa e por IA).
 * Navegação: sumário clicável (pág. 2), marcadores na barra lateral, índice por CNJ e
 * linha de cada processo nas listagens com link para a ficha.
 */

export const A4 = { largura: 210, altura: 297 };
export const MARGEM_X = 15;
export const TOPO = 20;
export const BASE = 282;
export const LARGURA_UTIL = A4.largura - 2 * MARGEM_X;
const PT_MM = 0.3528;
export const COR_TEXTO = [20, 20, 20];
export const COR_SUAVE = [90, 90, 90];
export const COR_LINHA = [190, 190, 190];
export const COR_TITULO = [20, 50, 120];

export const alturaLinha = tam => tam * PT_MM * 1.3;

export class Escritor {
  constructor(doc) {
    this.doc = doc;
    this.y = TOPO;
  }

  get pagina() { return this.doc.getCurrentPageInfo().pageNumber; }

  novaPagina() {
    this.doc.addPage();
    this.y = TOPO;
  }

  garantir(altura) {
    if (this.y + altura > BASE) this.novaPagina();
  }

  fonte(tam, estilo = 'normal', cor = COR_TEXTO) {
    this.doc.setFont('helvetica', estilo);
    this.doc.setFontSize(tam);
    this.doc.setTextColor(...cor);
  }

  espaco(mm) { this.y += mm; }

  /** Parágrafo com quebra automática. Devolve {pagina, y, altura} da 1ª linha (para links). */
  texto(str, { tam = 9, estilo = 'normal', cor = COR_TEXTO, recuo = 0 } = {}) {
    this.fonte(tam, estilo, cor);
    const lh = alturaLinha(tam);
    const linhas = this.doc.splitTextToSize(String(str), LARGURA_UTIL - recuo);
    let primeira = null;
    for (const linha of linhas) {
      this.garantir(lh);
      if (!primeira) primeira = { pagina: this.pagina, y: this.y, altura: lh };
      this.doc.text(linha, MARGEM_X + recuo, this.y + lh * 0.75);
      this.y += lh;
    }
    return primeira;
  }

  medirCampo(rotulo, valor, tam = 9) {
    this.fonte(tam, 'bold');
    const w = this.doc.getTextWidth(rotulo + ': ');
    this.fonte(tam);
    return this.doc.splitTextToSize(String(valor), LARGURA_UTIL - w).length * alturaLinha(tam);
  }

  /** "Rótulo: valor" com o valor recuado (recuo pendente). */
  campo(rotulo, valor, { tam = 9 } = {}) {
    const lh = alturaLinha(tam);
    this.fonte(tam, 'bold');
    const w = this.doc.getTextWidth(rotulo + ': ');
    this.fonte(tam);
    const linhas = this.doc.splitTextToSize(String(valor), LARGURA_UTIL - w);
    linhas.forEach((linha, i) => {
      this.garantir(lh);
      if (i === 0) {
        this.fonte(tam, 'bold');
        // espaço real após ":" para a extração de texto (IA) não colar rótulo e valor
        this.doc.text(rotulo + ': ', MARGEM_X, this.y + lh * 0.75);
        this.fonte(tam);
      }
      this.doc.text(linha, MARGEM_X + w, this.y + lh * 0.75);
      this.y += lh;
    });
  }

  /** Vários pares curtos na mesma linha: "A: x   |   B: y". Um par só → campo() com quebra. */
  pares(lista, { tam = 9 } = {}) {
    if (lista.length === 1) return this.campo(lista[0][0], lista[0][1], { tam });
    const lh = alturaLinha(tam);
    const sep = '   |   ';
    this.garantir(lh);
    let x = MARGEM_X;
    lista.forEach(([r, v], i) => {
      this.fonte(tam);
      const wSep = i > 0 ? this.doc.getTextWidth(sep) : 0;
      this.fonte(tam, 'bold');
      const wr = this.doc.getTextWidth(r + ': ');
      this.fonte(tam);
      const wv = this.doc.getTextWidth(String(v));
      if (i > 0 && x + wSep + wr + wv > A4.largura - MARGEM_X) {
        this.y += lh; this.garantir(lh); x = MARGEM_X;
      } else if (i > 0) {
        this.doc.setTextColor(...COR_LINHA);
        this.doc.text(sep, x, this.y + lh * 0.75);
        this.doc.setTextColor(...COR_TEXTO);
        x += wSep;
      }
      this.fonte(tam, 'bold');
      this.doc.text(r + ': ', x, this.y + lh * 0.75);
      this.fonte(tam);
      this.doc.text(String(v), x + wr, this.y + lh * 0.75);
      x += wr + wv;
    });
    this.y += lh;
  }

  medirPares(lista, tam = 9) {
    if (lista.length === 1) return this.medirCampo(lista[0][0], lista[0][1], tam);
    return alturaLinha(tam) * 2; // estimativa conservadora (pode quebrar em 2)
  }

  linhaHorizontal() {
    this.doc.setDrawColor(...COR_LINHA);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGEM_X, this.y, A4.largura - MARGEM_X, this.y);
  }

  tituloSecao(texto) {
    this.fonte(14, 'bold', COR_TITULO);
    const lh = alturaLinha(14);
    this.doc.text(texto, MARGEM_X, this.y + lh * 0.75);
    this.y += lh + 1;
    this.doc.setDrawColor(...COR_TITULO);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGEM_X, this.y, A4.largura - MARGEM_X, this.y);
    this.y += 4;
  }
}

/**
 * Gera o PDF.
 * @param {object} rel  saída de montarRelatorio()
 * @param {Function} JsPDF  construtor jsPDF
 * @returns {object} documento jsPDF (chamar .save(rel.nomeArquivo) no navegador)
 */
export function gerarPdf(rel, JsPDF) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  const titulo = `Relatório de Triagem - ${rel.capa.tribunal} - ${rel.capa.orgao}`;
  doc.setProperties({
    title: titulo,
    subject: `Caixa Triagem gerada em ${rel.capa.geradoEm}`,
    creator: `relatoriodetriagem ${rel.capa.versao}`.trim(),
    keywords: 'PJe, triagem, TRT'
  });
  if (doc.setLanguage) doc.setLanguage('pt-BR');

  const e = new Escritor(doc);
  const secoes = [];         // {titulo, pagina}
  const paginaFicha = new Map(); // ordem -> página
  const linksParaFicha = []; // {pagina, x, y, w, h, ordem}

  const abrirSecao = (tituloSecao, { novaPagina = true } = {}) => {
    if (novaPagina) e.novaPagina();
    secoes.push({ titulo: tituloSecao, pagina: e.pagina });
    e.tituloSecao(tituloSecao);
  };

  /**
   * Processo nas listagens, numa linha: "CNJ: ... | Classe: AP | Entrada: ..."
   * seguido dos pares extras. A linha inteira é link para a ficha.
   */
  const escreverLinhaProcesso = (lp, extras = [], { prefixo = '' } = {}) => {
    const texto = [prefixo, `CNJ: ${lp.cnj}`, `Classe: ${lp.classe}`,
      `Entrada: ${lp.entrada}`, ...extras.map(([r, v]) => `${r}: ${v}`)].filter(Boolean).join(' | ');
    const pos = e.texto(texto, { tam: 8.5 });
    if (pos) linksParaFicha.push({ pagina: pos.pagina, x: MARGEM_X, y: pos.y, w: LARGURA_UTIL, h: pos.altura, ordem: lp.ordem });
    e.espaco(0.8);
  };

  const listaVazia = msg => e.texto(msg, { tam: 9, cor: COR_SUAVE });

  // 1. Capa
  const c = rel.capa;
  e.y = 40;
  e.texto('RELATÓRIO DE TRIAGEM', { tam: 22, estilo: 'bold', cor: COR_TITULO });
  e.texto('PJe 2º Grau - caixa Triagem', { tam: 13, cor: COR_SUAVE });
  e.espaco(8);
  e.linhaHorizontal();
  e.espaco(6);
  e.campo('Tribunal', c.tribunal, { tam: 11 });
  e.campo('Órgão julgador', c.orgao, { tam: 11 });
  e.campo('Gerado em', c.geradoEm, { tam: 11 });
  e.campo('Critério', c.criterio, { tam: 11 });
  e.campo('Processos na caixa Triagem', String(c.totalNaCaixa), { tam: 11 });
  e.campo('Processos neste relatório', String(c.noRelatorio), { tam: 11 });
  e.campo('Processos não lidos', String(c.naoLidos), { tam: 11 });
  e.espaco(10);
  e.texto('Como usar este PDF', { tam: 11, estilo: 'bold' });
  e.espaco(1);
  [
    'O sumário (página 2) e os marcadores na barra lateral do leitor de PDF levam a cada seção.',
    'Nas listagens, clique na linha do processo para abrir a ficha completa. Para achar um CNJ específico, use a busca do leitor de PDF (Ctrl+F).',
    'Um mesmo processo aparece em todas as seções a que pertence. O PDF pode ser enviado a uma IA para outras análises.',
    'Dados pessoais (CPF, e-mail, telefone, endereço) foram descartados. Em segredo de justiça, as partes aparecem como "SEGREDO DE JUSTIÇA".'
  ].forEach(t => e.texto('- ' + t, { tam: 9.5, recuo: 2 }));

  // 2. Sumário (preenchido no fim)
  e.novaPagina();
  const paginaSumario = e.pagina;

  // 4. Fazenda sem MPT
  abrirSecao(`Fazenda Pública sem MPT (${rel.fazendaSemMpt.length})`);
  e.texto('Ente público no processo e Ministério Público do Trabalho não cadastrado. Providência: retificar a autuação.', { tam: 9, cor: COR_SUAVE });
  e.espaco(2);
  if (!rel.fazendaSemMpt.length) listaVazia('Nenhum processo nesta situação.');
  for (const lp of rel.fazendaSemMpt) escreverLinhaProcesso(lp, [['Partes', lp.partes], lp.extra]);

  // 5. Físicos
  abrirSecao(`Processos físicos migrados (${rel.fisicos.length})`);
  e.texto('Número iniciado por 0 (acervo físico migrado para o PJe) ou termo de migração. Verificar prevenção.', { tam: 9, cor: COR_SUAVE });
  e.espaco(2);
  if (!rel.fisicos.length) listaVazia('Nenhum processo nesta situação.');
  for (const lp of rel.fisicos) escreverLinhaProcesso(lp, [['Partes', lp.partes], lp.extra]);

  // 6. Sindicatos
  abrirSecao(`Processos com sindicato (${rel.sindicatos.length})`);
  if (!rel.sindicatos.length) listaVazia('Nenhum processo com sindicato, federação ou confederação.');
  for (const lp of rel.sindicatos) escreverLinhaProcesso(lp, [['Partes', lp.partes], lp.extra]);

  // 7. Por reclamada
  abrirSecao(`Listagem por reclamada (${rel.reclamadas.length})`);
  e.texto('Empresas e entes nos polos ativo ou passivo, com todos os seus processos. Só reclamadas com 2 ou mais processos; quem tem mais vem primeiro. Processos em segredo de justiça não entram nesta seção.', { tam: 9, cor: COR_SUAVE });
  e.espaco(2);
  if (!rel.reclamadas.length) listaVazia('Nenhuma reclamada com mais de um processo.');
  for (const r of rel.reclamadas) {
    e.garantir(alturaLinha(10) * 3);
    e.texto(`RECLAMADA: ${r.nome}`, { tam: 10, estilo: 'bold', cor: COR_TITULO });
    e.texto(`Quantidade de processos: ${r.processos.length} | CNPJ: ${r.cnpjs.length ? r.cnpjs.join(', ') : 'não informado'}`, { tam: 8.5, cor: COR_SUAVE });
    e.espaco(1);
    for (const lp of r.processos) escreverLinhaProcesso(lp, [['Reclamante', lp.reclamante]]);
    e.espaco(2);
  }
  // 8. Lotes
  abrirSecao(`Lotes: mesma reclamada + mesmo advogado (${rel.lotes.length})`);
  e.texto('Dois ou mais processos com a mesma reclamada e o mesmo cadastro de OAB do lado do trabalhador. O nome do advogado não é exibido.', { tam: 9, cor: COR_SUAVE });
  e.espaco(2);
  if (!rel.lotes.length) listaVazia('Nenhum lote identificado.');
  for (const l of rel.lotes) {
    e.garantir(alturaLinha(10) * 3);
    e.texto(`LOTE Nº ${l.numero}: ${l.reclamadas.join('; ')}`, { tam: 10, estilo: 'bold', cor: COR_TITULO });
    e.texto(`Quantidade de processos: ${l.processos.length} | Critério: mesma reclamada e mesmo cadastro de OAB`, { tam: 8.5, cor: COR_SUAVE });
    e.texto(`Assuntos em comum: ${l.assuntosComuns.length ? l.assuntosComuns.join('; ') : 'nenhum'}`, { tam: 8.5, cor: COR_SUAVE });
    e.espaco(1);
    for (const lp of l.processos) escreverLinhaProcesso(lp, [['Reclamante', lp.reclamante]]);
    e.espaco(2);
  }

  // 9. Fichas
  abrirSecao(`Ficha de cada processo (${rel.fichas.length})`);
  e.texto('Em ordem de entrada na caixa Triagem: do que espera há mais tempo para o mais recente.', { tam: 9, cor: COR_SUAVE });
  e.espaco(3);
  const lhTituloFicha = alturaLinha(10.5);
  for (const f of rel.fichas) {
    const altura = lhTituloFicha + 2 + f.linhas.reduce((s, l) => s + e.medirPares(l), 0) + 4;
    if (altura <= BASE - TOPO) e.garantir(altura);
    else e.garantir(lhTituloFicha * 4);
    paginaFicha.set(f.ordem, e.pagina);
    e.texto(`PROCESSO ${f.cnj}`, { tam: 10.5, estilo: 'bold', cor: COR_TITULO });
    e.espaco(1);
    for (const l of f.linhas) e.pares(l);
    e.espaco(2);
    e.linhaHorizontal();
    e.espaco(3);
  }

  // 11. Não lidos
  if (rel.naoLidos.length) {
    abrirSecao(`Processos não lidos (${rel.naoLidos.length})`);
    e.texto('O PJe falhou nestes processos mesmo após novas tentativas. Gere o relatório de novo mais tarde.', { tam: 9, cor: COR_SUAVE });
    e.espaco(2);
    for (const n of rel.naoLidos) e.campo(n.cnj, n.motivo);
  }

  // Links das listagens para as fichas
  for (const l of linksParaFicha) {
    const destino = paginaFicha.get(l.ordem);
    if (!destino) continue;
    doc.setPage(l.pagina);
    doc.link(l.x, l.y, l.w, l.h, { pageNumber: destino });
  }

  // Sumário + marcadores
  doc.setPage(paginaSumario);
  e.y = TOPO;
  e.tituloSecao('Sumário');
  e.fonte(11);
  const lhSum = alturaLinha(11) + 2;
  for (const s of secoes) {
    e.fonte(11);
    doc.text(s.titulo, MARGEM_X, e.y + lhSum * 0.7);
    doc.text(`pág. ${s.pagina}`, A4.largura - MARGEM_X, e.y + lhSum * 0.7, { align: 'right' });
    doc.link(MARGEM_X, e.y, LARGURA_UTIL, lhSum, { pageNumber: s.pagina });
    e.y += lhSum;
  }
  if (doc.outline && doc.outline.add) {
    doc.outline.add(null, 'Capa', { pageNumber: 1 });
    doc.outline.add(null, 'Sumário', { pageNumber: paginaSumario });
    for (const s of secoes) doc.outline.add(null, s.titulo, { pageNumber: s.pagina });
  }

  // Cabeçalho e rodapé em todas as páginas (menos a capa)
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COR_SUAVE);
    if (i > 1) {
      doc.text(titulo, MARGEM_X, 10, { maxWidth: LARGURA_UTIL - 45 });
      doc.text(`Gerado em ${c.geradoEm}`, A4.largura - MARGEM_X, 10, { align: 'right' });
      doc.setDrawColor(...COR_LINHA);
      doc.setLineWidth(0.2);
      doc.line(MARGEM_X, 12.5, A4.largura - MARGEM_X, 12.5);
    }
    doc.text(`pág. ${i} de ${total}`, A4.largura / 2, A4.altura - 8, { align: 'center' });
  }
  doc.setPage(total);
  return doc;
}
