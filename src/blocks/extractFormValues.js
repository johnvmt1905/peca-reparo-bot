/**
 * Lê o view.state.values do modal 1 e devolve um objeto plano — usado tanto
 * pra reconstruir o modal (preservando o que o usuário já digitou) quanto
 * pra montar o registro final na submissão.
 */
function extractFormValues(view) {
  const v = view.state.values;

  return {
    tarefa: v.tarefa_block?.tarefa_input?.value || '',
    peca: v.peca_block?.peca_input?.value || '',
    defeito: v.defeito_block?.defeito_input?.value || '',
    maquina: v.maquina_block?.maquina_input?.value || '',
    nsMaquina: v.ns_maquina_block?.ns_maquina_input?.value || '',
    tipo: v.tipo_block?.tipo_input?.selected_option?.value || '',
    // cliente/técnico não são inputs aqui — vêm do private_metadata (ver handler)
  };
}

module.exports = { extractFormValues };