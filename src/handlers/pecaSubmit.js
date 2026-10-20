const axios = require('axios');
const { createCard, attachFile, getLabelIdByName } = require('../services/trello');
const { criarOSInterna } = require('../services/auvo');
const { CATEGORIAS } = require('../config/categorias');
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
    `Nº O.S Gzero: ${registro.osNumero || ''}`,
    ...(registro.tarefasInternas ? [`TAREFAS INTERNAS: ${registro.tarefasInternas}`] : []),
    `ORÇ. FORNECEDOR: `,
    `ORÇ. GZERO: `,
    `LOGISTICA / O.S. FORNECEDOR: `,
    `OBS: `,
  ].join('\n\n');
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

    // Subconjunto / Peça Eletrônica: cria a OS (+ 2 tarefas) na Auvo e
    // descobre a etiqueta do Trello. Falha aqui NÃO impede o card — só vira aviso.
    const avisos = [];
    const cat = CATEGORIAS[registro.categoria];
    const labelIds = [];

    if (cat?.auvo) {
      try {
        const os = await criarOSInterna({
          categoria: registro.categoria,
          customerId: registro.customerId,
          // Ex.: "LAB MECÂNICO INTERNO - <defeito informado no modal 1>"
          descricao: [cat.descricaoOS, (registro.defeito || '').replace(/\s+/g, ' ').trim()].filter(Boolean).join(' - '),
          resumo: `${registro.cliente || clienteTitulo} | ${registro.peca} | Tarefa origem ${registro.tarefa}`,
          equipmentsIds: registro.equipmentsIds || [],
        });
        if (os) {
          registro.osNumero = String(os.projectCode);
          const nomes = ['DESMONTAGEM', 'MONTAGEM'];
          avisos.push(...(os.avisos || []));
          registro.tarefasInternas = os.taskIds.map((id, i) => `${id} (${nomes[i] || 'EXTRA'})`).join(' / ');
        }
      } catch (err) {
        console.error('Falha ao criar OS na Auvo:', err.response?.data || err.message);
        avisos.push(`OS/tarefas não criadas na Auvo: ${JSON.stringify(err.response?.data || err.message)}`);
      }
    }

    if (cat?.trelloLabel) {
      try {
        const id = await getLabelIdByName(cat.trelloLabel);
        if (id) labelIds.push(id);
        else avisos.push(`etiqueta "${cat.trelloLabel}" não encontrada no Trello`);
      } catch (err) {
        console.error('Falha ao buscar etiqueta:', err.response?.data || err.message);
        avisos.push('não consegui aplicar a etiqueta no Trello');
      }
    }

    const descricao = montarDescricao(registro);

    let card;
    try {
      card = await createCard({ title: titulo, description: descricao, labelIds });
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
              text:
                `:white_check_mark: *Enviado para o Trello*\n<${card.url}|${titulo}>` +
                (registro.osNumero ? `\n*OS Auvo:* ${registro.osNumero}  |  *Tarefas:* ${registro.tarefasInternas}` : '') +
                (avisos.length ? `\n:warning: ${avisos.join(' | ')}` : ''),
            },
          },
        ],
      });
    }
  });
}

module.exports = { registerPecaSubmit };
