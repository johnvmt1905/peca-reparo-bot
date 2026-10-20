// TESTE (altera tarefas de teste!): isola por que o PATCH deu 500 e tenta PUT /tasks (upsert).
// Uso: node scripts/testePatch2.js <taskIdSolta> <taskIdDaOS> <projectCode>
//   ex.: node scripts/testePatch2.js 81270782 81271485 1181
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [solta, daOS, projectCode] = process.argv.slice(2);
if (!solta || !daOS) { console.error('Uso: node scripts/testePatch2.js <taskIdSolta> <taskIdDaOS> <projectCode>'); process.exit(1); }
const USER = 243173;

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };
  const rodar = async (nome, fn) => {
    try { const r = await fn(); console.log(`OK   | ${nome} | HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); }
    catch (e) { console.log(`FALHA| ${nome} | HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`); }
  };

  // A) PATCH em tarefa SOLTA (não ligada a OS): o 500 é do PATCH em si ou por ela ser de OS?
  await rodar('PATCH array orientation na tarefa SOLTA', () =>
    axios.patch(`${BASE}/tasks/${solta}`, [{ op: 'replace', path: 'orientation', value: 'TESTE PATCH solta' }], H));

  // B) PUT /tasks (upsert) na tarefa da OS, com variações de identificador
  const base = { idUserFrom: USER, idUserTo: USER, customerId: 17049233, priority: 2, taskType: 158060, orientation: `MONTAGEM - OS ${projectCode}`, taskDate: '2026-10-20T08:00:00' };
  await rodar('PUT /tasks com taskID', () => axios.put(`${BASE}/tasks`, { ...base, taskID: Number(daOS) }, H));
  await rodar('PUT /tasks com id', () => axios.put(`${BASE}/tasks`, { ...base, id: Number(daOS) }, H));

  const { data } = await axios.get(`${BASE}/tasks/${daOS}`, H);
  const t = data?.result?.[0] || data?.result || data;
  console.log(`\nTarefa ${daOS}: tipo ${t.taskType} (${t.taskTypeDescription}) | orientação: ${t.orientation}`);
  const { data: os } = await axios.get(`${BASE}/serviceorders/${projectCode}`, H);
  const o = os?.result?.[0] || os?.result || os;
  console.log('Visitas da OS:');
  for (const v of o.visits || []) console.log(`  tarefa ${v.taskId} | tipo ${v.taskTypeCode} | ${v.taskDate}`);
})().catch((e) => console.error(e.response?.data || e.message));
