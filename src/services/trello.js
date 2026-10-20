const axios = require('axios');
const FormData = require('form-data');

const TRELLO_BASE = 'https://api.trello.com/1';

function authParams() {
  return {
    key: process.env.TRELLO_KEY,
    token: process.env.TRELLO_TOKEN,
  };
}

/**
 * Cria um card na lista fixa configurada em TRELLO_LIST_ID.
 * @returns {Promise<{id: string, url: string}>}
 */
let cachedBoardLabels = null;

function normalizar(t) {
  return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

/**
 * Descobre o id de uma etiqueta do quadro pelo nome (cache em memória).
 * Retorna null se não achar — o card é criado sem etiqueta nesse caso.
 */
async function getLabelIdByName(nome) {
  if (!nome) return null;
  if (!cachedBoardLabels) {
    const { data: lista } = await axios.get(`${TRELLO_BASE}/lists/${process.env.TRELLO_LIST_ID}`, {
      params: { ...authParams(), fields: 'idBoard' },
    });
    const { data: labels } = await axios.get(`${TRELLO_BASE}/boards/${lista.idBoard}/labels`, {
      params: { ...authParams(), limit: 1000, fields: 'name,color' },
    });
    cachedBoardLabels = labels;
  }
  const alvo = normalizar(nome);
  const achada = cachedBoardLabels.find((l) => normalizar(l.name) === alvo);
  if (!achada) console.warn(`Etiqueta "${nome}" não encontrada no quadro do Trello.`);
  return achada ? achada.id : null;
}

async function createCard({ title, description, labelIds = [] }) {
  const { data } = await axios.post(`${TRELLO_BASE}/cards`, null, {
    params: {
      ...authParams(),
      idList: process.env.TRELLO_LIST_ID,
      name: title,
      desc: description,
      ...(labelIds.length ? { idLabels: labelIds.join(',') } : {}),
    },
  });

  return { id: data.id, url: data.shortUrl || data.url };
}

/**
 * Anexa um arquivo (buffer) a um card já criado.
 * @param {string} cardId
 * @param {Buffer} fileBuffer
 * @param {string} filename
 */
async function attachFile(cardId, fileBuffer, filename) {
  const form = new FormData();
  form.append('file', fileBuffer, filename);

  await axios.post(`${TRELLO_BASE}/cards/${cardId}/attachments`, form, {
    params: authParams(),
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });
}

module.exports = { createCard, attachFile, getLabelIdByName };
