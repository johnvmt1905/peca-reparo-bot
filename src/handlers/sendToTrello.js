const { buildPecaModal } = require('../blocks/pecaModal');

function registerSendToTrello(app) {
  app.action('enviar_para_trello', async ({ ack, body, client }) => {
    await ack();

    const registro = JSON.parse(body.actions[0].value);
    // guarda o response_url DESSE clique (é um novo, específico da mensagem
    // com o botão) pra poder atualizar a mensagem depois, mesmo numa DM
    // entre duas pessoas onde o bot não é membro
    registro._origem = { responseUrl: body.response_url };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildPecaModal(registro),
    });
  });
}

module.exports = { registerSendToTrello };
