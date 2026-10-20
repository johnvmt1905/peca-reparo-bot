// TESTE: PUT /tasks com SÓ os campos exigidos pela doc (id, idUserFrom, orientation, priority, taskType).
// Mostra se a tarefa preserva usuário, data, cliente e endereço, ou se algum campo é zerado.
// Uso: node scripts/testePutMinimo.js <taskId> <projectCode>   ex.: node scripts/testePutMinimo.js 81271484 1181
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [taskId, projectCode] = process.argv.slice(2);
if (!taskId || !projectCode) { console.error('Uso: node scripts/testePutMinimo.js <taskId> <projectCode>'); process.exit(1); }
const CAMPOS = ['idUserFrom', 'idUserTo', 'customerId', 'taskDate', 'taskType', 'priority', 'address', 'latitude', 'longitude', 'orientation'];

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };
  const ler = async () => { const { data } = await axios.get(`${BASE}/tasks/${taskId}`, H); return data?.result?.[0] || data?.result || data; };

  const antes = await ler();
  try {
    const r = await axios.put(`${BASE}/tasks`, {
      id: Number(taskId),
      idUserFrom: antes.idUserFrom || 243173,
      priority: antes.priority || 2,
      taskType: 184421,
      orientation: `DESMONTAGEM - OS ${projectCode} | teste PUT mínimo`,
    }, H);
    console.log(`PUT mínimo: HTTP ${r.status}`);
  } catch (e) {
    console.log(`PUT mínimo FALHOU: HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
  }
  const depois = await ler();
  console.log('\ncampo | antes | depois');
  for (const c of CAMPOS) console.log(`${c} | ${JSON.stringify(antes[c])} | ${JSON.stringify(depois[c])}${JSON.stringify(antes[c]) !== JSON.stringify(depois[c]) ? '   <-- MUDOU' : ''}`);

  const { data: os } = await axios.get(`${BASE}/serviceorders/${projectCode}`, H);
  const o = os?.result?.[0] || os?.result || os;
  console.log('\nVisitas da OS:');
  for (const v of o.visits || []) console.log(`  tarefa ${v.taskId} | tipo ${v.taskTypeCode} | ${v.taskDate}`);
})().catch((e) => console.error(e.response?.data || e.message));
