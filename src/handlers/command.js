const { buildFormModal } = require('../blocks/formModal');

function registerCommand(app) {
  app.command('/pecareparo', async ({ ack, body, client }) => {
    await ack();

    await client.views.open({
      trigger_id: body.trigger_id,
      // response_url do próprio comando: permite responder na mesma conversa
      // (inclusive DM entre duas outras pessoas) sem o bot precisar ser membro
      view: buildFormModal({ responseUrl: body.response_url }),
    });
  });
}

module.exports = { registerCommand };
