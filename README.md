# pecareparo-bot

Bot Slack acionado por `/pecareparo` que abre um chamado de peça de reparo,
enriquece com dados do Auvo (Cliente/Técnico via Nº da Tarefa) e cria um card
no Trello com as fotos anexadas.

## Fluxo

1. `/pecareparo` → abre modal 1 (Nº da Tarefa, Peça, Defeito, Máquina, N.S.,
   Intermitente/Contínuo). Ao digitar o Nº da Tarefa e apertar Enter, o bot
   busca Cliente/Técnico na Auvo e mostra no próprio modal.
2. Ao registrar, o bot posta um resumo na **mesma conversa onde `/pecareparo`
   foi digitado** (inclusive numa DM entre duas outras pessoas) com o botão
   **Enviar para o Trello**.
3. Clicar no botão abre o modal 2 (Modelo da Peça, N.S. da Peça, Fotos).
4. Ao confirmar, o bot cria o card no Trello (lista fixa) e sobe as fotos
   como anexos, depois atualiza a mensagem original no Slack com o link do card.

## Configuração do App Slack

Crie o app em https://api.slack.com/apps e habilite:

- **Slash Commands**: `/pecareparo`
- **Interactivity & Shortcuts**: ligado (necessário pra modais e botões)
- **OAuth Scopes (Bot Token)**: `commands`, `files:read`
  (não precisa de `chat:write` nem `im:write` — as mensagens são postadas via
  `response_url`, que funciona em qualquer conversa onde o comando/botão foi
  usado, incluindo DM entre duas outras pessoas, sem o bot precisar ser membro)
- **Socket Mode**: recomendado pra não precisar expor uma URL pública
  (gera o `SLACK_APP_TOKEN`); senão, configure a Request URL apontando
  pro endereço público do servidor.

## Configuração

1. `cp .env.example .env` e preencher com as credenciais do Slack, Trello e Auvo.
2. `TRELLO_LIST_ID`: ID da lista fixa onde os cards serão criados
   (pegue via `GET https://api.trello.com/1/boards/{id}/lists`).
3. `npm install`
4. `npm start` (ou `npm run dev` pra reiniciar automaticamente).

## Pontos que precisam de ajuste fino antes de ir pra produção

- **`src/services/auvo.js`**: o endpoint e os nomes dos campos de
  cliente/técnico foram escritos com base na doc pública da Auvo API v2, mas
  o mapeamento exato (`customerDescription`, `userDescription` etc.) precisa
  ser validado contra uma chamada real na conta de vocês — comparar com o
  que a integração Omie→Auvo já existente usa.
- **Descrição do card**: os campos Nº Nota Fiscal, Nº O.S. Gzero, orçamentos
  e logística ficam em branco no card (não são coletados nos modais) — quem
  gerencia o card no Trello preenche depois.
- **Reenvio duplicado**: hoje nada impede clicar duas vezes em "Enviar para o
  Trello" rápido o bastante pra abrir dois modais 2 — se isso virar problema
  na prática, dá pra desabilitar o botão original assim que for clicado.
- **Limites do `response_url`**: cada `response_url` do Slack vale por até
  30 minutos e pode ser usado até 5 vezes. Isso é folgado pro fluxo normal
  (preencher os modais leva segundos/minutos), mas se algum dia alguém
  demorar muito pra terminar de preencher um modal, o post final pode falhar
  — nesse caso o log vai mostrar o erro vindo do axios.post.
