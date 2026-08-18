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
async function createCard({ title, description }) {
  const { data } = await axios.post(`${TRELLO_BASE}/cards`, null, {
    params: {
      ...authParams(),
      idList: process.env.TRELLO_LIST_ID,
      name: title,
      desc: description,
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

module.exports = { createCard, attachFile };
