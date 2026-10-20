// TESTE: PATCH /tasks/{id} com Content-Type application/json-patch+json (padrão .NET) e variações de path.
// Uso: node scripts/testePatch3.js <taskIdDaOS> <projectCode>   ex.: node scripts/testePatch3.js 81271485 1181
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [taskId, projectCode] = process.argv.slice(2);
if (!taskId || !projectCode) { console.error('Uso: node scripts/testePatch3.js <taskId> <projectCode>'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const auth = { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` };
  const H = (ct) => ({ headers: { ...auth, 'Content-Type': ct } });

  const orient = `MONTAGEM - OS ${projectCode}`;
  const tentativas = [
    ['json-patch+json, /orientation', 'application/json-patch+json', [{ op: 'replace', path: '/orientation', value: orient }]],
    ['json-patch+json, orientation (sem barra)', 'application/json-patch+json', [{ op: 'replace', path: 'orientation', value: orient }]],
    ['json-patch+json, /taskType', 'application/json-patch+json', [{ op: 'replace', path: '/taskType', value: 158060 }]],
    ['json-patch+json, taskType (sem barra)', 'application/json-patch+json', [{ op: 'replace', path: 'taskType', value: 158060 }]],
    ['json, op add /orientation', 'application/json', [{ op: 'add', path: '/orientation', value: orient }]],
  ];
  for (const [nome, ct, body] of tentativas) {
    try {
      const r = await axios.patch(`${BASE}/tasks/${taskId}`, body, H(ct));
      console.log(`OK   | ${nome} | HTTP ${r.status}`);
    } catch (e) {
      console.log(`FALHA| ${nome} | HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
    }
  }
  const { data } = await axios.get(`${BASE}/tasks/${taskId}`, { headers: auth });
  const t = data?.result?.[0] || data?.result || data;
  console.log(`\nTarefa ${taskId}: tipo ${t.taskType} (${t.taskTypeDescription}) | orientação: ${t.orientation}`);
})().catch((e) => console.error(e.response?.data || e.message));
