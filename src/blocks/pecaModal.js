/**
 * Monta o segundo modal, aberto ao clicar em "Enviar para o Trello".
 * @param {object} registro - todos os dados coletados no modal 1 (vão dentro
 *   do private_metadata pra sobreviver até a submissão deste segundo modal).
 */
function buildPecaModal(registro) {
  return {
    type: 'modal',
    callback_id: 'pecareparo_peca_submit',
    private_metadata: JSON.stringify(registro),
    title: { type: 'plain_text', text: 'Dados da Peça' },
    submit: { type: 'plain_text', text: 'Enviar pro Trello' },
    close: { type: 'plain_text', text: 'Cancelar' },
    blocks: [
      {
        type: 'input',
        block_id: 'cliente_card_block',
        label: { type: 'plain_text', text: 'Cliente (pro título do card)' },
        hint: {
          type: 'plain_text',
          text: 'Vem da Auvo — pode encurtar/ajustar aqui só pro título do Trello.',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'cliente_card_input',
          initial_value: registro.cliente || '',
        },
      },
      {
        type: 'input',
        block_id: 'modelo_block',
        label: { type: 'plain_text', text: 'Modelo da Peça' },
        element: { type: 'plain_text_input', action_id: 'modelo_input' },
      },
      {
        type: 'input',
        block_id: 'ns_peca_block',
        label: { type: 'plain_text', text: 'N.S. da Peça' },
        element: { type: 'plain_text_input', action_id: 'ns_peca_input' },
      },
      {
        type: 'input',
        block_id: 'fotos_block',
        optional: true,
        label: { type: 'plain_text', text: 'Fotos' },
        element: {
          type: 'file_input',
          action_id: 'fotos_input',
          filetypes: ['jpg', 'jpeg', 'png', 'heic'],
          max_files: 5,
        },
      },
    ],
  };
}

module.exports = { buildPecaModal };