/**
 * Monta o modal inicial (/pecareparo).
 *
 * @param {object} prefill - valores já preenchidos, usado tanto na abertura
 *   quanto ao atualizar o modal depois da busca automática na Auvo.
 * @param {string} prefill.tarefa
 * @param {string} prefill.cliente
 * @param {string} prefill.tecnico
 * @param {string} prefill.peca
 * @param {string} prefill.defeito
 * @param {string} prefill.maquina
 * @param {string} prefill.nsMaquina
 * @param {string} prefill.tipo - 'intermitente' | 'continuo'
 * @param {boolean} prefill.buscando - true enquanto aguarda resposta da Auvo
 */
function buildFormModal(prefill = {}) {
  // Cliente e Técnico só como referência automática da Auvo aqui — a edição
  // do Cliente (pra encurtar nome pro título do card) acontece no modal 2.
  const clienteTecnicoBlock = prefill.buscando
    ? {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: ':hourglass_flowing_sand: Buscando cliente e técnico na Auvo...' }],
      }
    : {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Cliente:* ${prefill.cliente || '_não encontrado_'}  |  *Técnico:* ${prefill.tecnico || '_não encontrado_'}`,
          },
        ],
      };

  return {
    type: 'modal',
    callback_id: 'pecareparo_form_submit',
    private_metadata: JSON.stringify({
      cliente: prefill.cliente || '',
      tecnico: prefill.tecnico || '',
      maquina: prefill.maquina || '',
      nsMaquina: prefill.nsMaquina || '',
      responseUrl: prefill.responseUrl || '',
    }),
    title: { type: 'plain_text', text: 'Peça de Reparo' },
    submit: { type: 'plain_text', text: 'Registrar' },
    close: { type: 'plain_text', text: 'Cancelar' },
    blocks: [
      {
        type: 'input',
        block_id: 'tarefa_block',
        label: { type: 'plain_text', text: 'Nº da Tarefa' },
        dispatch_action: true,
        element: {
          type: 'plain_text_input',
          action_id: 'tarefa_input',
          initial_value: prefill.tarefa || '',
          dispatch_action_config: { trigger_actions_on: ['on_enter_pressed'] },
        },
      },
      clienteTecnicoBlock,
      {
        type: 'input',
        block_id: 'peca_block',
        label: { type: 'plain_text', text: 'Peça' },
        element: {
          type: 'plain_text_input',
          action_id: 'peca_input',
          initial_value: prefill.peca || '',
        },
      },
      {
        type: 'input',
        block_id: 'defeito_block',
        label: { type: 'plain_text', text: 'Defeito' },
        element: {
          type: 'plain_text_input',
          action_id: 'defeito_input',
          multiline: true,
          initial_value: prefill.defeito || '',
        },
      },
      {
        type: 'input',
        block_id: 'maquina_block',
        label: { type: 'plain_text', text: 'Máquina' },
        element: {
          type: 'plain_text_input',
          action_id: 'maquina_input',
          initial_value: prefill.maquina || '',
        },
      },
      {
        type: 'input',
        block_id: 'ns_maquina_block',
        label: { type: 'plain_text', text: 'N.S. da Máquina' },
        element: {
          type: 'plain_text_input',
          action_id: 'ns_maquina_input',
          initial_value: prefill.nsMaquina || '',
        },
      },
      {
        type: 'input',
        block_id: 'tipo_block',
        label: { type: 'plain_text', text: 'Intermitente ou Contínuo' },
        element: {
          type: 'static_select',
          action_id: 'tipo_input',
          initial_option:
            prefill.tipo === 'continuo'
              ? { text: { type: 'plain_text', text: 'Contínuo' }, value: 'continuo' }
              : prefill.tipo === 'intermitente'
              ? { text: { type: 'plain_text', text: 'Intermitente' }, value: 'intermitente' }
              : undefined,
          options: [
            { text: { type: 'plain_text', text: 'Intermitente' }, value: 'intermitente' },
            { text: { type: 'plain_text', text: 'Contínuo' }, value: 'continuo' },
          ],
        },
      },
    ],
  };
}

module.exports = { buildFormModal };