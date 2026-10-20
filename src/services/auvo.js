const axios = require('axios');
const { extrairMaquinaENs } = require('./maquinaNS');
const { CATEGORIAS, STATUS_EM_ANDAMENTO } = require('../config/categorias');

const BASE_URL = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';

let cachedToken = null;
let cachedTokenExpiry = 0;

/**
 * Autentica na Auvo e retorna um token válido (com cache simples em memória
 * pra não gerar um token novo a cada chamada).
 */
async function getAuvoToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  // Endpoint de autenticação da Auvo API v2 (GET /login com apiKey/apiToken).
  // Ajuste aqui se a integração Omie->Auvo que vocês já têm usa outro formato.
  const { data } = await axios.get(`${BASE_URL}/login`, {
    params: {
      apiKey: process.env.AUVO_API_KEY,
      apiToken: process.env.AUVO_API_TOKEN,
    },
  });

  cachedToken = data.result?.accessToken || data.accessToken;
  // expira um pouco antes do tempo real informado, por segurança
  const expiresInSeconds = data.result?.expiresIn || 3600;
  cachedTokenExpiry = now + (expiresInSeconds - 60) * 1000;

  return cachedToken;
}

/**
 * Busca um equipamento pelo ID (GET /equipments/{id}). Faz até 2 tentativas
 * (falha de rede passageira é comum nesse tipo de chamada). Retorna null se
 * as duas falharem, pra não travar o fluxo principal por causa de um
 * equipamento mal cadastrado ou de uma falha momentânea da API.
 */
async function getEquipmentById(equipmentId, tentativa = 1) {
  try {
    const token = await getAuvoToken();
    const { data } = await axios.get(`${BASE_URL}/equipments/${equipmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data?.result || data;
  } catch (err) {
    if (tentativa < 2) {
      console.warn(`Falha ao buscar equipamento ${equipmentId} (tentativa ${tentativa}), tentando de novo:`, err.response?.data || err.message);
      return getEquipmentById(equipmentId, tentativa + 1);
    }
    console.warn(`Falha ao buscar equipamento ${equipmentId} após 2 tentativas:`, err.response?.data || err.message);
    return null;
  }
}

/**
 * Resolve Máquina + N.S a partir da tarefa, seguindo a mesma ordem de
 * prioridade do script Auvo→Sheets: texto direto na tarefa → objeto
 * embutido → lista → busca por ID do equipamento.
 */
async function resolverMaquinaENs(task) {
  if (!task) return { maquina: '', nsMaquina: '' };

  // Texto direto já presente na própria tarefa (raro, mas o script antigo
  // cobre esse caso)
  for (const chave of ['equipmentDescription', 'equipmentName', 'assetDescription', 'assetName']) {
    if (task[chave]) return extrairMaquinaENs({ name: task[chave] });
  }

  // Objeto de equipamento já embutido na tarefa
  if (task.equipment && typeof task.equipment === 'object') return extrairMaquinaENs(task.equipment);
  if (task.asset && typeof task.asset === 'object') return extrairMaquinaENs(task.asset);

  // Lista de equipamentos
  const lista = task.equipments || task.equipmentList;
  if (Array.isArray(lista) && lista.length > 0) return extrairMaquinaENs(lista[0]);

  // ID de equipamento — precisa de uma chamada extra
  const equipmentId = Array.isArray(task.equipmentsId) && task.equipmentsId.length > 0
    ? task.equipmentsId[0]
    : task.equipmentId;

  if (equipmentId) {
    const equipamento = await getEquipmentById(equipmentId);
    if (equipamento) return extrairMaquinaENs(equipamento);
  }

  return { maquina: '', nsMaquina: '' };
}

/**
 * Busca uma tarefa na Auvo pelo número/ID e retorna cliente, técnico,
 * máquina e N.S da máquina.
 *
 * IMPORTANTE: `userToName` (técnico) e `taskID` já foram confirmados contra
 * o JSON real retornado pela Auvo. `customerDescription` (cliente) segue
 * como estava — se em algum momento o nome do cliente vier errado/vazio,
 * provavelmente é esse o próximo campo a conferir contra o JSON real.
 *
 * @param {string} taskNumber - Nº da Tarefa digitado pelo usuário no modal
 * @returns {Promise<{cliente: string, tecnico: string, maquina: string, nsMaquina: string, encontrado: boolean}>}
 */
function equipmentIdsDaTarefa(task) {
  const lista = Array.isArray(task?.equipmentsId) ? task.equipmentsId : task?.equipmentId ? [task.equipmentId] : [];
  return lista.map(Number).filter(Boolean);
}

/**
 * Máquina + N.S de TODAS as máquinas da tarefa. Com mais de uma, junta com
 * " / " mantendo a ordem ("-" quando uma delas não tem N.S), pra Máquina e
 * N.S continuarem alinhados no card do Trello.
 */
async function resolverMaquinasDaTarefa(task) {
  const ids = equipmentIdsDaTarefa(task);
  if (ids.length <= 1) return resolverMaquinaENs(task);

  const partes = [];
  for (const id of ids) {
    const eq = await getEquipmentById(id);
    if (eq) partes.push(extrairMaquinaENs(eq));
  }
  if (!partes.length) return resolverMaquinaENs(task);
  return {
    maquina: partes.map((p) => p.maquina || '-').join(' / '),
    nsMaquina: partes.map((p) => p.nsMaquina || '-').join(' / '),
  };
}

async function getTaskInfo(taskNumber) {
  const token = await getAuvoToken();

  // Tentativa 1: buscar direto por path param (GET /tasks/{id}).
  // Esse é o padrão REST mais comum pra "buscar um registro específico" —
  // mas precisa ser confirmado contra a doc/console interativo de vocês,
  // já que não consegui abrir o conteúdo real da doc da Auvo (é renderizada
  // via JS) pra confirmar 100%.
  try {
    const { data } = await axios.get(`${BASE_URL}/tasks/${taskNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const task = data?.result?.[0] || data?.result || data;
    if (task && (task.customerDescription || task.userToName || task.customer)) {
      const { maquina, nsMaquina } = await resolverMaquinasDaTarefa(task);
      console.log(
        `[auvo] tarefa ${taskNumber} | campos de equipamento na tarefa: ${JSON.stringify(
          Object.fromEntries(Object.entries(task).filter(([k]) => /equip|asset/i.test(k)))
        )} | máquina="${maquina}" n.s.="${nsMaquina}"`
      );
      return {
        cliente: task.customerDescription || task.customer?.description || '',
        tecnico: task.userToName || task.user?.name || '',
        customerId: task.customerId || task.customer?.id || null,
        equipmentsIds: equipmentIdsDaTarefa(task),
        maquina,
        nsMaquina,
        encontrado: true,
      };
    }
  } catch (err) {
    console.warn('GET /tasks/{id} falhou, tentando fallback por listagem:', err.response?.data || err.message);
  }

  // Tentativa 2 (fallback): a listagem (GET /tasks) exige startDate/endDate
  // quando customerId não é informado. Busca numa janela ampla e filtra
  // pelo número da tarefa no resultado.
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    const { data } = await axios.get(`${BASE_URL}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        page: 1,
        // Ajustar o nome do parâmetro de tamanho de página conforme a doc
        // real (paginationNumber/pageSize/perPage variam entre versões).
      },
    });

    const lista = data?.result || [];
    const task = lista.find(
      (t) =>
        String(t.taskID) === String(taskNumber) ||
        String(t.taskId) === String(taskNumber) ||
        String(t.externalId) === String(taskNumber)
    );

    if (!task) {
      return { cliente: '', tecnico: '', maquina: '', nsMaquina: '', encontrado: false };
    }

    const { maquina, nsMaquina } = await resolverMaquinasDaTarefa(task);
      console.log(
        `[auvo] tarefa ${taskNumber} | campos de equipamento na tarefa: ${JSON.stringify(
          Object.fromEntries(Object.entries(task).filter(([k]) => /equip|asset/i.test(k)))
        )} | máquina="${maquina}" n.s.="${nsMaquina}"`
      );
    return {
      cliente: task.customerDescription || task.customer?.description || '',
      tecnico: task.userToName || task.user?.name || '',
      customerId: task.customerId || task.customer?.id || null,
      equipmentsIds: equipmentIdsDaTarefa(task),
      maquina,
      nsMaquina,
      encontrado: true,
    };
  } catch (err) {
    console.error('Erro ao buscar tarefa na Auvo (fallback):', err.response?.data || err.message);
    return { cliente: '', tecnico: '', maquina: '', nsMaquina: '', encontrado: false, erro: true };
  }
}

/**
 * Cria a OS interna (Subconjunto / Peça Eletrônica). Com recorrência diária
 * de 2 dias, a Auvo gera sozinha 2 tarefas DENTRO da OS (1ª = Desmontagem,
 * 2ª = Montagem). Retorna null se a categoria não pede OS.
 *
 * @returns {Promise<{projectCode: number, taskIds: number[], avisos: string[]} | null>}
 */
// Endereço padrão — usado só se não for possível obter o do cliente. O PUT
// /tasks exige endereço e coordenadas preenchidos.
const ENDERECO_PADRAO = {
  address: process.env.AUVO_ENDERECO_PADRAO || 'Guarulhos - SP',
  latitude: Number(process.env.AUVO_LAT_PADRAO) || -23.4543,
  longitude: Number(process.env.AUVO_LNG_PADRAO) || -46.5337,
};

async function obterEnderecoCliente(customerId, H) {
  try {
    const { data } = await axios.get(`${BASE_URL}/customers/${customerId}`, H);
    const c = data?.result?.[0] || data?.result || data;
    const address = c?.address;
    const latitude = Number(c?.latitude);
    const longitude = Number(c?.longitude);
    if (address && latitude && longitude) return { address, latitude, longitude };
  } catch (e) {
    console.warn('Endereço do cliente indisponível, usando padrão:', e.response?.data || e.message);
  }
  return ENDERECO_PADRAO;
}

/**
 * Atualiza tipo/orientação de uma tarefa via PUT /tasks com "id" (o PATCH da
 * Auvo dá 500). A tarefa continua dentro da OS.
 */
async function atualizarTarefa(taskId, { taskType, orientation, equipmentsIds = [] }, endereco, H) {
  const { data } = await axios.get(`${BASE_URL}/tasks/${taskId}`, H);
  const t = data?.result?.[0] || data?.result || data;
  const corpo = {
      id: Number(taskId),
      idUserFrom: t.idUserFrom,
      idUserTo: t.idUserTo,
      customerId: t.customerId,
      taskDate: t.taskDate,
      priority: t.priority || 2,
      address: t.address || endereco.address,
      latitude: t.latitude || endereco.latitude,
      longitude: t.longitude || endereco.longitude,
      taskType,
      orientation,
  };
  if (equipmentsIds.length) {
    // O schema do PUT /tasks na doc não lista equipamentos; tenta com e, se a
    // Auvo recusar, repete sem — tipo e orientação são mais importantes.
    try {
      await axios.put(`${BASE_URL}/tasks`, { ...corpo, equipmentsId: equipmentsIds }, H);
      return;
    } catch (e) {
      console.warn(`PUT com equipmentsId falhou (${e.response?.status}), repetindo sem equipamentos:`, e.response?.data || e.message);
    }
  }
  await axios.put(`${BASE_URL}/tasks`, corpo, H);
}

async function criarOSInterna({ categoria, customerId, descricao, resumo, equipmentsIds = [] }) {
  const cfg = CATEGORIAS[categoria]?.auvo;
  if (!cfg) return null;
  if (!cfg.userId) throw new Error('usuário da Auvo não configurado pra essa categoria (AUVO_USER_ELETRONICA)');
  if (!customerId) throw new Error('cliente da tarefa não identificado na Auvo (customerId vazio)');

  const token = await getAuvoToken();
  const H = { headers: { Authorization: `Bearer ${token}` } };

  // Datas no fuso de São Paulo. A Auvo exige dateFirstVisit < dateLastVisit.
  const dia = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  // Chamado aberto a partir das 8h (horário de SP) → 1ª tarefa só no dia seguinte,
  // senão ela nasceria às 08:00 de hoje, já no passado.
  const horaSP = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date())
  );
  const inicio = horaSP >= 8 ? 1 : 0;

  const corpoOS = {
      customerId,
      statusId: STATUS_EM_ANDAMENTO,
      description: descricao,
      dateFirstVisit: `${dia(inicio)}T00:00:00`,
      dateLastVisit: `${dia(inicio + 1)}T00:00:00`,
      startTime: '08:00',
      duration: 60,
      taskTypeId: cfg.tipoDesmontagemId, // a tarefa que a Auvo gera sozinha herda o tipo da OS (= Desmontagem)
      defaultResponsibleId: cfg.userId,
      priority: 2,
      recurrenceType: 'daily',
      recurrenceInterval: 1,
  };

  // Equipamentos (máquinas) da tarefa de origem. O POST /serviceorders não
  // documenta esse campo — manda como "equipments" (mesmo nome do GET) e, se a
  // Auvo recusar, cria a OS sem e avisa.
  const avisos = [];
  let data;
  if (equipmentsIds.length) {
    try {
      ({ data } = await axios.post(`${BASE_URL}/serviceorders`, { ...corpoOS, equipments: equipmentsIds }, H));
    } catch (e) {
      console.warn(`POST /serviceorders com equipments falhou (${e.response?.status}), criando sem:`, e.response?.data || e.message);
    }
  }
  if (!data) ({ data } = await axios.post(`${BASE_URL}/serviceorders`, corpoOS, H));

  const os = data?.result;
  let visits = os?.visits || [];
  if (visits.length < 2 && os?.projectCode) {
    // às vezes as visitas demoram um instante pra aparecer — relê uma vez
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const { data: d2 } = await axios.get(`${BASE_URL}/serviceorders/${os.projectCode}`, H);
      const o2 = d2?.result?.[0] || d2?.result || d2;
      if ((o2?.visits || []).length > visits.length) visits = o2.visits;
    } catch (e) {
      console.warn('Releitura da OS falhou:', e.response?.data || e.message);
    }
  }

  const taskIds = visits.map((v) => v.taskId);

  // 1ª tarefa = Desmontagem (tipo da OS), 2ª = Montagem (tipo próprio). Falha
  // aqui não derruba nada: a OS e as tarefas já existem.
  if (taskIds.length) {
    const endereco = await obterEnderecoCliente(customerId, H);
    const plano = [
      { nome: 'DESMONTAGEM', taskType: cfg.tipoDesmontagemId },
      { nome: 'MONTAGEM', taskType: cfg.tipoMontagemId },
    ];
    for (let i = 0; i < Math.min(taskIds.length, plano.length); i++) {
      try {
        await atualizarTarefa(
          taskIds[i],
          { taskType: plano[i].taskType, orientation: `${plano[i].nome} - OS ${os.projectCode} | ${resumo || ''}`, equipmentsIds },
          endereco,
          H
        );
      } catch (e) {
        console.error(`Falha ao ajustar tarefa ${taskIds[i]}:`, e.response?.data || e.message);
        avisos.push(`tarefa ${taskIds[i]} (${plano[i].nome}) criada, mas não consegui ajustar tipo/orientação`);
      }
    }
  }

  // A resposta do POST vem com "equipments" vazio; a Auvo preenche logo depois.
  // Confere relendo a OS (a API devolve objetos, o id está em "code").
  if (equipmentsIds.length) {
    try {
      const { data: dOS } = await axios.get(`${BASE_URL}/serviceorders/${os.projectCode}`, H);
      const o = dOS?.result?.[0] || dOS?.result || dOS;
      const vinculados = (o?.equipments || []).map((e) => Number(e?.code ?? e?.id ?? e));
      if (!equipmentsIds.every((id) => vinculados.includes(id))) {
        avisos.push('máquinas (equipamentos) não ficaram vinculadas à OS — vincule manualmente na Auvo');
      }
    } catch (e) {
      console.warn('Não consegui conferir os equipamentos da OS:', e.response?.data || e.message);
    }
  }

  return { projectCode: os.projectCode, taskIds, avisos };
}

module.exports = { getTaskInfo, criarOSInterna };
