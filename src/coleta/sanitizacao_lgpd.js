/**
 * Minimização de dados conforme LGPD (Lei nº 13.709/2018, art. 6º, III e art. 23).
 * Descarta dados pessoais desnecessários à triagem (CPF, e-mail, telefone, endereço, filiação),
 * mantendo só o necessário para identificar partes, patronos (OAB) e enquadramento jurídico.
 */

const CAMPOS_CONTATO = ['emails', 'email', 'cpf', 'dddCelular', 'numeroCelular', 'dddTelefone',
  'numeroTelefone', 'telefone', 'endereco', 'enderecos', 'login', 'sexo'];

function semCampos(obj, campos) {
  const c = Object.assign({}, obj);
  for (const k of campos) delete c[k];
  return c;
}

export function sanitizarParteLGPD(parte) {
  if (!parte || typeof parte !== 'object') return parte;

  const clonada = semCampos(parte, CAMPOS_CONTATO);
  if (clonada.tipoDocumento === 'CPF') delete clonada.documento;

  if (clonada.pessoaFisica && typeof clonada.pessoaFisica === 'object') {
    clonada.pessoaFisica = semCampos(clonada.pessoaFisica,
      ['login', 'cpf', 'dataNascimento', 'nomeGenitora', 'nomeGenitor']);
  }

  // pessoaJuridica traz CPF e nome do responsável legal e login: guarda só o necessário.
  if (clonada.pessoaJuridica && typeof clonada.pessoaJuridica === 'object') {
    const pj = clonada.pessoaJuridica;
    clonada.pessoaJuridica = {
      nome: pj.nome, nomeFantasia: pj.nomeFantasia, cnpj: pj.cnpj,
      orgaoPublico: pj.orgaoPublico, dsTipoPessoa: pj.dsTipoPessoa
    };
  }

  if (Array.isArray(clonada.representantes)) {
    clonada.representantes = clonada.representantes.map(r =>
      semCampos(r, CAMPOS_CONTATO.concat(['documento'])));
  }

  return clonada;
}

/**
 * O objeto /processos/id/{id} traz, entre outros, CPF e e-mail do relator.
 * Guarda só uma lista fechada de campos usados no relatório.
 */
export function minimizarProcesso(processo) {
  if (!processo || typeof processo !== 'object') return processo;
  const p = processo;
  return {
    id: p.id,
    numero: p.numero,
    classeJudicial: p.classeJudicial ? {
      id: p.classeJudicial.id, codigo: p.classeJudicial.codigo,
      sigla: p.classeJudicial.sigla, descricao: p.classeJudicial.descricao
    } : null,
    autuadoEm: p.autuadoEm || null,
    distribuidoEm: p.distribuidoEm || null,
    dataInicio: p.dataInicio || null,
    valorDaCausa: p.valorDaCausa ?? null,
    justicaGratuita: p.justicaGratuita ?? null,
    tutelaOuLiminar: p.tutelaOuLiminar ?? null,
    segredoDeJustica: p.segredoDeJustica ?? null,
    faseProcessual: p.faseProcessual || null,
    labelFaseProcessual: p.labelFaseProcessual || null,
    codigoFaseProcessual: p.codigoFaseProcessual ?? null,
    apreciadoTutelaLiminar: p.apreciadoTutelaLiminar ?? null,
    transitoEmJulgado: p.transitoEmJulgado || null,
    incidente: p.incidente ?? null,
    relator: p.relator && p.relator.nome ? { nome: p.relator.nome } : null,
    orgaoJulgador: p.orgaoJulgador && p.orgaoJulgador.descricao ? { descricao: p.orgaoJulgador.descricao } : null
  };
}

export function sanitizarProcessoLGPD(registroBruto) {
  if (!registroBruto || typeof registroBruto !== 'object') return registroBruto;

  const clonado = Object.assign({}, registroBruto);

  if (clonado.partes && typeof clonado.partes === 'object') {
    const novasPartes = {};
    for (const polo of Object.keys(clonado.partes)) {
      const lista = clonado.partes[polo] || [];
      novasPartes[polo] = lista.map(sanitizarParteLGPD);
    }
    clonado.partes = novasPartes;
  }
  if (clonado.processo) clonado.processo = minimizarProcesso(clonado.processo);

  return clonado;
}
