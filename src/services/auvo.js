const axios = require('axios');
const { extrairMaquinaENs } = require('./maquinaNS');

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
      const { maquina, nsMaquina } = await resolverMaquinaENs(task);
      return {
        cliente: task.customerDescription || task.customer?.description || '',
        tecnico: task.userToName || task.user?.name || '',
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

    const { maquina, nsMaquina } = await resolverMaquinaENs(task);
    return {
      cliente: task.customerDescription || task.customer?.description || '',
      tecnico: task.userToName || task.user?.name || '',
      maquina,
      nsMaquina,
      encontrado: true,
    };
  } catch (err) {
    console.error('Erro ao buscar tarefa na Auvo (fallback):', err.response?.data || err.message);
    return { cliente: '', tecnico: '', maquina: '', nsMaquina: '', encontrado: false, erro: true };
  }
}

module.exports = { getTaskInfo };