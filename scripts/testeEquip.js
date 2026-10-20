// TESTE: a OS aceita equipamentos (máquinas)? E as tarefas geradas herdam?
// Usa o MESMO código do bot (criarOSInterna). ESCREVE na Auvo (1 OS + 2 tarefas) — apague depois.
// Uso: node scripts/testeEquip.js <customerId> <equipmentId> [subconjunto|eletronica]
//   ex.: node scripts/testeEquip.js 17049233 34007645      (34007645 = equipamento da OS 64, mesmo cliente)
require('dotenv').config();
const axios = require('axios');
const { criarOSInterna } = require('../src/services/auvo');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [customerId, equipmentId, categoria = 'subconjunto'] = process.argv.slice(2);
if (!customerId || !equipmentId) { console.error('Uso: node scripts/testeEquip.js <customerId> <equipmentId> [categoria]'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  const os = await criarOSInterna({
    categoria,
    customerId: Number(customerId),
    descricao: 'LAB TESTE EQUIP - pode apagar',
    resumo: 'TESTE EQUIP',
    equipmentsIds: [Number(equipmentId)],
  });
  console.log(`OS ${os.projectCode} | tarefas ${os.taskIds.join(', ')}`);
  console.log('Avisos do bot:', os.avisos.length ? os.avisos : '(nenhum)');

  await new Promise((r) => setTimeout(r, 2500));
  const { data } = await axios.get(`${BASE}/serviceorders/${os.projectCode}`, H);
  const o = data?.result?.[0] || data?.result || data;
  console.log(`\nOS -> equipments: ${JSON.stringify(o.equipments)} ${(o.equipments || []).includes(Number(equipmentId)) ? 'OK' : 'ERRO (equipamento NÃO vinculado à OS)'}`);
  for (const id of os.taskIds) {
    const { data: d } = await axios.get(`${BASE}/tasks/${id}`, H);
    const t = d?.result?.[0] || d?.result || d;
    console.log(`tarefa ${id} -> tipo ${t.taskType} | equipmentsId: ${JSON.stringify(t.equipmentsId)} ${(t.equipmentsId || []).includes(Number(equipmentId)) ? 'OK' : 'ERRO (sem equipamento)'}`);
  }
  console.log('\nApague a OS e as tarefas de teste no painel da Auvo.');
})().catch((e) => console.error(e.response?.data || e));
