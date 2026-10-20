// SOMENTE LEITURA: agrupa as OS por statusId pra descobrir qual é "aberta" e qual é "finalizada".
// Uso: node scripts/statusOS.js
require('dotenv').config();
const axios = require('axios');
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';

(async () => {
  const { data: login } = await axios.get(`${BASE}/login`, {
    params: { apiKey: process.env.AUVO_API_KEY, apiToken: process.env.AUVO_API_TOKEN },
  });
  const token = login.result?.accessToken || login.accessToken;

  const todas = [];
  for (let page = 1; page <= 30; page++) {
    const { data } = await axios.get(`${BASE}/serviceorders`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, pageSize: 100 },
    });
    const r = data?.result;
    const lista = r?.entityList || r?.Entities || r?.entities || (Array.isArray(r) ? r : []);
    if (!lista.length) break;
    todas.push(...lista);
    if (lista.length < 100) break;
  }

  const grupos = {};
  for (const os of todas) {
    const g = (grupos[os.statusId] ||= { total: 0, comVisitas: 0, visitasFinalizadas: 0, visitasAbertas: 0, exemplos: [] });
    g.total++;
    const v = os.visits || [];
    if (v.length) g.comVisitas++;
    g.visitasFinalizadas += v.filter((x) => x.finished).length;
    g.visitasAbertas += v.filter((x) => !x.finished).length;
    if (g.exemplos.length < 5) g.exemplos.push(`OS ${os.projectCode} (${os.dateFirstVisit?.slice(0, 10)})`);
  }
  console.log(`Total de OS lidas: ${todas.length}`);
  console.log(JSON.stringify(grupos, null, 2));
})().catch((e) => console.error(e.response?.data || e.message));
