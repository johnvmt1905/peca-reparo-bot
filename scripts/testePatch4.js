// TESTE: PATCH /tasks/{id} com corpo SIMPLES (campos soltos), como mostra o schema da doc.
// Uso: node scripts/testePatch4.js <taskId>     ex.: node scripts/testePatch4.js 81271484
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const taskId = process.argv[2];
if (!taskId) { console.error('Uso: node scripts/testePatch4.js <taskId>'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const auth = { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` };
  const ler = async () => { const { data } = await axios.get(`${BASE}/tasks/${taskId}`, { headers: auth }); return data?.result?.[0] || data?.result || data; };

  const antes = await ler();
  console.log(`Antes: tipo ${antes.taskType} | orientação: ${antes.orientation}`);

  const tentativas = [
    ['objeto simples {orientation}', 'application/json', { orientation: 'TESTE PATCH SIMPLES' }],
    ['objeto simples {taskType}', 'application/json', { taskType: 158060 }],
    ['objeto simples em lista [{orientation}]', 'application/json', [{ orientation: 'TESTE PATCH LISTA' }]],
  ];
  for (const [nome, ct, body] of tentativas) {
    try {
      const r = await axios.patch(`${BASE}/tasks/${taskId}`, body, { headers: { ...auth, 'Content-Type': ct } });
      console.log(`OK   | ${nome} | HTTP ${r.status}`);
    } catch (e) {
      console.log(`FALHA| ${nome} | HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
    }
  }
  const depois = await ler();
  console.log(`Depois: tipo ${depois.taskType} (${depois.taskTypeDescription}) | orientação: ${depois.orientation}`);
})().catch((e) => console.error(e.response?.data || e.message));
