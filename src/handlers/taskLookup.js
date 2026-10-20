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
      view: buildFormModal({ ...values, responseUrl: meta.responseUrl, customerId: meta.customerId, equipmentsIds: meta.equipmentsIds, rev: Date.now(), buscando: true }),
    });

    const { cliente, tecnico, maquina, nsMaquina, customerId, equipmentsIds, encontrado } = await getTaskInfo(values.tarefa);

    await client.views.update({
      view_id: view.id,
      view: buildFormModal({
        ...values,
        responseUrl: meta.responseUrl,
        rev: Date.now(),
        cliente: encontrado ? cliente : '',
        tecnico: encontrado ? tecnico : '',
        customerId: encontrado ? customerId : null,
        equipmentsIds: encontrado ? equipmentsIds : [],
        maquina: encontrado && maquina ? maquina : values.maquina,
        nsMaquina: encontrado && nsMaquina ? nsMaquina : values.nsMaquina,
      }),
    });
  });
}

module.exports = { registerTaskLookup };
