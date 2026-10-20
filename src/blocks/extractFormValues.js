/**
 * Lê o view.state.values do modal 1 e devolve um objeto plano — usado tanto
 * pra reconstruir o modal (preservando o que o usuário já digitou) quanto
 * pra montar o registro final na submissão.
 */
function extractFormValues(view) {
  const v = view.state.values;
  // Máquina e N.S. têm block_id com sufixo variável (ver formModal.js)
  const porPrefixo = (prefixo, acao) => {
    const chave = Object.keys(v).find((k) => k.startsWith(prefixo));
    return (chave && v[chave]?.[acao]?.value) || '';
  };

  return {
    tarefa: v.tarefa_block?.tarefa_input?.value || '',
    peca: v.peca_block?.peca_input?.value || '',
    defeito: v.defeito_block?.defeito_input?.value || '',
    maquina: porPrefixo('maquina_block', 'maquina_input'),
    nsMaquina: porPrefixo('ns_maquina_block', 'ns_maquina_input'),
    tipo: v.tipo_block?.tipo_input?.selected_option?.value || '',
    categoria: v.categoria_block?.categoria_input?.selected_option?.value || '',
    // cliente/técnico não são inputs aqui — vêm do private_metadata (ver handler)
  };
}

module.exports = { extractFormValues };
