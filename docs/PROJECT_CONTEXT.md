# Merge Merge Merge! — Contexto do projeto (guia para o Claude)

> Leia este arquivo ANTES de analisar a primeira mensagem de um chat novo. Atualize-o ao final de qualquer mudança relevante
> (nova feature, integração, armadilha descoberta). O usuário fala português: responda sempre em português.

## 1. Visão geral
- Jogo web de merge/match 2D "Merge Merge Merge!" (tema fast food), feito em **Cocos Creator 3.8.8 + TypeScript**, destino: **Poki** (web-mobile).
- Projeto Cocos: `PlayableAd/`. Código: `PlayableAd/assets/Scripts/Match/`. Cena única: `assets/Scenes/PlayableAdMatch.scene`.
- Game id Poki: `merge-merge-merge!-fast-food` (`RankingManager.pokiGameId`, definido na cena).
- Design em **1280x720**, política **SHOW_ALL** (letterbox), definida no topo de `GameManager.ts` (nível de módulo, antes do Canvas alinhar a câmera).
- Barras do letterbox e dica "Rotate your device" (retrato em celular) são **DOM** em `build-templates/web-mobile/index.ejs` (o motor desenha itens fora dos 1280px, ex. seleção de fases; as barras DOM cobrem isso).

## 2. Fluxo do jogo
`PokiService.ready()` → `GameManager.bootFlow()`:
- 1ª vez do jogador: pula menu, vai ao nível 1 com **tutorial** (curto; termina com `RankingManager.PromptProfile` pedindo nickname antes de `StartGame`).
- Quem já jogou: vai direto à **seleção de fases** (`LevelSelector`). `StartScreen` (botão Play) só aparece quando configurado.
- `chooseLevel` → `PokiService.commercialBreak()` (só ao entrar em gameplay) → `BeginPlay`. `gameplayStart` dispara no primeiro input (Tutorial→Running); `gameplayStop` em vitória/derrota/foco perdido.
- Vitória/derrota: prefabs `WinnerScreen`/`FailScreen` (sorting layer 1). Fail: Restart, Continue (anúncio, vermelho, ícone play) , Levels. Restart usa `GameManager.reloadWithBreak()`; Levels usa `reloadScene()` (sem anúncio).
- Recarregar cena: `GameManager.sceneName = 'PlayableAdMatch'` (`getScene().name` é vazio em runtime).

## 3. Mecânicas principais
- Tabuleiro de comidas (sheet `GameImage/food-elements-sheet.png`, 15 itens, fatiado em runtime); prateleira de 7 slots (`MatchSlots`, `MatchController`); merge de 2 ou 3 iguais; clicar no item da prateleira o devolve ao tabuleiro.
- **Pedidos (Orders)** (`OrderManager`): quantidades exatas; merge só se algum pedido visível pede; prioridade pelo pedido mais acima; sem limite de pedidos (cards encolhem); entrega no prazo soma tempo, atrasado fica negativo e subtrai tempo; estrelas por pedidos atrasados (`calculateStars`).
- **Combo** (`ComboManager`): 2x–8x, barra com drenagem; assets em `UI/Combo`; pontos = n * multiplicador.
- **Timer**: baseado em relógio real (`performance.now` + `setInterval`) para continuar em aba em segundo plano; alarme <10s.
- **Níveis** (`LevelConfig`, `LevelProgress`): progressão procedural, 3 níveis grátis, nível especial a cada 10; seleção com scroll/pool em `LevelSelector`.
- **Moedas** (`PlayerWallet` em `PlayerInventory.ts`): ganhas por merges (voam até o holder, `CoinsHolderView`/`PowerupManager.FlyCoinsTo`), conquistas e anúncio (+5000, **sem cooldown**). Holder de moedas só na seleção de fases.
- **Power-ups** (`PowerupManager`, `PowerupCatalog`, `PlayerInventory`): 8 itens, compra com moedas ou anúncio (botão vermelho com ícone play), tooltip no hover, revive na derrota (`ReviveButton`).
- **Conquistas** (`AchievementManager`): 20 padrão, editáveis no Inspector; ícones da sheet `UI/achivements-icon-sheet.png` (768px; retângulos escalados por `texture.width/1024`); banners em pool na win screen; claim com moedas voando.
- **Ranking** (`RankingManager`): placar por estrelas via Poki AUDS (ver §5), prompt de nickname/login, filtro de palavrões (`BadWords.ts`).
- Estatísticas: `PlayerStats`; persistência em `PlayerData.reloadAll()`.

## 4. Persistência (localStorage)
Chaves: `match3_level_stars`, `match3_powerups`, `match3_points`, `match3_stats` (+ nickname/flags de primeira vez). Com o jogador logado na Poki, os **gamesaves em nuvem sincronizam o localStorage automaticamente** — não há save de progresso próprio no AUDS. Após login, `PlayerData.reloadAll()`/`reloadState()` relêem tudo.

## 5. Integrações
### Poki SDK (`PokiService.ts`)
- Script do SDK em `build-templates/web-mobile/index.ejs` e `preview-template/index.ejs`.
- API usada: init, `gameLoadingFinished`, `gameplayStart/Stop` (dedupe), `commercialBreak`, `rewardedBreak`, `getUser`, `login`.
- `runBreak` muta áudio, bloqueia input (nó `BlockInputEvents`) e tem teto de 90s. Guardas de página (teclas/scroll) ignoram INPUT/TEXTAREA.
- `adsEnabled` = dentro de iframe ou hostname contendo "poki". Falha de anúncio: **silenciosa** (sem mensagens custom de ad-block, sem cooldown interno).
- **`devRewardBypass = PREVIEW`** (import de `cc/env`): recompensa direta só no preview do editor; **deve ser false na build publicada** — nunca mudar para true.
- Foco: perder foco → `gameplayStop`; `game.resume` em `EVENT_HIDE` para manter o jogo rodando.
### Poki AUDS (ranking)
`https://auds.poki.io/v0/<gameId>/userdata/<key>`; só a chave `leaderboard` com `{name, stars}`. Sync com create/update usando secret, `fetchTop` (`?sort=-stars&limit=N`), `fetchMyRank` (filtro `$gt`). Só foi testado contra **mock** — confirmar com a Poki/ambiente real.
### Login/nickname
Prompt DOM `<input>` (EditBox indisponível), botão "LOGIN WITH POKI", `isNameAllowed` + `BadWords.isProfane` (lista Poki + extras PT/ES/FR/DE/EN, normalização leet). Falhas conhecidas: bloqueia "Niggle", não pega "sl*t". Nomes ofensivos de outros jogadores viram "Player".

## 6. Build e deploy
- Build pela CLI (editor pode ficar aberto): `/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project <pasta PlayableAd> --build "platform=web-mobile;debug=false"` → `PlayableAd/build/web-mobile` (o código de saída 36 ocorre mesmo com sucesso; confira o log "build Task ... Finished").
- Templates: `PlayableAd/build-templates/web-mobile/` (`index.ejs` com tela de loading própria, barras de letterbox, rotate-hint, fonte `loading-font.ttf` = FoxBubble, `loading-bg.jpg`, `loading-title.png`, `favicon.png`).
- Zip p/ upload Poki: conteúdo de `build/web-mobile` com `index.html` na raiz → `PlayableAd/build/merge-merge-merge-web-mobile.zip` (`zip -qr -X ... . -x "*.DS_Store"`).
- **Release**: `scripts/build-release.sh [vX.Y.Z]` faz build Cocos pela CLI + valida + zip (e cria a tag local). O push da tag `v*` aciona `.github/workflows/release.yml`, que zipa a `build/web-mobile` **versionada** e cria o GitHub Release com o zip (o Cocos não roda no CI, por isso a build é gerada localmente e commitada). Fluxo: script → commit → `git push origin main` → `git push origin vX.Y.Z`. Também há `workflow_dispatch` com input de versão.
- **GitHub Actions** (`.github/workflows/deploy-pages.yml`): todo push em `main` publica `PlayableAd/build/web-mobile` no GitHub Pages — a pasta `build` é versionada, então **regenere a build antes de commitar**.
- Teste local: `python3 -m http.server <porta>` dentro de `build/web-mobile`. Sem iframe da Poki os anúncios ficam desativados. Encerre servidores ao terminar.
- Tamanho atual ~7 MB. `background.png` foi reduzido a 512x288 (fundo desfocado); `heart.png` 512px; sheet de conquistas 768px.

## 7. Requisitos Poki (resumo do que já foi tratado)
Botões de recompensa NÃO verdes (usamos vermelho + ícone play) e com botão padrão ao lado/acima; `commercialBreak` só ao entrar em gameplay; sem mensagens custom de ad-blocker; sem cooldown de anúncio interno; filtro de nickname; build limpa (sem `?poki-debug`/OpenURL); 16:9 com letterbox; download pequeno. Pendentes: testar no ambiente Poki real, confirmar AUDS, thumbnails (estática + animada, feitas pelo usuário), teste em aparelho real.

## 8. Armadilhas e lições (leia antes de mexer)
- **MCP do Cocos** (`mcp__code-mode__call_tool_chain`, `CocosEditor.*`): sandbox só JS puro. Propriedades de array e referências a Font **não** podem ser setadas via MCP → editar o JSON da cena/prefab **com a cena fechada**, depois `refresh` e reabrir. Para `SpriteFrame`, usar `{uuid:""}` em vez de `null`. Sprites importam com `type:"sprite-frame"`.
- Sprites: desligar trim (`sprite.trim=false`) em ícones (lock/moedas). Sorting2D: win/fail prefabs usam sorting layer 1; qualquer nó criado em runtime sob eles deve usar a mesma layer — ou ser "assado" no JSON do prefab (ex.: `AdIcon`), senão fica invisível.
- **Mask não funciona na build** (módulo ausente) → usar fade/hide por linha (ver `AchievementManager`).
- `UI Button` engole eventos globais de `input`: registre touch/wheel no próprio nó (como `LevelSelector`).
- Listeners do `GameManager` em troca de cena: usar `?.` / `isValid` (evita crash em `.off` nulo).
- Slots/merge: cuidado com `ShiftElementsFrom`, contagem de chegada (merge cedo) e slot índice 7.
- Moedas voando: somas parciais por índice, com o resto no último, para não somar a mais.
- Camera/Canvas: mudar a política de resolução depois do `onLoad` do Canvas deixa câmera deslocada — manter no nível de módulo.
- Fonte do projeto: `FoxBubbleRegular.ttf` (uuid nas cenas/prefabs `d3920345-…`); trocar fonte exige editar JSON.
- Texto do tutorial deve ser curto (já enxugado).

## 9. Testes (puppeteer-core + Chrome)
Scratchpad da sessão tinha scripts com `puppeteer-core` contra `http://localhost:<porta>` (preview 7456 ou build servida), com interceptação de requests para mockar AUDS e screenshots em 640x360, 836x470, 844x390 (mobile), 390x844 (mobile). Recriar quando precisar; `window.__gameReady` indica fim do boot.

## 10. Regras de trabalho com o usuário
- Responder em português. Não fazer commit/push sem pedir (repo tem muitas mudanças não commitadas; push em `main` publica no Pages).
- Backups de assets ficam FORA do projeto e só são apagados após confirmar que não houve perda de qualidade.
- Ações externas/difíceis de reverter (publicar, túnel público, push) pedem confirmação antes.
- Ao terminar mudanças relevantes: atualizar este arquivo.
