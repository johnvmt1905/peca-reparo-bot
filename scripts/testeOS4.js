// TESTE (ESCREVE na Auvo!): OS com RECORRÊNCIA diária -> vê se a Auvo gera 2+ tarefas DENTRO da OS.
// Uso: node scripts/testeOS4.js <customerId> [--dias=1] [--status=<GUID>] [--patch]
//   --dias=N    dateLastVisit = hoje + N (com recorrência diária, deve gerar 1 visita por dia)
//   --status=   statusId a usar (o 073746fb… aparece como "Finalizada" no painel; teste outro, ex. 070b4849-747a-11ee-bdb3-0ab8a76e2462)
//   --patch     se vier 2+ tarefas, faz PATCH na 2ª: tipo 158060 + orientação "MONTAGEM"
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
const customerId = Number(process.argv[2]);
const DIAS = Number(arg('dias') || 1);
const STATUS_ID = arg('status') || '073746fb-747a-11ee-bdb3-0ab8a76e2462';
const doPatch = process.argv.includes('--patch');
const USER = 243173;
if (!customerId) { console.error('Uso: node scripts/testeOS4.js <customerId> [--dias=1] [--status=GUID] [--patch]'); process.exit(1); }

const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  const body = {
    customerId,
    statusId: STATUS_ID,
    description: 'TESTE BOT RECORRENCIA - pode apagar',
    dateFirstVisit: `${dia(0)}T00:00:00`,
    dateLastVisit: `${dia(DIAS)}T00:00:00`,
    startTime: '08:00',
    taskTypeId: 184421,
    defaultResponsibleId: USER,
    priority: 2,
    recurrenceType: 'daily',
    recurrenceInterval: 1,
    duration: 60,
  };
  console.log('Enviando:', JSON.stringify(body));

  let os;
  try {
    const { data } = await axios.post(`${BASE}/serviceorders`, body, H);
    os = data.result;
    console.log(`OS criada: projectCode ${os.projectCode} | visits na resposta: ${(os.visits || []).length}`);
  } catch (e) {
    console.error('ERRO criando OS:', JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, 3000));
  let visits = [];
  try {
    const { data } = await axios.get(`${BASE}/serviceorders/${os.projectCode}`, H);
    const o = data?.result?.[0] || data?.result || data;
    visits = o.visits || [];
    console.log(`\nGET /serviceorders/${os.projectCode} -> ${visits.length} visita(s):`);
    for (const v of visits) console.log(`  tarefa ${v.taskId} | tipo ${v.taskTypeCode} | ${v.taskDate} | ${v.status}`);
  } catch (e) {
    console.error('ERRO relendo OS:', JSON.stringify(e.response?.data || e.message, null, 2));
  }

  if (doPatch && visits.length >= 2) {
    const alvo = visits[visits.length - 1].taskId;
    try {
      const r = await axios.patch(
        `${BASE}/tasks/${alvo}`,
        [
          { op: 'replace', path: 'taskType', value: 158060 },
          { op: 'replace', path: 'orientation', value: `MONTAGEM - OS ${os.projectCode}` },
        ],
        H
      );
      console.log(`\nPATCH na tarefa ${alvo}: HTTP ${r.status}`, JSON.stringify(r.data));
    } catch (e) {
      console.error('ERRO no PATCH:', JSON.stringify(e.response?.data || e.message, null, 2));
    }
  }
})();
