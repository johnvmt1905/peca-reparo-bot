const { buildFormModal } = require('../blocks/formModal');
const { extractFormValues } = require('../blocks/extractFormValues');
const { getTaskInfo } = require('../services/auvo');

function registerTaskLookup(app) {
  app.action('tarefa_input', async ({ ack, body, client }) => {
    await ack();

    const view = body.view;
    const values = extractFormValues(view);
    const meta = JSON.parse(view.private_metadata || '{}');

    if (!values.tarefa) return;

    // Atualiza o modal mostrando "buscando..." enquanto consulta a Auvo
    await client.views.update({
      view_id: view.id,
      hash: view.hash,
      view: buildFormModal({ ...values, responseUrl: meta.responseUrl, buscando: true }),
    });

    const { cliente, tecnico, maquina, nsMaquina, encontrado } = await getTaskInfo(values.tarefa);

    await client.views.update({
      view_id: view.id,
      view: buildFormModal({
        ...values,
        responseUrl: meta.responseUrl,
        cliente: encontrado ? cliente : '',
        tecnico: encontrado ? tecnico : '',
        maquina: encontrado && maquina ? maquina : values.maquina,
        nsMaquina: encontrado && nsMaquina ? nsMaquina : values.nsMaquina,
      }),
    });
  });
}

module.exports = { registerTaskLookup };