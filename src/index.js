require('dotenv').config();
const http = require('http');
const { App } = require('@slack/bolt');

const { registerCommand } = require('./handlers/command');
const { registerTaskLookup } = require('./handlers/taskLookup');
const { registerFormSubmit } = require('./handlers/formSubmit');
const { registerSendToTrello } = require('./handlers/sendToTrello');
const { registerPecaSubmit } = require('./handlers/pecaSubmit');

// Bug conhecido do @slack/socket-mode (StateMachine "Unhandled event 'server
// explicit disconnect' in state 'connecting'") — acontece quando o Slack
// manda um disconnect bem na hora da reconexão. Só tem correção definitiva
// no Bolt v4 (major, com possíveis breaking changes). Enquanto isso, o mais
// seguro é deixar o processo cair de forma limpa e o Render reiniciar
// sozinho (ele já faz isso por padrão), em vez de deixar o processo travado
// num estado inconsistente.
process.on('uncaughtException', (err) => {
  console.error('Exceção fatal — reiniciando o processo:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('Promise rejeitada sem tratamento — reiniciando o processo:', err);
  process.exit(1);
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: process.env.USE_SOCKET_MODE === 'true',
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',
});

// Sem isso, erros dentro dos handlers (ex: exception num app.view) podem
// ficar engolidos e o terminal fica "mudo" mesmo com o processo travado.
app.error(async (error) => {
  console.error('Erro não tratado no Bolt:', error);
});

registerCommand(app);
registerTaskLookup(app);
registerFormSubmit(app);
registerSendToTrello(app);
registerPecaSubmit(app);

// Servidor HTTP separado, só pra health check (Render/UptimeRobot). Em
// Socket Mode o Bolt não abre porta HTTP nenhuma sozinho — sem isso, o
// Render nunca detecta o serviço como "no ar" e o ping de manter-acordado
// não tem o que responder.
const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  })
  .listen(port, '0.0.0.0', () => {
    console.log(`Health check HTTP ouvindo em 0.0.0.0:${port}`);
  });

(async () => {
  await app.start();
  console.log(`⚡️ pecareparo-bot rodando (socket mode: ${process.env.USE_SOCKET_MODE === 'true'})`);
})();