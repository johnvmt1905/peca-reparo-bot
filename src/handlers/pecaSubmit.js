const axios = require('axios');
const { createCard, attachFile } = require('../services/trello');
const { downloadSlackFile } = require('../services/slackFiles');

function ultimosDigitos(texto, n = 4) {
  const limpo = (texto || '').trim();
  return limpo.length <= n ? limpo : limpo.slice(-n);
}

function montarDescricao(registro) {
  const tipoLabel = registro.tipo === 'continuo' ? 'Contínuo' : 'Intermitente';
  const hoje = new Date().toLocaleDateString('pt-BR');

  return [
    `CLIENTE: ${registro.cliente || ''}`,
    `MÁQUINA: ${registro.maquina || ''}`,
    `NºS MÁQUINA: ${registro.nsMaquina || ''}`,
    `PEÇA: ${registro.peca || ''}`,
    `MODELO: ${registro.modelo || ''}`,
    `NºS: ${registro.nsPeca || ''}`,
    `DEFEITO: ${registro.defeito || ''} (${tipoLabel})`,
    `DATA: ${hoje}`,
    `Nº NOTA FISCAL: `,
    `TÉCNICO: ${registro.tecnico || ''}`,
    `TAREFA: ${registro.tarefa || ''}`,
    `Nº O.S Gzero: `,
    `ORÇ. FORNECEDOR: `,
    `ORÇ. GZERO: `,
    `LOGISTICA / O.S. FORNECEDOR: `,
    `OBS: `,
  ].join('\n');
}

function registerPecaSubmit(app) {
  app.view('pecareparo_peca_submit', async ({ ack, view }) => {
    await ack();

    const registro = JSON.parse(view.private_metadata || '{}');
    const v = view.state.values;

    registro.modelo = v.modelo_block?.modelo_input?.value || '';
    registro.nsPeca = v.ns_peca_block?.ns_peca_input?.value || '';
    const arquivos = v.fotos_block?.fotos_input?.files || [];

    // Nome do cliente ajustado só pro título do card — a descrição usa o
    // nome completo original vindo da Auvo (registro.cliente, intocado)
    const clienteTitulo = (v.cliente_card_block?.cliente_card_input?.value || registro.cliente || '').toUpperCase();

    const titulo = `${clienteTitulo || 'CLIENTE'} - ${(registro.peca || 'PEÇA').toUpperCase()} - ${ultimosDigitos(
      registro.modelo
    )} - ${ultimosDigitos(registro.nsPeca)}`;

    const descricao = montarDescricao(registro);

    let card;
    try {
      card = await createCard({ title: titulo, description: descricao });
    } catch (err) {
      // Sem isso, uma falha na criação do card ficava completamente
      // silenciosa — o modal fechava e nada mais acontecia.
      console.error('Falha ao criar card no Trello:', err.response?.data || err.message);
      if (registro._origem?.responseUrl) {
        await axios.post(registro._origem.responseUrl, {
          replace_original: true,
          text: `:x: Erro ao enviar pro Trello: ${err.response?.data?.message || err.message}`,
        });
      }
      return;
    }

    // Sobe cada foto pro card (baixa do Slack usando o bot token e reenvia pro Trello)
    for (const arquivo of arquivos) {
      try {
        const buffer = await downloadSlackFile(arquivo.url_private, process.env.SLACK_BOT_TOKEN);
        await attachFile(card.id, buffer, arquivo.name);
      } catch (err) {
        console.error(`Falha ao anexar ${arquivo.name} no card:`, err.message);
      }
    }

    // Atualiza a mensagem original (na mesma conversa, seja DM entre duas
    // pessoas, canal etc.) usando o response_url guardado no clique do botão
    if (registro._origem?.responseUrl) {
      await axios.post(registro._origem.responseUrl, {
        replace_original: true,
        text: `Chamado enviado pro Trello: ${card.url}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:white_check_mark: *Enviado para o Trello*\n<${card.url}|${titulo}>`,
            },
          },
        ],
      });
    }
  });
}

module.exports = { registerPecaSubmit };