// Script SOMENTE LEITURA: lista IDs úteis da Auvo (usuários, tipos de tarefa e statusId de OS).
// Uso (na raiz do projeto, com o .env preenchido): node scripts/listarIdsAuvo.js
require('dotenv').config();
const axios = require('axios');

const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';

async function login() {
  const { data } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  return data.result?.accessToken || data.accessToken;
}

async function listar(token, caminho, params = {}) {
  const todos = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await axios.get(`${BASE}${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, pageSize: 100, paramFilter: undefined, ...params },
    });
    const r = data?.result;
    const entries = r?.entityList || r?.Entities || r?.entities || (Array.isArray(r) ? r : []);
    if (!entries.length) break;
    todos.push(...entries);
    if (entries.length < 100) break;
  }
  return todos;
}

(async () => {
  const token = await login();

  console.log('\n=== USUÁRIOS (GET /users) ===');
  try {
    const users = await listar(token, '/users');
    console.table(users.map((u) => ({
      id: u.userID ?? u.id,
      nome: u.name,
      login: u.login,
      email: u.email,
    })));
  } catch (e) { console.log('Erro:', e.response?.data || e.message); }

  console.log('\n=== TIPOS DE TAREFA (GET /tasktypes) ===');
  try {
    const tipos = await listar(token, '/tasktypes');
    console.table(tipos.map((t) => ({
      id: t.id ?? t.taskTypeId,
      descricao: t.description ?? t.descricao,
    })));
  } catch (e) { console.log('Erro:', e.response?.data || e.message); }

  console.log('\n=== ORDENS DE SERVIÇO (GET /serviceorders) — procure o statusId ===');
  try {
    const { data } = await axios.get(`${BASE}/serviceorders`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, pageSize: 20 },
    });
    const r = data?.result;
    const lista = r?.entityList || r?.Entities || r?.entities || (Array.isArray(r) ? r : []);
    const vistos = new Map();
    for (const os of lista) {
      for (const [k, v] of Object.entries(os)) {
        if (/status/i.test(k) && v !== null && typeof v !== 'object') {
          vistos.set(`${k}=${v}`, true);
        }
      }
    }
    console.log('Campos tipo "status" distintos encontrados:');
    console.log([...vistos.keys()].join('\n') || '(nenhum)');
    console.log('\nJSON completo da 1ª OS (me manda isso):');
    console.log(JSON.stringify(lista[0] || data, null, 2));
  } catch (e) { console.log('Erro:', e.response?.data || e.message); }
})();
