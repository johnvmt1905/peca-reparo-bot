require('dotenv').config();
const { App } = require('@slack/bolt');

const { registerCommand } = require('./handlers/command');
const { registerTaskLookup } = require('./handlers/taskLookup');
const { registerFormSubmit } = require('./handlers/formSubmit');
const { registerSendToTrello } = require('./handlers/sendToTrello');
const { registerPecaSubmit } = require('./handlers/pecaSubmit');

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

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ pecareparo-bot rodando (socket mode: ${process.env.USE_SOCKET_MODE === 'true'})`);
})();
