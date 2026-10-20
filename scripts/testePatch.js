// TESTE (altera 1 tarefa de teste!): descobre o formato do PATCH /tasks/{id}.
// Uso: node scripts/testePatch.js <taskId> <projectCode>     (use a 2ª tarefa da OS de teste, ex.: 81271485 1181)
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [taskId, projectCode] = [process.argv[2], process.argv[3]];
if (!taskId) { console.error('Uso: node scripts/testePatch.js <taskId> <projectCode>'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  const tentativas = [
    ['objeto único, orientation', { op: 'replace', path: 'orientation', value: `MONTAGEM - OS ${projectCode}` }],
    ['objeto único, taskType', { op: 'replace', path: 'taskType', value: 158060 }],
    ['array, orientation', [{ op: 'replace', path: 'orientation', value: `MONTAGEM - OS ${projectCode}` }]],
    ['array, taskType', [{ op: 'replace', path: 'taskType', value: 158060 }]],
    ['array, /taskType com barra', [{ op: 'replace', path: '/taskType', value: 158060 }]],
  ];
  for (const [nome, body] of tentativas) {
    try {
      const r = await axios.patch(`${BASE}/tasks/${taskId}`, body, H);
      console.log(`OK   | ${nome} | HTTP ${r.status}`);
    } catch (e) {
      console.log(`FALHA| ${nome} | HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
    }
  }

  const { data } = await axios.get(`${BASE}/tasks/${taskId}`, H);
  const t = data?.result?.[0] || data?.result || data;
  console.log(`\nEstado final da tarefa ${taskId}: tipo ${t.taskType} (${t.taskTypeDescription}) | orientação: ${t.orientation}`);
  const { data: os } = await axios.get(`${BASE}/serviceorders/${projectCode}`, H);
  const o = os?.result?.[0] || os?.result || os;
  console.log('Visitas da OS:');
  for (const v of o.visits || []) console.log(`  tarefa ${v.taskId} | tipo ${v.taskTypeCode} | ${v.taskDate}`);
})().catch((e) => console.error(e.response?.data || e.message));
