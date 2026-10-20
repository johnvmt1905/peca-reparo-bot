// TESTE (ESCREVE na Auvo!): cria 1 OS de teste e mostra se a Auvo gerou tarefas (visits).
//
// Passo 1 – só a OS (testa se as datas/hora fazem a Auvo gerar as tarefas):
//   node scripts/testeOS.js <customerId>
// Passo 2 – se o passo 1 NÃO gerou tarefas, cria a OS + 2 tarefas avulsas e relê a OS:
//   node scripts/testeOS.js <customerId> --tarefas
//
// Use um cliente de TESTE (ou um qualquer, e depois apague a OS/tarefas pelo painel da Auvo).
// Todos os registros levam "TESTE BOT" na descrição pra você achar fácil.
require('dotenv').config();
const axios = require('axios');

const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';

// ---- IDs confirmados / a testar ----
const STATUS_ID = '073746fb-747a-11ee-bdb3-0ab8a76e2462'; // status mais comum; confira na tela da Auvo qual nome ele tem
const USER_SUBCONJUNTO = 243173; // usuário "Subconjunto"
const TIPO_OS = 184421; // Subconjunto
const TIPO_TAREFA_1 = 184421; // Subconjunto
const TIPO_TAREFA_2 = 158060; // Serviço Interno - Subconjuntos

const customerId = Number(process.argv[2]);
const criarTarefas = process.argv.includes('--tarefas');
if (!customerId) {
  console.error('Uso: node scripts/testeOS.js <customerId> [--tarefas]');
  process.exit(1);
}

const hoje = new Date().toISOString().slice(0, 10);
// A Auvo exige dateFirstVisit ESTRITAMENTE anterior a dateLastVisit
const amanha = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const token = login.result?.accessToken || login.accessToken;
  const H = { headers: { Authorization: `Bearer ${token}` } };

  // 1) Cria a OS
  const bodyOS = {
    customerId,
    statusId: STATUS_ID,
    description: 'TESTE BOT - pode apagar',
    dateFirstVisit: `${hoje}T00:00:00`,
    dateLastVisit: `${amanha}T00:00:00`,
    startTime: '08:00',
    taskTypeId: TIPO_OS,
    defaultResponsibleId: USER_SUBCONJUNTO,
    priority: 2,
  };
  let osId;
  try {
    const { data } = await axios.post(`${BASE}/serviceorders`, bodyOS, H);
    console.log('--- Resposta do POST /serviceorders ---');
    console.log(JSON.stringify(data, null, 2));
    const r = data?.result;
    osId = r?.id || r?.[0]?.id || r?.entityList?.[0]?.id;
  } catch (e) {
    console.error('ERRO criando OS:', JSON.stringify(e.response?.data || e.message, null, 2));
    process.exit(1);
  }
  if (!osId) {
    console.log('Não consegui extrair o id da OS da resposta acima. Me manda esse JSON.');
    process.exit(0);
  }

  // 2) Opcional: cria 2 tarefas avulsas
  if (criarTarefas) {
    const tarefas = [
      { tipo: TIPO_TAREFA_1, nome: 'DESMONTAGEM' },
      { tipo: TIPO_TAREFA_2, nome: 'MONTAGEM' },
    ];
    for (const t of tarefas) {
      try {
        const { data } = await axios.post(
          `${BASE}/tasks`,
          {
            idUserFrom: USER_SUBCONJUNTO,
            idUserTo: USER_SUBCONJUNTO,
            customerId,
            taskType: t.tipo,
            taskDate: `${hoje}T08:00:00`,
            orientation: `TESTE BOT - ${t.nome} - OS ${osId}`,
            priority: 2,
          },
          H
        );
        console.log(`--- Resposta do POST /tasks (${t.nome}) ---`);
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.error(`ERRO criando tarefa ${t.nome}:`, JSON.stringify(e.response?.data || e.message, null, 2));
      }
    }
  }

  // 3) Relê a OS e mostra as visitas
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const { data } = await axios.get(`${BASE}/serviceorders/${osId}`, H);
    const os = data?.result?.[0] || data?.result || data;
    console.log('\n--- OS relida ---');
    console.log('projectCode (Nº da OS):', os.projectCode);
    console.log('statusId:', os.statusId);
    console.log('visits:', JSON.stringify(os.visits, null, 2));
    console.log('\nJSON completo:');
    console.log(JSON.stringify(os, null, 2));
  } catch (e) {
    console.error('ERRO relendo OS:', JSON.stringify(e.response?.data || e.message, null, 2));
  }
})();
