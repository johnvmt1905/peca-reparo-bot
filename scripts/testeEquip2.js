// TESTE com dados REAIS: pega cliente + equipamentos de uma tarefa existente (a mesma que o bot usaria no
// modal 1) e vê se a OS e as tarefas ficam com a(s) máquina(s). ESCREVE na Auvo — apague depois.
// Uso: node scripts/testeEquip2.js <numeroDaTarefaDeOrigem> [subconjunto|eletronica] [--variantes]
//   --variantes  se a OS ficar sem equipamentos, tenta outros nomes do campo (cria 2 OS extras)
require('dotenv').config();
const axios = require('axios');
const { criarOSInterna } = require('../src/services/auvo');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const [origem, categoria = 'subconjunto'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const variantes = process.argv.includes('--variantes');
if (!origem) { console.error('Uso: node scripts/testeEquip2.js <numeroDaTarefaDeOrigem> [categoria] [--variantes]'); process.exit(1); }

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  const { data: d0 } = await axios.get(`${BASE}/tasks/${origem}`, H);
  const t0 = d0?.result?.[0] || d0?.result || d0;
  const customerId = t0.customerId;
  const ids = (Array.isArray(t0.equipmentsId) ? t0.equipmentsId : []).map(Number).filter(Boolean);
  console.log(`Tarefa de origem ${origem}: cliente ${customerId} (${t0.customerDescription}) | equipmentsId: ${JSON.stringify(ids)}`);
  if (!ids.length) { console.log('Essa tarefa não tem equipamento — escolha outra.'); return; }

  // Equipamento existe? (confirma que o ID é válido)
  for (const id of ids) {
    try { const { data } = await axios.get(`${BASE}/equipments/${id}`, H); const e = data?.result || data; console.log(`  equipamento ${id}: "${e.name}" | identificador "${e.identifier}" | cliente ${e.associatedCustomerId ?? e.customerId ?? '?'}`); }
    catch (e) { console.log(`  equipamento ${id}: NÃO encontrado (${e.response?.status})`); }
  }

  // 1) Caminho do bot
  const os = await criarOSInterna({ categoria, customerId, descricao: 'LAB TESTE EQUIP 2 - pode apagar', resumo: 'TESTE EQUIP 2', equipmentsIds: ids });
  console.log(`\nOS ${os.projectCode} | tarefas ${os.taskIds.join(', ')} | avisos: ${os.avisos.length ? JSON.stringify(os.avisos) : '(nenhum)'}`);
  await new Promise((r) => setTimeout(r, 2500));
  const { data } = await axios.get(`${BASE}/serviceorders/${os.projectCode}`, H);
  const o = data?.result?.[0] || data?.result || data;
  const osOk = ids.every((i) => (o.equipments || []).includes(i));
  console.log(`OS -> equipments: ${JSON.stringify(o.equipments)} ${osOk ? 'OK' : 'ERRO (sem equipamento)'}`);
  for (const id of os.taskIds) {
    const { data: d } = await axios.get(`${BASE}/tasks/${id}`, H);
    const t = d?.result?.[0] || d?.result || d;
    console.log(`tarefa ${id} -> tipo ${t.taskType} | equipmentsId: ${JSON.stringify(t.equipmentsId)} ${ids.every((i) => (t.equipmentsId || []).includes(i)) ? 'OK' : 'ERRO (sem equipamento)'}`);
  }

  // 2) Variantes do nome do campo na criação da OS
  if (variantes && !osOk) {
    for (const campo of ['equipmentsId', 'equipmentIds']) {
      try {
        const { data: r } = await axios.post(`${BASE}/serviceorders`, {
          customerId, statusId: '070b4849-747a-11ee-bdb3-0ab8a76e2462', description: `LAB TESTE EQUIP 2 (${campo}) - pode apagar`,
          dateFirstVisit: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + 'T00:00:00',
          dateLastVisit: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + 'T00:00:00',
          startTime: '08:00', duration: 60, defaultResponsibleId: CATEGORIA_USER(categoria), priority: 2,
          recurrenceType: 'daily', recurrenceInterval: 1, [campo]: ids,
        }, H);
        console.log(`variante "${campo}": OS ${r.result.projectCode} -> equipments ${JSON.stringify(r.result.equipments)} ${(r.result.equipments || []).length ? 'FUNCIONA' : 'ignorado'}`);
      } catch (e) { console.log(`variante "${campo}": FALHOU ${JSON.stringify(e.response?.data)}`); }
    }
  }
  console.log('\nApague as OS e tarefas de teste no painel da Auvo.');
})().catch((e) => console.error(e.response?.data || e));

function CATEGORIA_USER(c) { return require('../src/config/categorias').CATEGORIAS[c].auvo.userId; }
