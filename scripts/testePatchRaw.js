// TESTE LIMPO: PATCH /tasks/{id} com fetch nativo (sem axios), imprimindo resposta crua + cabeçalhos.
// Antes faz um GET de controle com o mesmo token. Serve também de evidência pro suporte da Auvo.
// Uso: node scripts/testePatchRaw.js <taskId>     ex.: node scripts/testePatchRaw.js 81271484
require('dotenv').config();
const BASE = process.env.AUVO_BASE_URL || 'https://api.auvo.com.br/v2';
const taskId = process.argv[2];
if (!taskId) { console.error('Uso: node scripts/testePatchRaw.js <taskId>'); process.exit(1); }

async function chamar(nome, metodo, url, token, contentType, corpo) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (contentType) headers['Content-Type'] = contentType;
  const r = await fetch(url, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const texto = await r.text();
  console.log(`\n=== ${nome} ===`);
  console.log(`${metodo} ${url.replace(BASE, '')} -> HTTP ${r.status}${corpo !== undefined ? ' | corpo enviado: ' + JSON.stringify(corpo) : ''}`);
  const interessantes = ['content-type', 'x-request-id', 'request-id', 'x-correlation-id', 'server', 'date', 'x-amzn-requestid', 'x-amz-apigw-id', 'via'];
  for (const h of interessantes) if (r.headers.get(h)) console.log(`  ${h}: ${r.headers.get(h)}`);
  console.log(`  corpo: ${texto.slice(0, 300)}`);
  return r.status;
}

(async () => {
  const lr = await fetch(`${BASE}/login?apiKey=${encodeURIComponent(process.env.AUVO_API_KEY)}&apiToken=${encodeURIComponent(process.env.AUVO_API_TOKEN)}`);
  const lj = await lr.json();
  const token = lj.result?.accessToken || lj.accessToken;

  const url = `${BASE}/tasks/${taskId}`;
  await chamar('CONTROLE: GET da tarefa', 'GET', url, token);

  const op = (path, value) => [{ op: 'replace', path, value }];
  await chamar('PATCH lista, path sem barra, application/json', 'PATCH', url, token, 'application/json', op('orientation', 'TESTE RAW 1'));
  await chamar('PATCH lista, path com barra, application/json', 'PATCH', url, token, 'application/json', op('/orientation', 'TESTE RAW 2'));
  await chamar('PATCH lista, path com barra, json-patch+json', 'PATCH', url, token, 'application/json-patch+json', op('/orientation', 'TESTE RAW 3'));
  await chamar('PATCH lista, caixa diferente (/Orientation)', 'PATCH', url, token, 'application/json-patch+json', op('/Orientation', 'TESTE RAW 4'));
  await chamar('PATCH objeto único (exemplo literal da doc)', 'PATCH', url, token, 'application/json', { op: 'replace', path: 'orientation', value: 'TESTE RAW 5' });

  await chamar('CONTROLE FINAL: GET da tarefa', 'GET', url, token);
})().catch((e) => console.error(e));
