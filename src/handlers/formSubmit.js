const axios = require('axios');
const { CATEGORIAS } = require('../config/categorias');
const { extractFormValues } = require('../blocks/extractFormValues');

function registerFormSubmit(app) {
  app.view('pecareparo_form_submit', async ({ ack, view, body }) => {
    await ack();

    const values = extractFormValues(view);
    const meta = JSON.parse(view.private_metadata || '{}');

    const registro = {
      ...values,
      // cliente e técnico vêm da Auvo, guardados no private_metadata
      cliente: meta.cliente || '',
      tecnico: meta.tecnico || '',
      customerId: meta.customerId || null,
      equipmentsIds: meta.equipmentsIds || [],
      // máquina/N.S: usa o que está no modal se o usuário editou; senão cai
      // pro valor resolvido pela Auvo guardado no private_metadata — o
      // Slack não atualiza state.values quando o initial_value é setado
      // via views.update sem o usuário tocar no campo
      maquina: values.maquina || meta.maquina || '',
      nsMaquina: values.nsMaquina || meta.nsMaquina || '',
      abertoPor: body.user.id,
    };

    const tipoLabel = registro.tipo === 'continuo' ? 'Contínuo' : 'Intermitente';
    const categoriaLabel = CATEGORIAS[registro.categoria]?.label || '';

    if (!meta.responseUrl) {
      console.error('response_url ausente — não é possível postar o resumo na conversa de origem.');
      return;
    }

    // Posta na MESMA conversa onde o /pecareparo foi digitado (funciona em
    // DM entre duas pessoas, canal, thread etc. — sem o bot precisar ser
    // membro dela). response_type 'in_channel' garante que apareça pra
    // todo mundo naquela conversa, não só pra quem rodou o comando.
    await axios.post(meta.responseUrl, {
      response_type: 'in_channel',
      replace_original: false,
      text: `Novo chamado de peça de reparo — ${registro.peca}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Novo chamado de peça de reparo*\n` +
              `*Peça:* ${registro.peca}\n` +
              `*Defeito:* ${registro.defeito}\n` +
              `*Máquina:* ${registro.maquina}  |  *N.S.:* ${registro.nsMaquina}\n` +
              `*Tipo:* ${tipoLabel}  |  *Categoria:* ${categoriaLabel}\n` +
              `*Tarefa:* ${registro.tarefa}\n` +
              `*Cliente:* ${registro.cliente || '_não encontrado_'}  |  *Técnico:* ${registro.tecnico || '_não encontrado_'}`,
          },
        },
        {
          type: 'actions',
          block_id: 'enviar_trello_actions',
          elements: [
            {
              type: 'button',
              action_id: 'enviar_para_trello',
              style: 'primary',
              text: { type: 'plain_text', text: 'Enviar para o Trello' },
              value: JSON.stringify(registro),
            },
          ],
        },
      ],
    });
  });
}

module.exports = { registerFormSubmit };
