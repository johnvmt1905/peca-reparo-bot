// Imprime um token de acesso da Auvo (vale ~30 min) pra colar no console da documentação.
// NÃO compartilhe esse token com ninguém. Uso: node scripts/obterToken.js
require('dotenv').config();
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
(async () => {
  const r = await fetch(`${BASE}/login?apiKey=${encodeURIComponent(process.env.AUVO_API_KEY)}&apiToken=${encodeURIComponent(process.env.AUVO_API_TOKEN)}`);
  const j = await r.json();
  console.log(j.result?.accessToken || j.accessToken || JSON.stringify(j));
})();
