import { _decorator, Component, Label, Prefab, instantiate, Node, Sprite, find, director, sys, EventTarget, Color, Vec3, tween, Tween, game, Game, UIOpacity, UITransform, Sorting2D, ParticleSystem2D, view, ResolutionPolicy } from 'cc';
import { MatchElement } from './MatchElement';
import { LevelProgress } from './LevelProgress';
import { LevelPlan } from './LevelConfig';
import { OrderManager } from './OrderManager';
import { PokiService } from './PokiService';
import { PlayerWallet, PowerupInventory } from './PlayerInventory';
import { PowerupType } from './PowerupCatalog';
import { ComboManager } from './ComboManager';
import { PlayerStats, AchievementMetric } from './PlayerStats';
import { AchievementManager } from './AchievementManager';
import { SoundManager } from './SoundManager';
import { RankingManager } from './RankingManager';
import { PlayerData } from './PlayerData';
const { ccclass, property } = _decorator;

import { GameState } from './GameState';

// Layout desenhado em 1280x720: SHOW_ALL mantem tudo visivel em telas largas (celular deitado) ou estreitas (retrato).
// Roda no carregamento do modulo, antes do Canvas da cena alinhar a camera.
view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);

@ccclass('GameManager')
export class GameManager extends Component {

    @property
    public duration: number = 60;

    @property(Label)
    public timerLabel: Label = null!;

    @property(Sprite)
    public timerBar: Sprite = null!;

    @property(Prefab)
    public victoryPrefab: Prefab = null!;

    @property(Prefab)
    public defeatPrefab: Prefab = null!;

    @property([Node])
    public nodesToDeactivate: Node[] = [];

    @property(Node)
    public warningNode: Node | null = null;

    @property
    public warningThreshold: number = 10;

    @property({ tooltip: 'Cor do texto e da barra do timer durante a contagem final (abaixo de warningThreshold).' })
    public warningColor: Color = new Color(255, 40, 40, 255);

    @property({ tooltip: 'Escala maxima do pulso do timer a cada segundo da contagem final.' })
    public warningPulseScale: number = 1.4;

    @property({ tooltip: 'Angulo (graus) do tremor do timer a cada segundo da contagem final.' })
    public warningShakeAngle: number = 6;

    @property({ tooltip: 'Tempo (s) de espera, apos o ultimo merge acontecer, antes de mostrar a tela de vitoria.' })
    public victoryDelay: number = 0.5;

    @property({ type: Node, tooltip: 'Tela inicial com o botao de Play. Se vazio, o jogo comeca direto.' })
    public startScreen: Node | null = null;

    @property({ tooltip: 'Chave do cache local que marca que o jogador ja jogou (controla o tutorial).' })
    public hasPlayedStorageKey: string = 'match3_has_played';

    public static readonly EVENT_PLAY = 'game_play';
    /** Emitido quando o tabuleiro e o plano do nivel estao prontos (payload: LevelPlan). */
    public static readonly EVENT_LEVEL_READY = 'level_ready';
    /** Emitido pelo OrderManager quando os pedidos abertos mudam (novo pedido): o MatchController reavalia a prateleira. */
    public static readonly EVENT_DEMAND_CHANGED = 'demand_changed';
    /** Emitido ao continuar depois da derrota (payload: quantos power-ups foram dados). */
    public static readonly EVENT_REVIVED = 'revived';
    /** Emitido pelo OrderManager quando um pedido e entregue (payload: quantos ja foram entregues). */
    public static readonly EVENT_ORDER_DELIVERED = 'order_delivered';
    /** Emitido pelo MatchController quando a selecao muda (payload: Map<ElementType, number> com a contagem na prateleira). */
    public static readonly EVENT_SELECTION_CHANGED = 'selection_changed';

    @property({ tooltip: 'Nome da cena a recarregar no Restart/Levels. Necessario porque director.getScene().name vem vazio em runtime.' })
    public sceneName: string = 'PlayableAdMatch';

    /** Mostra um anuncio entre niveis (Poki) e depois recarrega a cena. Resolve false se a cena nao carregou. */
    public static reloadWithBreak(): Promise<boolean> {
        return PokiService.commercialBreak().then(() => GameManager.reloadScene());
    }

    /** Recarrega a cena do jogo. Retorna false se o carregamento nao iniciou. */
    public static reloadScene(): boolean {
        const name = GameManager.instance?.sceneName || director.getScene()?.name || 'PlayableAdMatch';
        const started = director.loadScene(name, (err) => {
            if (err) console.error(`[GameManager] Falha ao carregar a cena "${name}":`, err);
        });
        if (!started) console.error(`[GameManager] director.loadScene("${name}") nao iniciou.`);
        return started;
    }

    /** Estrelas ganhas na ultima vitoria (lidas pela tela de vitoria). */
    public static lastStars: number = 0;

    /** Nivel (indice, 0 = primeiro) escolhido no seletor; preservado ao reiniciar a cena. */
    public static currentLevel: number = 0;

    @property({ tooltip: 'Estrelas: 3 = todos os pedidos entregues no prazo; 2 = ate esta fracao dos pedidos atrasados; 1 = vitoria com mais atrasos.' })
    public twoStarLateRatio: number = 0.34;

    @property({ type: Prefab, tooltip: 'Efeito de brilho tocado no timer quando o tempo aumenta (verde) ou diminui (vermelho). Use o MergeEffect.' })
    public timeEffectPrefab: Prefab | null = null;

    @property({ tooltip: 'Cor do bonus de tempo (pedido entregue no prazo).' })
    public bonusColor: Color = new Color(70, 255, 100, 255);

    @property({ tooltip: 'Cor da penalidade de tempo (pedido atrasado).' })
    public penaltyColor: Color = new Color(255, 55, 55, 255);

    @property({ tooltip: 'Segundos de tempo dados ao continuar depois da derrota (anuncio com recompensa).' })
    public reviveSeconds: number = 20;

    @property({ tooltip: 'Quantos power-ups aleatorios o jogador ganha ao continuar depois da derrota.' })
    public revivePowerups: number = 2;

    @property({ tooltip: 'Tamanho da fonte do texto de tempo que voa ate o timer.' })
    public timeFxFontSize: number = 46;

    @property({ type: Node, tooltip: 'Seletor de niveis, aberto ao voltar das telas de vitoria/derrota.' })
    public levelSelector: Node | null = null;

    /** Se true, a proxima cena carregada abre direto o seletor de niveis (usado pelo botao Levels). */
    public static showSelectorOnLoad: boolean = false;

    /** Se true, a proxima cena carregada pula a tela inicial (usado pelo Restart). */
    public static skipMenuOnLoad: boolean = false;

    public readonly events: EventTarget = new EventTarget();

    /** Durante o tutorial guiado: so estes itens aceitam clique (null = todos liberados). */
    public tutorialAllowed: MatchElement[] | null = null;

    private currentState: GameState = GameState.Menu;
    private timer: number = 0;
    private totalElements: number = 0;
    private matchedElements: number = 0;
    private victoryPending: boolean = false;
    private lastRealTime: number = 0;
    private backgroundTick: number = 0;
    private timerBaseScale: Vec3 = new Vec3(1, 1, 1);
    private timerBaseColor: Color = new Color(255, 255, 255, 255);
    private barBaseColor: Color = new Color(255, 255, 255, 255);
    private lastWarningSecond: number = -1;
    private pendingDisplayDelta: number = 0;
    private flashColor: Color = new Color(255, 255, 255, 255);
    private flashUntil: number = 0;
    private timerFrozenFor: number = 0;
    private defeatInstance: Node | null = null;
    private pointsBanked: number = 0;
    private revived: boolean = false;

    public static instance: GameManager = null!;

    onLoad() {
        GameManager.instance = this;
        PokiService.init();
        PokiService.isGameplayActive = () => this.currentState === GameState.Running || this.currentState === GameState.Tutorial;
        this.lastRealTime = performance.now();

        // Fora de foco o engine pausa o loop (Game.EVENT_HIDE); aqui ele e retomado para o jogo continuar.
        game.on(Game.EVENT_HIDE, this.keepRunning, this);
        // Em aba oculta o navegador suspende o requestAnimationFrame: este intervalo (limitado a ~1s pelo
        // navegador) mantem o timer e a derrota funcionando mesmo assim.
        this.backgroundTick = setInterval(() => {
            if (this.tickRealTime()) this.updateTimerUI();
        }, 250) as unknown as number;
    }

    onDestroy() {
        game.off(Game.EVENT_HIDE, this.keepRunning, this);
        clearInterval(this.backgroundTick);
    }

    private keepRunning() {
        // O engine pausa logo apos emitir EVENT_HIDE, entao retoma no proximo ciclo.
        setTimeout(() => { if (game.isPaused()) game.resume(); }, 0);
    }

    /**
     * Avanca o timer pelo tempo real decorrido (nao pelo dt do frame): continua correto mesmo se o loop
     * ficar parado fora de foco. Retorna true se o jogo estava rodando.
     */
    private tickRealTime(): boolean {
        const now = performance.now();
        let elapsed = Math.max(0, (now - this.lastRealTime) / 1000);
        this.lastRealTime = now;
        if (this.currentState !== GameState.Running) return false;

        // Power-up Freeze Time: o cronometro do nivel fica parado.
        if (this.timerFrozenFor > 0) {
            const used = Math.min(elapsed, this.timerFrozenFor);
            this.timerFrozenFor -= used;
            elapsed -= used;
        }
        this.timer -= elapsed;

        if (this.warningNode && !this.warningNode.active && this.timer <= this.warningThreshold) {
            this.warningNode.active = true;
        }

        if (this.timer <= 0) {
            this.timer = 0;
            if (!this.victoryPending) this.SetState(GameState.Defeat);
        }
        return true;
    }

    start() {
        // Tudo o que precisa do carregamento ja esta pronto: avisa a Poki (uma vez por sessao).
        PokiService.gameLoadingFinished();

        if (this.timerLabel) {
            this.timerBaseScale.set(this.timerLabel.node.scale);
            this.timerBaseColor.set(this.timerLabel.color);
        }
        if (this.timerBar) this.barBaseColor.set(this.timerBar.color);

        this.timer = this.duration;
        this.updateTimerUI();

        if (this.warningNode) {
            this.warningNode.active = false;
        }

        // O save da nuvem da Poki (jogador logado) e injetado no localStorage durante o init do SDK: so decide o fluxo
        // inicial (tutorial, menu) depois dele, com um limite de tempo para nunca travar.
        PokiService.ready().then(() => {
            if (!this.isValid) return;
            PlayerData.reloadAll();
            this.bootFlow();
        });
    }

    private bootFlow() {
        // Primeira vez do jogador: pula o menu e vai direto para o nivel 1 com tutorial.
        const firstEver = !this.readHasPlayed();
        // Quem ja jogou pula a tela inicial ("Play") e cai direto na selecao de fases.
        const openSelector = !!this.levelSelector
            && (GameManager.showSelectorOnLoad || (!GameManager.skipMenuOnLoad && !firstEver));
        const direct = !openSelector && (GameManager.skipMenuOnLoad || firstEver);
        GameManager.showSelectorOnLoad = false;
        GameManager.skipMenuOnLoad = false;

        if (openSelector) {
            this.currentState = GameState.Menu;
            if (this.startScreen) this.startScreen.active = false;
            this.levelSelector!.active = true;
        } else if (this.startScreen && !direct) {
            this.currentState = GameState.Menu;
            this.startScreen.active = true;
        } else {
            if (this.startScreen) this.startScreen.active = false;
            if (firstEver) GameManager.currentLevel = 0;
            // Aguarda os outros componentes registrarem seus listeners no start().
            this.scheduleOnce(() => this.BeginPlay(), 0.05);
        }

        // Tudo pronto: a tela de carregamento da pagina (index.html) pode sumir.
        this.scheduleOnce(() => { (globalThis as any).__gameReady = true; }, 0.15);
    }

    /** Chamado pelo botao Play: entra no jogo e mostra o tutorial apenas na primeira vez. */
    public BeginPlay() {
        if (this.currentState !== GameState.Menu) return;
        if (this.startScreen) this.startScreen.active = false;

        const firstTime = !this.readHasPlayed();
        if (firstTime) this.writeHasPlayed();

        this.currentState = firstTime ? GameState.Tutorial : GameState.Running;
        // gameplayStart so no primeiro INPUT de jogo: no tutorial (sem jogo ainda) ele sai ao terminar o tutorial.
        if (!firstTime) PokiService.gameplayStart();
        this.events.emit(GameManager.EVENT_PLAY, firstTime);
    }

    private readHasPlayed(): boolean {
        try {
            return !!sys.localStorage.getItem(this.hasPlayedStorageKey);
        } catch (e) {
            return false;
        }
    }

    private writeHasPlayed() {
        try {
            sys.localStorage.setItem(this.hasPlayedStorageKey, '1');
        } catch (e) { }
    }

    public StartGame() {
        if (this.currentState === GameState.Tutorial) {
            this.currentState = GameState.Running;
            PokiService.gameplayStart();
        }
    }

    public IsRunning(): boolean {
        return this.currentState === GameState.Running;
    }

    public IsTutorialRunning(): boolean {
        return this.currentState === GameState.Tutorial;
    }

    /** Aplica a duracao do nivel (chamado pelo MatchInitializer ao montar o tabuleiro). */
    public ApplyLevelPlan(plan: LevelPlan) {
        this.duration = plan.duration;
        this.timer = plan.duration;
        this.lastRealTime = performance.now();
        this.lastWarningSecond = -1;
        this.pendingDisplayDelta = 0;
        this.updateTimerUI();
        this.events.emit(GameManager.EVENT_LEVEL_READY, plan);
    }

    // ---------- Power-ups / continuar ----------

    /** Power-up: para o cronometro do nivel por `seconds`. */
    public FreezeTimer(seconds: number) {
        this.timerFrozenFor = Math.max(this.timerFrozenFor, seconds);
    }

    public get timerFrozenSecondsLeft(): number { return this.timerFrozenFor; }

    public get hasRevived(): boolean { return this.revived; }

    /** Soma ao saldo do jogador os pontos ganhos nesta partida que ainda nao foram contabilizados. */
    private bankPoints() {
        const score = ComboManager.instance ? ComboManager.instance.score : 0;
        if (score > this.pointsBanked) {
            PlayerWallet.addPoints(score - this.pointsBanked);
            PlayerStats.increment(AchievementMetric.CoinsEarned, score - this.pointsBanked);
            this.pointsBanked = score;
        }
    }

    /**
     * Continuar depois da derrota (anuncio com recompensa): volta ao jogo de onde parou com mais tempo e
     * ganha power-ups aleatorios. So pode ser usado uma vez por nivel.
     */
    public Revive() {
        if (this.currentState !== GameState.Defeat || this.revived) return;
        this.revived = true;
        PlayerStats.increment(AchievementMetric.Revives);

        if (this.defeatInstance && this.defeatInstance.isValid) this.defeatInstance.destroy();
        this.defeatInstance = null;

        this.nodesToDeactivate.forEach(node => { if (node) node.active = true; });

        // Ao falhar, todos os itens voltaram a ordem de desenho padrao (ficando abaixo dos slots). Ao continuar, os
        // que estao na prateleira precisam voltar a ordem 3, senao ficam escondidos atras dos slots ainda "ocupados".
        const searchRoot = find("Canvas") || director.getScene();
        if (searchRoot) {
            searchRoot.getComponentsInChildren(MatchElement).forEach(el => {
                if (!el.isAvailable && el.currentSlot) el.SetSortingOrder(3);
                else el.SetSortingOrder(el.defaultSortingOrder);
            });
        }

        this.victoryPending = false;
        this.timer = this.reviveSeconds;
        SoundManager.playTimeIncreasing();
        this.timerFrozenFor = 0;
        this.lastWarningSecond = -1;
        this.pendingDisplayDelta = 0;
        this.lastRealTime = performance.now();
        this.currentState = GameState.Running;
        PokiService.gameplayStart();
        this.updateTimerUI();

        for (let i = 0; i < this.revivePowerups; i++) {
            PowerupInventory.add(Math.floor(Math.random() * 8) as PowerupType, 1);
        }
        this.events.emit(GameManager.EVENT_REVIVED, this.revivePowerups);
    }

    /** O nivel termina quando todos os pedidos foram entregues (chamado pelo OrderManager). */
    public CompleteLevel() {
        if (this.victoryPending) return;
        this.victoryPending = true;
        this.scheduleOnce(() => this.SetState(GameState.Victory), this.victoryDelay);
    }

    /**
     * Soma (ou subtrai) segundos do tempo do nivel. O texto do bonus/penalidade voa ate o timer e so ali
     * o valor exibido muda, com brilho verde (bonus) ou vermelho (penalidade).
     */
    public AddTime(delta: number, fromWorld?: Vec3) {
        if (delta === 0) return;
        this.timer += delta;
        if (delta > 0) {
            this.duration += delta; // bonus aumenta o tempo total do nivel
        }
        this.pendingDisplayDelta += delta;
        this.playTimeFx(delta, fromWorld);
    }

    private formatTime(seconds: number): string {
        const s = Math.max(0, Math.round(seconds));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r < 10 ? '0' : ''}${r}`;
    }

    private playTimeFx(delta: number, fromWorld?: Vec3) {
        const timerLabel = this.timerLabel;
        const parent = timerLabel?.node.parent;
        if (!timerLabel || !parent) {
            this.pendingDisplayDelta -= delta;
            if (delta > 0) SoundManager.playTimeIncreasing(); // sem texto voando: toca na hora
            return;
        }

        const positive = delta > 0;
        const color = positive ? this.bonusColor : this.penaltyColor;

        const fx = new Node('TimeFx');
        fx.layer = timerLabel.node.layer;
        fx.parent = parent;
        fx.addComponent(UITransform);
        const label = fx.addComponent(Label);
        label.useSystemFont = timerLabel.useSystemFont;
        if (timerLabel.font) label.font = timerLabel.font;
        label.fontSize = this.timeFxFontSize;
        label.lineHeight = this.timeFxFontSize;
        label.isBold = true;
        label.string = `${positive ? '+' : '-'}${this.formatTime(Math.abs(delta))}`;
        label.color = color;
        label.enableOutline = true;
        label.outlineColor = positive ? new Color(10, 70, 20, 255) : new Color(80, 0, 0, 255);
        label.outlineWidth = 4;
        fx.addComponent(Sorting2D).sortingOrder = 80;
        const opacity = fx.addComponent(UIOpacity);

        const start = new Vec3();
        parent.inverseTransformPoint(start, fromWorld || timerLabel.node.worldPosition);
        if (!fromWorld) start.y -= 70;
        const target = timerLabel.node.position.clone();

        fx.setPosition(start);
        fx.setScale(0.4, 0.4, 1);
        tween(fx)
            .to(0.18, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'backOut' })
            .delay(0.25)
            .to(0.45, { position: target, scale: new Vec3(0.7, 0.7, 1) }, { easing: 'cubicIn' })
            .call(() => {
                this.pendingDisplayDelta -= delta;
                this.updateTimerUI();
                this.flashTimer(color);
                // Bonus e penalidade so soam quando o texto chega ao timer e o valor exibido realmente muda.
                if (positive) SoundManager.playTimeIncreasing(); else SoundManager.playReducingTime();
                fx.destroy();
            })
            .start();
        tween(opacity).delay(0.75).to(0.12, { opacity: 40 }).start();
    }

    /** O texto do tempo "absorve" o bonus/penalidade: brilho colorido, pulso e particulas. */
    private flashTimer(color: Color) {
        const label = this.timerLabel;
        if (!label) return;

        this.flashColor.set(color);
        this.flashUntil = performance.now() + 500;
        label.color = color;

        const node = label.node;
        const base = this.timerBaseScale;
        Tween.stopAllByTarget(node);
        node.setRotationFromEuler(0, 0, 0);
        tween(node)
            .to(0.1, { scale: new Vec3(base.x * 1.5, base.y * 1.5, base.z) }, { easing: 'quadOut' })
            .to(0.25, { scale: base }, { easing: 'backOut' })
            .start();

        if (this.timeEffectPrefab && node.parent) {
            const effect = instantiate(this.timeEffectPrefab);
            effect.parent = node.parent;
            effect.setPosition(node.position);
            effect.setScale(1.3, 1.3, 1);
            const tint = new Color(color.r, color.g, color.b, 255);
            const fade = new Color(color.r, color.g, color.b, 0);
            effect.getComponentsInChildren(ParticleSystem2D).forEach(ps => {
                ps.startColor = tint;
                ps.endColor = fade;
                ps.resetSystem();
            });
        }
    }

    public RegisterElements(count: number) {
        this.IncreaseElements(count);
    }

    public IncreaseElements(value: number) {
        this.totalElements += value;
    }

    public RegisterMatch(count: number) {
        if (!this.IsRunning()) return;

        // A vitoria agora vem da entrega dos pedidos (OrderManager -> CompleteLevel).
        this.matchedElements += count;
    }

    private SetState(state: GameState) {
        this.currentState = state;
        if (state !== GameState.Running) {
            SoundManager.setAlarm(false);
            SoundManager.setHeartBeat(false);
        }

        if (state === GameState.Victory || state === GameState.Defeat) {
            PokiService.gameplayStop();
            // Pontos da partida (merges e combos) viram saldo do jogador.
            this.bankPoints();
        }

        if (state === GameState.Victory) {
            GameManager.lastStars = this.calculateStars();
            LevelProgress.setStars(GameManager.currentLevel, GameManager.lastStars);
            // Conquistas liberadas por esta vitoria aparecem como avisos por cima da tela de vitoria.
            AchievementManager.instance?.NotifyNewUnlocks();
            // Envia as estrelas totais ao ranking (AUDS).
            RankingManager.instance?.SyncScore();
            if (this.victoryPrefab) {
                const instance = instantiate(this.victoryPrefab);
                instance.parent = this.node.parent;
            }
        } else if (state === GameState.Defeat) {
            if (this.defeatPrefab) {
                const instance = instantiate(this.defeatPrefab);
                instance.parent = this.node.parent;
                this.defeatInstance = instance;
            }
        }

        if (state === GameState.Victory || state === GameState.Defeat) {
            this.nodesToDeactivate.forEach(node => {
                if (node) node.active = false;
            });

            if (this.warningNode) this.warningNode.active = false;

            const searchRoot = find("Canvas") || director.getScene();
            if (searchRoot) {
                const elements = searchRoot.getComponentsInChildren(MatchElement);
                elements.forEach(el => {
                    el.SetSortingOrder(el.defaultSortingOrder);
                });
            }
        }
    }

    update(deltaTime: number) {
        if (this.tickRealTime()) {
            this.updateTimerUI();
            this.updateWarningFeedback();
        }
    }

    /** Contagem final: texto/barra vermelhos e um pulso com tremor a cada segundo. */
    private updateWarningFeedback() {
        const inWarning = this.timer > 0 && this.timer <= this.warningThreshold;
        const label = this.timerLabel;
        if (!label) return;

        // Durante o brilho de bonus/penalidade a cor do flash tem prioridade.
        const frozen = this.timerFrozenFor > 0;
        label.color = performance.now() < this.flashUntil ? this.flashColor
            : (frozen ? new Color(120, 220, 255, 255) : (inWarning ? this.warningColor : this.timerBaseColor));
        if (this.timerBar) this.timerBar.color = inWarning ? this.warningColor : this.barBaseColor;
        SoundManager.setAlarm(inWarning && !frozen && this.currentState === GameState.Running);
        if (!inWarning) return;

        const second = Math.ceil(this.timer);
        if (second === this.lastWarningSecond) return;
        this.lastWarningSecond = second;

        const node = label.node;
        const base = this.timerBaseScale;
        const peak = this.warningPulseScale;
        const a = this.warningShakeAngle;
        Tween.stopAllByTarget(node);
        node.setScale(base);
        node.setRotationFromEuler(0, 0, 0);
        tween(node)
            .to(0.08, { scale: new Vec3(base.x * peak, base.y * peak, base.z), eulerAngles: new Vec3(0, 0, a) }, { easing: 'quadOut' })
            .to(0.08, { eulerAngles: new Vec3(0, 0, -a) })
            .to(0.1, { eulerAngles: new Vec3(0, 0, 0) })
            .to(0.3, { scale: base }, { easing: 'quadInOut' })
            .start();
    }

    /** 3 estrelas = terminar com bastante tempo sobrando; 1 estrela = qualquer vitoria. */
    private calculateStars(): number {
        const orders = OrderManager.instance;
        if (!orders || orders.totalOrders === 0) return 1;
        if (orders.lateOrders === 0) return 3;
        if (orders.lateOrders <= Math.ceil(orders.totalOrders * this.twoStarLateRatio)) return 2;
        return 1;
    }

    private updateTimerUI() {
        // Valor exibido: o bonus/penalidade so entra quando o texto de tempo chega ao timer.
        const shown = Math.max(0, this.timer - this.pendingDisplayDelta);
        if (this.timerLabel) {
            const minutes = Math.floor(shown / 60);
            const seconds = Math.floor(shown % 60);
            this.timerLabel.string = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }

        if (this.timerBar) {
            this.timerBar.fillRange = -1 * Math.min(1, Math.ceil(shown) / this.duration);
        }
    }
}
