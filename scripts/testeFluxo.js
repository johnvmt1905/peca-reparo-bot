// TESTE DO FLUXO COMPLETO (sem Slack): roda Subconjunto e Peça Eletrônica com o MESMO código do bot.
// ESCREVE na Auvo (cria 2 OS + 4 tarefas). Apague depois no painel (OS e tarefas com "TESTE FLUXO").
// Uso: node scripts/testeFluxo.js <customerId> [--card]
//   --card  também cria 2 cards de teste no Trello (com etiqueta, Nº da OS e tarefas na descrição)
require('dotenv').config();
const axios = require('axios');
const { criarOSInterna } = require('../src/services/auvo');
const { createCard, getLabelIdByName } = require('../src/services/trello');
const { CATEGORIAS } = require('../src/config/categorias');

const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const customerId = Number(process.argv[2]);
const comCard = process.argv.includes('--card');
if (!customerId) { console.error('Uso: node scripts/testeFluxo.js <customerId> [--card]'); process.exit(1); }

const ok = (c, msg) => console.log(`  ${c ? 'OK  ' : 'ERRO'} | ${msg}`);

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const H = { headers: { Authorization: `Bearer ${login.result?.accessToken || login.accessToken}` } };

  for (const chave of ['subconjunto', 'eletronica']) {
    const cat = CATEGORIAS[chave];
    console.log(`\n=========== ${cat.label.toUpperCase()} ===========`);

    // 1) Etiqueta do Trello
    let labelId = null;
    try { labelId = await getLabelIdByName(cat.trelloLabel); } catch (e) { console.log('  falha ao buscar etiqueta:', e.response?.data || e.message); }
    ok(!!labelId, `etiqueta "${cat.trelloLabel}" encontrada no quadro do Trello`);

    // 2) OS + tarefas (mesma função do bot)
    let os;
    try {
      os = await criarOSInterna({
        categoria: chave,
        customerId,
        descricao: `TESTE FLUXO - ${cat.trelloLabel} | cliente teste | peça teste\nTarefa de origem: 0\n1ª tarefa = DESMONTAGEM | 2ª tarefa = MONTAGEM`,
        resumo: 'TESTE FLUXO | peça teste',
      });
    } catch (e) {
      console.log('  ERRO criando OS:', JSON.stringify(e.response?.data || e.message));
      continue;
    }
    console.log(`  OS criada: nº ${os.projectCode} | tarefas: ${os.taskIds.join(', ')}`);
    ok(os.taskIds.length === 2, `OS tem 2 tarefas (veio ${os.taskIds.length})`);
    (os.avisos || []).forEach((a) => ok(false, `aviso: ${a}`));

    // 3) Confere cada tarefa na Auvo
    const esperado = [
      { nome: 'DESMONTAGEM', tipo: cat.auvo.tipoDesmontagemId },
      { nome: 'MONTAGEM', tipo: cat.auvo.tipoMontagemId },
    ];
    await new Promise((r) => setTimeout(r, 2000));
    for (let i = 0; i < os.taskIds.length && i < 2; i++) {
      const { data } = await axios.get(`${BASE}/tasks/${os.taskIds[i]}`, H);
      const t = data?.result?.[0] || data?.result || data;
      console.log(`  tarefa ${t.taskID}: tipo ${t.taskType} (${t.taskTypeDescription}) | ${t.taskDate} | usuário ${t.userToName} | orientação: ${t.orientation}`);
      ok(t.taskType === esperado[i].tipo, `${esperado[i].nome}: tipo esperado ${esperado[i].tipo}`);
      ok(String(t.orientation).startsWith(esperado[i].nome), `${esperado[i].nome}: orientação começa certo`);
      ok(t.idUserTo === cat.auvo.userId, `${esperado[i].nome}: usuário esperado ${cat.auvo.userId}`);
    }

    // 4) Confere que as tarefas continuam DENTRO da OS
    const { data: osData } = await axios.get(`${BASE}/serviceorders/${os.projectCode}`, H);
    const o = osData?.result?.[0] || osData?.result || osData;
    const idsNaOS = (o.visits || []).map((v) => v.taskId);
    ok(os.taskIds.every((id) => idsNaOS.includes(id)), `as ${os.taskIds.length} tarefas estão no "visits" da OS ${os.projectCode}`);
    ok(o.statusId === '070b4849-747a-11ee-bdb3-0ab8a76e2462', 'status da OS = Em Andamento');

    // 5) Card opcional
    if (comCard) {
      const card = await createCard({
        title: `TESTE FLUXO - ${cat.label.toUpperCase()}`,
        description: `Nº O.S Gzero: ${os.projectCode}\n\nTAREFAS INTERNAS: ${os.taskIds.join(' / ')}`,
        labelIds: labelId ? [labelId] : [],
      });
      console.log(`  card de teste: ${card.url}`);
    }
  }
  console.log('\nFim. Apague no painel da Auvo as OS/tarefas "TESTE FLUXO" e, se usou --card, os cards do Trello.');
})().catch((e) => console.error(e.response?.data || e));
