// TESTE: tenta atualizar a 2ª tarefa da OS de teste via PUT /tasks usando "id" + endereço/coords copiados da própria tarefa.
// Também apaga a tarefa de teste solta criada pelo teste anterior (81271824).
// Uso: node scripts/testePut.js <taskIdDaOS> <projectCode> [taskParaApagar]
//   ex.: node scripts/testePut.js 81271485 1181 81271824
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [daOS, projectCode, apagar] = process.argv.slice(2);
if (!daOS || !projectCode) { console.error('Uso: node scripts/testePut.js <taskIdDaOS> <projectCode> [taskParaApagar]'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  if (apagar) {
    try { const r = await axios.delete(`${BASE}/tasks/${apagar}`, H); console.log(`Tarefa de teste ${apagar} apagada: HTTP ${r.status}`); }
    catch (e) { console.log(`Não apagou ${apagar}: HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`); }
  }

  const { data } = await axios.get(`${BASE}/tasks/${daOS}`, H);
  const t = data?.result?.[0] || data?.result || data;
  console.log(`Antes: tipo ${t.taskType} | orientação: ${t.orientation} | endereço: ${t.address} | lat ${t.latitude} lng ${t.longitude}`);

  const body = {
    id: Number(daOS),
    idUserFrom: t.idUserFrom || 243173,
    idUserTo: t.idUserTo || 243173,
    customerId: t.customerId,
    taskDate: t.taskDate,
    priority: t.priority || 2,
    address: t.address || 'Rua Florestopolis, 229 - Pq São Luiz, GUARULHOS (SP) - SP - 07171030',
    latitude: t.latitude || -23.429,
    longitude: t.longitude || -46.43878,
    taskType: 158060,
    orientation: `MONTAGEM - OS ${projectCode}`,
  };
  try {
    const r = await axios.put(`${BASE}/tasks`, body, H);
    console.log(`PUT com id: HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 300));
  } catch (e) {
    console.log(`PUT com id FALHOU: HTTP ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
  }

  const { data: os } = await axios.get(`${BASE}/serviceorders/${projectCode}`, H);
  const o = os?.result?.[0] || os?.result || os;
  console.log('\nVisitas da OS depois:');
  for (const v of o.visits || []) console.log(`  tarefa ${v.taskId} | tipo ${v.taskTypeCode} | ${v.taskDate}`);
  const { data: d2 } = await axios.get(`${BASE}/tasks/${daOS}`, H);
  const t2 = d2?.result?.[0] || d2?.result || d2;
  console.log(`Tarefa ${daOS} depois: tipo ${t2.taskType} (${t2.taskTypeDescription}) | orientação: ${t2.orientation}`);
})().catch((e) => console.error(e.response?.data || e.message));
