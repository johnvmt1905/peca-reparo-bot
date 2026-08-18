const axios = require('axios');

/**
 * Baixa um arquivo do Slack (upload feito via file_input em modal).
 * Os arquivos do Slack são privados — é necessário enviar o bot token
 * no header Authorization pra conseguir baixar o binário.
 *
 * @param {string} url - url_private do objeto de arquivo retornado pelo Slack
 * @param {string} botToken
 * @returns {Promise<Buffer>}
 */
async function downloadSlackFile(url, botToken) {
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${botToken}` },
    responseType: 'arraybuffer',
  });

  return Buffer.from(response.data);
}

module.exports = { downloadSlackFile };
