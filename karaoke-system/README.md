# Karaoke AI Pro

Sistema de karaokê com **3 telas**:

1. **Tela principal (TV/PC)** — `/` — mostra o QR Code, a fila de cantores, toca
   a música + letra sincronizada e exibe a pontuação ao vivo.
2. **Painel administrativo** — `/admin` — cadastra músicas (áudio + `.lrc`).
3. **App do celular** — `/sing` — o cantor abre pelo QR Code: digita o nome,
   escolhe **solo** ou **batalha de dois**, seleciona a música e o celular
   capta a voz (o áudio nunca sai do aparelho — só dados de volume/afinação
   são enviados ao servidor).

Arquitetura: **client** (React + Vite + TS + Tailwind, as 3 telas acima) fala
com um **server** (Node + Express + WebSocket + SQLite) que guarda o catálogo
de músicas e orquestra fila, sessões, duelos e pontuação em tempo real.

```
karaoke-system/
  server/   Node + Express + WebSocket + SQLite
  client/   React (TV, Admin, Sing) — Vite + TS + Tailwind
```

## Como rodar

Abra dois terminais.

**Terminal 1 — servidor:**
```bash
cd server
npm install
npm run dev
```
Sobe em `http://localhost:3001` (REST em `/api/songs`, WebSocket em `/ws`).

**Terminal 2 — client:**
```bash
cd client
npm install
npm run dev -- --host
```
O terminal mostra uma URL tipo `http://192.168.x.x:5173`. Abra essa URL:

- No **notebook/PC ligado na TV**: acesse a raiz (`http://SEU_IP:5173/`) — essa
  é a tela principal com o QR Code.
- No **celular de cada cantor**: escaneie o QR Code (ele já aponta para
  `/sing`), ou acesse `http://SEU_IP:5173/sing` manualmente.
- No **seu notebook**, para cadastrar músicas: `http://SEU_IP:5173/admin`.

> Todos os dispositivos (PC/TV, celulares, notebook do operador) precisam
> estar na **mesma rede Wi-Fi**. O client descobre o servidor automaticamente
> pelo IP que você usou para abrir a página (porta 3001).

> Captação de microfone (`getUserMedia`) só funciona em contexto seguro
> (HTTPS ou `localhost`). Em rede local via `http://192.168.x.x`, o Chrome/
> Safari mobile modernos costumam liberar mesmo assim para IPs privados; se
> não liberar no seu aparelho, publique o client com HTTPS (Vercel, Netlify,
> túnel ngrok etc.) apontando para o mesmo servidor.

## Fluxo de uso

1. No painel `/admin`, cadastre as músicas (arquivo de áudio + `.lrc`
   opcional).
2. Abra `/` na TV — vai aparecer o QR Code e a fila vazia.
3. Cada cantor escaneia o QR, digita o nome e escolhe:
   - **Solo**: escolhe a música e entra na fila.
   - **Batalha de dois**: ou cria uma batalha (escolhe a música e espera um
     oponente) ou entra numa batalha já aberta por outro cantor.
4. Na TV, o operador toca em **"Chamar próximo"** — todos os celulares
   envolvidos recebem a contagem regressiva, a música toca na TV, os
   celulares liberam o microfone e passam a mandar apenas os dados de
   análise vocal (nunca o áudio bruto).
5. Ao fim da música, a TV mostra o resultado (nota solo, ou comparação
   lado a lado no duelo, com vencedor) e os celulares mostram o resultado
   individual. O histórico fica salvo no SQLite (`server/data.sqlite`,
   tabela `history`).

## Como funciona a pontuação (MVP)

Ainda não há uma melodia de referência por música (isso pede uma trilha de
pitch esperado por faixa — próximo passo natural para a fase de IA). A
pontuação atual mede, durante as janelas em que uma linha de letra está
ativa: se o cantor está emitindo som, e quão estável/clara é a nota captada
(autocorrelação via Web Audio API), com bônus de combo por sequências boas.
Sem `.lrc`, a música inteira vira "janela ativa" e a pontuação continua
funcionando.

## Protocolo WebSocket (resumo)

Cliente → servidor: `tv:hello`, `singer:createSolo`, `singer:createDuel`,
`singer:listOpenDuels`, `singer:joinDuel`, `operator:startNext`,
`operator:cancelActive`, `tv:sessionEnded`, `frame`.

Servidor → clientes: `state` (fila + sessão ativa), `session:created`,
`session:joined`, `session:opponentJoined`, `openDuels`, `session:countdown`,
`live` (pontuação ao vivo), `session:end` (resultado final), `error`.

## Próximos passos sugeridos

- Autenticação/QR por sessão (evitar que qualquer um na rede acesse `/admin`).
- Melodia de referência por música para pontuação de afinação real.
- Playlists, ranking histórico e exportação de resultados no painel admin.
- PWA (ícone na tela inicial do celular, reconexão mais resiliente).
- Deploy com HTTPS para funcionar fora da rede local.
