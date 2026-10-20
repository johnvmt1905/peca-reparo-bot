// CONFERE a extração automática de Máquina e N.S.: roda o MESMO código do bot (getTaskInfo) e mostra, ao lado,
// os dados crus de cada equipamento na Auvo, pra você comparar. SOMENTE LEITURA.
// Uso: node scripts/verificarMaquina.js <tarefa1> [tarefa2] [tarefa3] ...
require('dotenv').config();
const axios = require('axios');
const { getTaskInfo } = require('../src/services/auvo');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const tarefas = process.argv.slice(2);
if (!tarefas.length) { console.error('Uso: node scripts/verificarMaquina.js <tarefa1> [tarefa2] ...'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  for (const n of tarefas) {
    console.log(`\n=========== TAREFA ${n} ===========`);
    const info = await getTaskInfo(n);
    if (!info.encontrado) { console.log('  tarefa NÃO encontrada na Auvo'); continue; }
    console.log(`  cliente: ${info.cliente} | técnico: ${info.tecnico}`);
    console.log(`  >> o bot vai preencher  MÁQUINA: "${info.maquina}"  |  N.S.: "${info.nsMaquina}"`);
    for (const id of info.equipmentsIds || []) {
      try {
        const { data } = await axios.get(`${BASE}/equipments/${id}`, H);
        const e = data?.result || data;
        console.log(`  [equipamento ${id}] name: "${e.name}" | identifier: "${e.identifier}"`);
      } catch (err) { console.log(`  [equipamento ${id}] não encontrado (${err.response?.status})`); }
    }
    if (!(info.equipmentsIds || []).length) console.log('  (a tarefa não tem equipamento cadastrado na Auvo)');
  }
})().catch((e) => console.error(e.response?.data || e));
