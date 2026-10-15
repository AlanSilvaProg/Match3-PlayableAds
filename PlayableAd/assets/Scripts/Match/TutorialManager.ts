import { SoundManager } from './SoundManager';
import { tr } from './I18n';
import { Responsive } from './Responsive';
import { _decorator, Component, Node, Vec3, Color, Sprite, SpriteFrame, Label, Font, UITransform, Sorting2D, tween, Tween, UIOpacity, sys } from 'cc';
const { ccclass, property } = _decorator;

import { MatchController } from './MatchController';
import { MatchElement } from './MatchElement';
import { MatchInitializer } from './MatchInitializer';
import { OrderManager } from './OrderManager';
import { ElementCatalog } from './ElementCatalog';
import { PowerupManager } from './PowerupManager';
import { RankingManager } from './RankingManager';
import { PowerupType } from './PowerupCatalog';
import { PowerupInventory } from './PlayerInventory';
import { GameManager } from './GameManager';
import { CelebrationFx } from './CelebrationFx';
import { GoldenTime } from './GoldenTime';

/**
 * Primeira partida (antes do pedido de apelido/login): explica os PEDIDOS e guia o jogador a juntar o primeiro pedido.
 * Depois, tutoriais graduais (sem introducao longa): cada ensinamento aparece na hora em que faz sentido.
 *  1) tempo abaixo de 20s: fade no cronometro ("zerou = fracasso") e em seguida o tutorial do power-up +15s;
 *  2) pedido atrasado (prazo negativo): fade no pedido (o atraso e descontado do tempo total) e em seguida o
 *     tutorial do power-up Freeze Orders;
 *  3) jogador demora a comecar a primeira entrega: tutorial do power-up Focus (senao, ele aparece depois pela
 *     condicao de sempre: nenhuma entrega depois de 25s).
 * Os tutoriais de power-up (combo perdido, combo alto, etc.) continuam como antes. Cada aviso de fade aparece uma so vez.
 */
@ccclass('TutorialManager')
export class TutorialManager extends Component {

    @property({ type: Node, tooltip: 'Fundo escurecido do tutorial.' })
    public fadeNode: Node | null = null;

    @property({ type: Node, tooltip: 'Mao que aponta o proximo alimento a clicar.' })
    public tutorialIndicator: Node | null = null;

    @property(MatchController)
    public matchController: MatchController = null!;

    @property(MatchInitializer)
    public initializer: MatchInitializer = null!;

    @property({ type: SpriteFrame, tooltip: 'Fundo solido dos paineis de texto (ex.: UI/target_bkg).' })
    public panelFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Opacidade (0-255) do fundo escurecido.' })
    public fadeOpacity: number = 185;

    @property({ tooltip: 'Texto que convida o jogador a avancar.' })
    public continueText: string = 'Touch to continue';

    @property({ tooltip: 'Segundos ate um toque poder avancar o aviso (evita pulos acidentais).' })
    public tapDelay: number = 0.35;

    @property({ tooltip: 'O aviso do tempo aparece quando o cronometro cai abaixo deste valor (s).' })
    public lowTimeSeconds: number = 20;

    @property({ tooltip: 'Segundos sem tocar em nenhum item, antes da primeira entrega, para oferecer o power-up Focus.' })
    public slowStartSeconds: number = 8;

    private static readonly FADE_ORDER = 90;
    private static readonly HIGHLIGHT_OFFSET = 100;
    private static readonly UI_ORDER = 300;
    private static readonly FLAG_TIME = 'match3_tut_low_time';
    private static readonly FLAG_LATE = 'match3_tut_late_order';
    private static readonly FLAG_WRONG = 'match3_tut_wrong_many';
    private static readonly FLAG_GOLDEN = 'match3_tut_golden';

    private canTap: boolean = false;
    /** Introducao da 1a partida: 1 = explica os pedidos, 2 = clique guiado ate entregar o 1o pedido, 0 = fora dela. */
    private introStep: 0 | 1 | 2 | 3 = 0;
    private whitelist: MatchElement[] = [];
    private raised: { sorting: Sorting2D, original: number }[] = [];
    private captionRoot: Node | null = null;
    private captionLabel: Label | null = null;
    private continueLabel: Node | null = null;

    /** Aviso de fade em andamento (tempo baixo / pedido atrasado) e o power-up que vem em seguida. */
    private focusKind: 'time' | 'late' | 'wrong' | 'golden' | null = null;
    private goldenDone: (() => void) | null = null;
    private focusChain: PowerupType | null = null;

    /** Dica "toque no item da prateleira para remove-lo": mostrada uma unica vez, na primeira selecao errada. */
    private static readonly REMOVE_HINT_KEY = 'match3_remove_hint_seen';
    private static readonly REMOVE_HINT_MS = 9000;
    private hintElement: MatchElement | null = null;
    private hintUntil: number = 0;
    private handRaised: boolean = false;

    // ---------- Tutoriais contextuais de power-up ----------
    /** Cada power-up tem seu tutorial: aparece so ate o nivel 10 e so se o jogador nunca comprou/usou aquele power-up. */
    private static readonly GUIDE_MAX_LEVEL = 10;
    private static readonly GUIDE_COOLDOWN_MS = 6000;
    private static readonly GUIDE_TIMEOUT_MS = 25000;
    private guideType: PowerupType | null = null;
    private guideStartedAt: number = 0;
    private lastGuideEnd: number = -1e9;
    private runTime: number = 0;
    private idleTime: number = 0;
    private guideCheck: number = 0;

    protected start() {
        const ev = GameManager.instance?.events;
        ev?.on(GameManager.EVENT_COMBO_LOST, this.onComboLost, this);
        ev?.on(GameManager.EVENT_COMBO_LEVEL_UP, this.onComboLevelUp, this);
        ev?.on(GameManager.EVENT_POWERUP_USED, this.onPowerupUsed, this);
        ev?.on(GameManager.EVENT_SELECTION_CHANGED, this.onSelectionChanged, this);
        ev?.on(GameManager.EVENT_WRONG_SELECTED, this.onWrongSelected, this);
        ev?.on(GameManager.EVENT_PLAY, this.onPlay, this);
        ev?.on(GameManager.EVENT_ORDER_READY, this.onOrderReady, this);
        if (this.fadeNode) this.fadeNode.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
    }

    protected onDestroy() {
        const events = GameManager.instance?.events;
        events?.off(GameManager.EVENT_PLAY, this.onPlay, this);
        events?.off(GameManager.EVENT_ORDER_READY, this.onOrderReady, this);
        events?.off(GameManager.EVENT_WRONG_SELECTED, this.onWrongSelected, this);
        events?.off(GameManager.EVENT_COMBO_LOST, this.onComboLost, this);
        events?.off(GameManager.EVENT_COMBO_LEVEL_UP, this.onComboLevelUp, this);
        events?.off(GameManager.EVENT_POWERUP_USED, this.onPowerupUsed, this);
        events?.off(GameManager.EVENT_SELECTION_CHANGED, this.onSelectionChanged, this);
        if (GameManager.instance && (this.guideType !== null || this.focusKind)) GameManager.instance.timeHeld = false;
        if (PowerupManager.instance) PowerupManager.instance.forcedType = null;
        // Na troca de cena o no do fade pode ja ter sido destruido.
        if (this.fadeNode && this.fadeNode.isValid) this.fadeNode.targetOff(this);
        events?.off(GameManager.EVENT_ORDER_DELIVERED, this.onOrderDelivered, this);
        if (GameManager.instance) GameManager.instance.tutorialAllowed = null;
    }

    private onPlay(firstTime: boolean) {
        this.runTime = 0;
        this.idleTime = 0;
        if (!firstTime) return;
        // Primeira vez: introducao dos pedidos antes do apelido/login e do cronometro.
        GameManager.instance?.events.on(GameManager.EVENT_ORDER_DELIVERED, this.onOrderDelivered, this);
        this.scheduleOnce(() => this.introOrders(), 0.4);
    }

    // ---------- Introducao da primeira partida ----------

    private introOrders() {
        if (!OrderManager.instance) { this.finishIntro(); return; }
        this.introStep = 1;
        SoundManager.playTutorialStep();
        this.showFade(true);
        this.fadeNode?.targetOff(this);
        this.fadeNode?.on(Node.EventType.TOUCH_END, this.onIntroTap, this);
        this.highlight([OrderManager.instance.node]);
        this.showCaption(tr("The customer wants:\n{0}\nLet's prepare the order!", this.orderListText()), this.capPos('orders', new Vec3(95, 120, 0)), true);
        this.canTap = false;
        this.scheduleOnce(() => { this.canTap = true; }, this.tapDelay);
    }

    private onIntroTap() {
        if (!this.canTap || this.introStep !== 1) return;
        SoundManager.playMenuClick();
        this.introClick();
    }

    /** Clique guiado: so os alimentos do 1o pedido aceitam toque ate ele ser entregue. */
    private introClick() {
        this.introStep = 2;
        this.canTap = false;
        SoundManager.playTutorialStep();
        // Fade visivel mas sem capturar toques: os cliques chegam aos alimentos liberados.
        this.fadeNode?.targetOff(this);
        this.showFade(true);

        const order = OrderManager.instance?.GetFirstOrderLines() || [];
        const board = this.initializer ? this.initializer.node.getComponentsInChildren(MatchElement) : [];
        this.whitelist = [];
        for (const line of order) {
            const picks = board.filter(el => el.isAvailable && el.type === line.type && this.whitelist.indexOf(el) === -1)
                .slice(0, line.quantity);
            this.whitelist.push(...picks);
        }
        if (GameManager.instance) GameManager.instance.tutorialAllowed = this.whitelist;

        // A ordem de toque segue a hierarquia: os liberados vao para o topo para que nenhum item bloqueado
        // sobreposto a eles roube o clique.
        this.whitelist.forEach(el => el.node.setSiblingIndex(el.node.parent!.children.length - 1));

        const nodes: Node[] = this.whitelist.map(el => el.node);
        if (OrderManager.instance) nodes.push(OrderManager.instance.node);
        this.highlight(nodes);

        if (this.tutorialIndicator && !this.handRaised) {
            this.handRaised = true;
            this.tutorialIndicator.getComponentsInChildren(Sorting2D).forEach(sp => {
                sp.sortingOrder = TutorialManager.UI_ORDER + 50 + sp.sortingOrder;
            });
        }
        // A legenda fica numa faixa SEM alimentos: em retrato, na linha do combo; em paisagem, acima do tabuleiro.
        this.showCaption(tr('Tap {0} to put\nthem on the TRAY!', this.orderListText()), this.capPos('click', new Vec3(100, Responsive.top - 55, 0)), false, Responsive.portrait ? 0.8 : 0.62);
    }

    /** "2x Fries, 3x Ice Cream": o conteudo do 1o pedido, nos textos da introducao. */
    private orderListText(): string {
        const lines = OrderManager.instance?.GetFirstOrderLines() || [];
        return lines.map(l => `${l.quantity}x ${tr(ElementCatalog.getDef(l.type).name)}`).join(', ');
    }

    /** Passo 3 da introducao: o pedido ficou pronto na bandeja; so o botao ENTREGAR responde. */
    private onOrderReady() {
        if (this.introStep !== 2) return;
        this.introStep = 3;
        SoundManager.playTutorialStep();
        const gm = GameManager.instance;
        if (gm) gm.tutorialAllowed = []; // nenhum alimento aceita toque agora
        this.whitelist = [];
        this.fadeNode?.targetOff(this);
        this.showFade(true);
        if (OrderManager.instance) this.highlight([OrderManager.instance.node]);
        this.showCaption('Order complete!\nTap DELIVER to get your coins.', this.capPos('orders', new Vec3(95, 120, 0)), false);
    }

    private onOrderDelivered() {
        // O 1o pedido foi entregue: fim da introducao.
        if (this.introStep === 3) this.scheduleOnce(() => this.finishIntro(), 0.9);
    }

    /** A mao segue o proximo alimento a clicar. */
    private updateIntro() {
        if (!this.tutorialIndicator) return;
        if (this.introStep === 3) {
            const footer = OrderManager.instance?.firstReadyFooter();
            this.tutorialIndicator.active = !!footer;
            if (footer) this.tutorialIndicator.setWorldPosition(footer.worldPosition);
            return;
        }
        if (this.introStep !== 2) return;
        const selected = this.matchController ? this.matchController.selectedElements : [];
        const next = this.whitelist.find(el => el.isValid && el.node && el.isAvailable && selected.indexOf(el) === -1);
        if (next) {
            this.tutorialIndicator.active = true;
            this.tutorialIndicator.setWorldPosition(next.node.worldPosition);
        } else {
            this.tutorialIndicator.active = false;
        }
    }

    /** Depois da introducao: o cronometro comeca (o login/apelido so e pedido no fim da 1a rodada, veja RankingManager.gate). */
    private finishIntro() {
        this.introStep = 0;
        this.whitelist = [];
        this.fadeNode?.targetOff(this);
        this.showFade(false);
        this.clearHighlight();
        if (this.captionRoot) this.captionRoot.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
        const gm = GameManager.instance;
        if (!gm) return;
        gm.tutorialAllowed = null;
        // "Agora e a sua vez!" e so depois o inicio do cronometro.
        this.showYourTurn(() => GameManager.instance?.StartGame());
    }

    /** Texto grande "NOW IT'S YOUR TURN!" que pula, fica um instante e esvaece. `done` roda quando some. */
    private showYourTurn(done: () => void) {
        const parent = this.node.parent;
        if (!parent) { done(); return; }
        SoundManager.playTutorialStep();
        const root = new Node('YourTurn');
        root.layer = parent.layer;
        root.parent = parent;
        root.addComponent(UITransform).setContentSize(10, 10);
        const board = parent.getChildByName('MatchSpace');
        const at = board ? new Vec3(board.position.x, board.position.y + 20, 0) : new Vec3(0, 60, 0);
        root.setPosition(at);
        const op = root.addComponent(UIOpacity);
        const size = Responsive.portrait ? 64 : 84;
        const gold = new Color(255, 214, 51, 255), outline = new Color(120, 70, 0, 255);
        CelebrationFx.makeLabel(root, tr("NOW IT'S"), size, 0, size * 0.55, Color.WHITE, new Color(20, 30, 60, 255), 2);
        CelebrationFx.makeLabel(root, tr('YOUR TURN!'), Math.round(size * 1.25), 0, -size * 0.5, gold, outline, 3);
        root.setScale(0.2, 0.2, 1);
        tween(root)
            .to(0.3, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.12, { scale: Vec3.ONE })
            .delay(1.2)
            .call(() => { root.destroy(); done(); })
            .start();
        tween(op).delay(1.35).to(0.3, { opacity: 0 }).start();
    }

    // ---------- Tutoriais contextuais de power-up ----------

    private readonly guideTexts: { [k: number]: string } = {
        [PowerupType.MaxCombo]: 'Your combo ran out!\nMAX COMBO fills it to the top.\nHere is one FREE: tap it now!',
        [PowerupType.TimeBonus]: 'Time is running out!\n+15 SECONDS gives you extra time.\nHere is one FREE: tap it now!',
        [PowerupType.FreezeTimer]: 'Need a breather?\nFREEZE TIME stops the clock for 10s.\nHere is one FREE: tap it now!',
        [PowerupType.FreezeOrders]: 'An order is about to expire!\nFREEZE ORDERS stops all order timers.\nHere is one FREE: tap it now!',
        [PowerupType.ReduceQuantity]: 'Big orders? LESS ITEMS cuts every\nfood in every order down to 1.\nHere is one FREE: tap it now!',
        [PowerupType.AutoSelect]: 'Stuck? AUTO SELECT picks the foods\nof the next order for you.\nHere is one FREE: tap it now!',
        [PowerupType.Highlight]: 'Can\'t find the food? FOCUS highlights\nwhat you need for a few seconds.\nHere is one FREE: tap it now!',
        [PowerupType.DoublePoints]: 'Great combo!\nDOUBLE COINS doubles your coins.\nHere is one FREE: tap it now!',
    };

    private onSelectionChanged() { this.idleTime = 0; }

    private onComboLost() { this.tryStartGuide(PowerupType.MaxCombo); }

    private onComboLevelUp() { this.tryStartGuide(PowerupType.DoublePoints); }

    private onPowerupUsed(type: PowerupType) {
        if (this.guideType === type) this.finishGuide();
    }

    /** O tutorial deste power-up pode comecar agora? (nivel <= 10, nunca comprou/usou, nada mais em andamento) */
    private canStartGuide(type: PowerupType, ignoreCooldown: boolean = false): boolean {
        const gm = GameManager.instance;
        if (!gm || !gm.IsRunning() || this.guideType !== null || this.hintElement || this.focusKind || GoldenTime.active) return false;
        if (GameManager.currentLevel >= TutorialManager.GUIDE_MAX_LEVEL) return false;
        if (PowerupInventory.hasSeen(type)) return false;
        return ignoreCooldown || performance.now() - this.lastGuideEnd >= TutorialManager.GUIDE_COOLDOWN_MS;
    }

    private tryStartGuide(type: PowerupType) {
        if (this.canStartGuide(type)) this.startGuide(type);
    }

    /** Gatilhos por situacao (os de combo vem por evento). A primeira situacao que se aplica vence. */
    private updateGuides(dt: number) {
        const gm = GameManager.instance;
        if (!gm) return;

        if (this.focusKind) {
            if (!gm.IsRunning()) this.endFocus(false); // partida acabou durante o aviso
            return;
        }

        if (this.guideType !== null) {
            const slot = PowerupManager.instance?.slotNode(this.guideType);
            if (this.tutorialIndicator && slot && slot.isValid) this.tutorialIndicator.setWorldPosition(slot.worldPosition);
            // Partida acabou ou o jogador nao conseguiu usar: encerra sem prender o jogo.
            if (!gm.IsRunning() || performance.now() - this.guideStartedAt > TutorialManager.GUIDE_TIMEOUT_MS) this.finishGuide();
            return;
        }

        if (!gm.IsRunning() || gm.timeHeld || GoldenTime.active) return;
        this.runTime += dt;
        this.idleTime += dt;
        this.guideCheck -= dt;
        if (this.guideCheck > 0) return;
        this.guideCheck = 0.3;
        if (this.hintElement) return;

        const orders = OrderManager.instance;
        const left = gm.timeLeft;

        // 1) Tempo baixo: explica o cronometro e, em seguida, entrega o power-up +15s.
        if (left > 0 && left < this.lowTimeSeconds && !this.flagSet(TutorialManager.FLAG_TIME)) {
            const nodes: Node[] = [];
            if (gm.timerLabel) nodes.push(gm.timerLabel.node);
            if (gm.timerBar?.node.parent) nodes.push(gm.timerBar.node.parent);
            this.setFlag(TutorialManager.FLAG_TIME);
            this.startFocus('time', nodes, 'Time is running low!\nIf it reaches ZERO, you FAIL.',
                this.capPos('timer', new Vec3(60, 40, 0)), PowerupType.TimeBonus);
            return;
        }

        // 2) Pedido atrasado (prazo negativo): explica o desconto no tempo total e entrega o Freeze Orders.
        const late = orders ? orders.firstLateOrderNode() : null;
        if (late && !this.flagSet(TutorialManager.FLAG_LATE)) {
            this.setFlag(TutorialManager.FLAG_LATE);
            this.startFocus('late', [late], 'This order is LATE!\nWhen you deliver it, the delay is\nSUBTRACTED from your total time.',
                this.capPos('orders', new Vec3(95, 120, 0)), PowerupType.FreezeOrders);
            return;
        }

        // 3) Demora para comecar a primeira entrega: power-up Focus (ou, mais tarde, a condicao de sempre).
        const noDelivery = !!orders && orders.levelDeliveredOrders === 0;
        const candidates: [PowerupType, boolean][] = [
            [PowerupType.Highlight, noDelivery && ((this.idleTime >= this.slowStartSeconds && this.runTime >= this.slowStartSeconds) || this.runTime >= 25)],
            [PowerupType.FreezeTimer, left <= 25],
            [PowerupType.ReduceQuantity, !!orders && orders.maxPendingQuantity() >= 3 && this.runTime >= 5],
            [PowerupType.AutoSelect, this.idleTime >= 10 && this.runTime >= 10],
        ];
        for (const [type, cond] of candidates) {
            if (cond && this.canStartGuide(type)) { this.startGuide(type); return; }
        }
    }

    // ---------- Avisos de fade (tempo baixo / pedido atrasado) ----------

    private flagSet(key: string): boolean {
        try { return !!sys.localStorage.getItem(key); } catch (e) { return false; }
    }

    private setFlag(key: string) {
        try { sys.localStorage.setItem(key, '1'); } catch (e) { }
    }

    /** Para o tempo, escurece a tela com foco em `nodes` e explica. O toque seguinte entrega o power-up `chain`. */
    private startFocus(kind: 'time' | 'late', nodes: Node[], text: string, position: Vec3, chain: PowerupType) {
        const gm = GameManager.instance;
        if (!gm) return;
        this.focusKind = kind;
        this.focusChain = chain;
        gm.timeHeld = true;
        SoundManager.playTutorialStep();
        this.showFade(true);
        this.fadeNode?.targetOff(this);
        this.fadeNode?.on(Node.EventType.TOUCH_END, this.onFocusTap, this);
        this.highlight(nodes);
        this.showCaption(text, position, true);
        this.canTap = false;
        this.scheduleOnce(() => { this.canTap = true; }, this.tapDelay);
    }

    private onFocusTap() {
        if (!this.canTap || !this.focusKind) return;
        SoundManager.playMenuClick();
        this.endFocus(true);
    }

    private endFocus(chain: boolean) {
        const next = this.focusChain;
        this.focusKind = null;
        this.focusChain = null;
        this.canTap = false;
        this.fadeNode?.targetOff(this);
        this.showFade(false);
        this.clearHighlight();
        if (this.captionRoot) this.captionRoot.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
        const gm = GameManager.instance;
        if (gm) gm.timeHeld = false;
        const gd = this.goldenDone;
        this.goldenDone = null;
        if (gd) gd();
        // Em seguida, o tutorial do power-up relacionado (se o jogador ainda nao o conhece).
        if (chain && next !== null && this.canStartGuide(next, true)) this.startGuide(next);
    }

    /** Presenteia 1 unidade, para o tempo, escurece a tela e aponta o botao: o jogador precisa usa-lo agora. */
    private startGuide(type: PowerupType) {
        const gm = GameManager.instance, pm = PowerupManager.instance;
        const slot = pm?.slotNode(type);
        if (!gm || !pm || !slot) return;

        this.guideType = type;
        this.guideStartedAt = performance.now();
        PowerupInventory.add(type, 1);
        gm.timeHeld = true;
        pm.forcedType = type;
        SoundManager.playTutorialStep();

        // Fundo escuro que captura os toques do tabuleiro; a barra de power-ups fica acima dele (so o botao certo funciona).
        this.showFade(true);
        this.fadeNode?.targetOff(this);
        this.fadeNode?.on(Node.EventType.TOUCH_END, this.swallowTouch, this);
        this.highlight([slot]);

        this.showCaption(this.guideTexts[type] || 'Tap the highlighted power-up!', this.capPos('powerups', new Vec3(0, -120, 0)), false);
        if (this.tutorialIndicator) {
            if (!this.handRaised) {
                this.handRaised = true;
                this.tutorialIndicator.getComponentsInChildren(Sorting2D).forEach(sp => {
                    sp.sortingOrder = TutorialManager.UI_ORDER + 50 + sp.sortingOrder;
                });
            }
            this.tutorialIndicator.active = true;
            this.tutorialIndicator.setWorldPosition(slot.worldPosition);
        }
    }

    private swallowTouch() { /* so bloqueia o tabuleiro */ }

    private finishGuide() {
        const type = this.guideType;
        if (type === null) return;
        this.guideType = null;
        this.lastGuideEnd = performance.now();
        this.idleTime = 0;
        PowerupInventory.markSeen(type); // nunca mais repete, usado ou nao
        const gm = GameManager.instance, pm = PowerupManager.instance;
        if (gm) gm.timeHeld = false;
        if (pm) pm.forcedType = null;
        this.fadeNode?.targetOff(this);
        this.showFade(false);
        this.clearHighlight();
        if (this.captionRoot) this.captionRoot.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
    }

    // ---------- Dica: remover um item selecionado ----------

    private hintSeen(): boolean {
        try { return !!sys.localStorage.getItem(TutorialManager.REMOVE_HINT_KEY); } catch (e) { return false; }
    }

    /**
     * Primeiro Golden Time: aviso de que todo alimento virou moeda e que e para pegar o maximo possivel.
     * Para o tempo ate o toque e entao chama `done` (que comeca a contagem do Golden Time). Aparece 1x.
     */
    public showGoldenIntro(done: () => void) {
        const gm = GameManager.instance;
        if (!gm || this.flagSet(TutorialManager.FLAG_GOLDEN) || this.focusKind) { done(); return; }
        this.setFlag(TutorialManager.FLAG_GOLDEN);
        if (this.hintElement) this.endHint();
        this.focusKind = 'golden';
        this.focusChain = null;
        this.goldenDone = done;
        gm.timeHeld = true;
        SoundManager.playTutorialStep();
        this.showFade(true);
        this.fadeNode?.targetOff(this);
        this.fadeNode?.on(Node.EventType.TOUCH_END, this.onFocusTap, this);
        this.showCaption('GOLDEN TIME!\nEvery food is a COIN now!\nTap as many as you can!', this.capPos('orders', new Vec3(95, 120, 0)), true);
        this.canTap = false;
        this.scheduleOnce(() => { this.canTap = true; }, this.tapDelay);
    }

    /** Algum tutorial/dica esta na tela agora? (o Golden Time nao comeca por cima dele) */
    public isBusy(): boolean {
        return !!this.focusKind || this.guideType !== null || !!this.hintElement || this.introStep !== 0;
    }

    /** Itens errados (que nenhum pedido pede) parados na prateleira agora. */
    private wrongInTray(): MatchElement[] {
        const orders = OrderManager.instance, mc = this.matchController;
        if (!orders || !mc) return [];
        return mc.selectedElements.filter(e => e.isValid && e.hasReachedSlot && !mc.isInPendingMerge(e) && orders.NextQuantityFor(e.type) === 0);
    }

    /** Mais de 1 item errado na prateleira (primeira vez): reforca o pedido atual e destaca os alimentos certos. */
    private tryWrongManyTutorial(): boolean {
        const gm = GameManager.instance, orders = OrderManager.instance;
        if (!gm || !orders || !gm.IsRunning() || this.focusKind || this.guideType !== null || GoldenTime.active) return false;
        if (this.flagSet(TutorialManager.FLAG_WRONG) || this.wrongInTray().length < 2) return false;
        const line = orders.GetNextPendingLine();
        if (!line) return false;

        const mc = this.matchController;
        const board = this.initializer ? this.initializer.node.getComponentsInChildren(MatchElement) : [];
        const picks = board.filter(e => e.isValid && e.isAvailable && e.type === line.type && (!mc || mc.selectedElements.indexOf(e) === -1))
            .slice(0, line.quantity);
        if (picks.length === 0) return false;

        this.setFlag(TutorialManager.FLAG_WRONG);
        if (this.hintElement) this.endHint();
        this.focusKind = 'wrong';
        this.focusChain = null;
        gm.timeHeld = true;
        SoundManager.playTutorialStep();
        this.showFade(true);
        this.fadeNode?.targetOff(this);
        this.fadeNode?.on(Node.EventType.TOUCH_END, this.onFocusTap, this);
        this.highlight([orders.node, ...picks.map(e => e.node)]);
        const name = ElementCatalog.getDef(line.type).name;
        this.showCaption(tr('Those foods are not in your orders!\nYour first order needs {0}x {1}.\nPick the highlighted ones.', line.quantity, tr(name)),
            this.capPos('orders', new Vec3(95, 120, 0)), true);
        if (this.tutorialIndicator) {
            if (!this.handRaised) {
                this.handRaised = true;
                this.tutorialIndicator.getComponentsInChildren(Sorting2D).forEach(sp => {
                    sp.sortingOrder = TutorialManager.UI_ORDER + 50 + sp.sortingOrder;
                });
            }
            this.tutorialIndicator.active = true;
            this.tutorialIndicator.setWorldPosition(picks[0].node.worldPosition);
        }
        this.canTap = false;
        this.scheduleOnce(() => { this.canTap = true; }, this.tapDelay);
        return true;
    }

    private onWrongSelected(element: MatchElement) {
        if (this.tryWrongManyTutorial()) return;
        // So uma vez na vida, fora do tutorial guiado, e sem outra dica em andamento.
        if (this.hintElement || this.focusKind || this.guideType !== null || GoldenTime.active || this.hintSeen()) return;
        if (!element || !element.isValid || element.isAvailable || !element.hasReachedSlot) return;
        try { sys.localStorage.setItem(TutorialManager.REMOVE_HINT_KEY, '1'); } catch (e) { }

        this.hintElement = element;
        this.hintUntil = performance.now() + TutorialManager.REMOVE_HINT_MS;
        SoundManager.playTutorialStep();

        // Legenda ao lado do item (paisagem: a esquerda da coluna da prateleira; retrato: acima da fileira).
        const local = new Vec3();
        this.node.inverseTransformPoint(local, element.node.worldPosition);
        const pos = Responsive.portrait
            ? new Vec3(0, local.y + 170, 0)
            : new Vec3(Math.max(-420, local.x - 330), Math.max(-130, Math.min(230, local.y)), 0);
        this.showCaption('Wrong food?\nTap it in the tray to put it back!', pos, false);

        if (this.tutorialIndicator) {
            if (!this.handRaised) {
                this.handRaised = true;
                this.tutorialIndicator.getComponentsInChildren(Sorting2D).forEach(s => {
                    s.sortingOrder = TutorialManager.UI_ORDER + 50 + s.sortingOrder;
                });
            }
            this.tutorialIndicator.active = true;
            this.tutorialIndicator.setWorldPosition(element.node.worldPosition);
        }
    }

    private updateHint() {
        const el = this.hintElement;
        const gm = GameManager.instance;
        const over = !el || !el.isValid || !el.node || !el.node.isValid || el.isAvailable
            || !gm || !gm.IsRunning() || performance.now() > this.hintUntil;
        if (over) { this.endHint(); return; }
        if (this.tutorialIndicator) this.tutorialIndicator.setWorldPosition(el!.node.worldPosition);
    }

    private endHint() {
        this.hintElement = null;
        if (this.captionRoot) this.captionRoot.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
    }

    protected update(dt: number) {
        if (this.hintElement) this.updateHint();
        this.updateGuides(dt);
        this.updateIntro();
    }

    // ---------- Posicao da legenda ----------

    /** Posicao da legenda: em paisagem a posicao do editor; em retrato, junto ao elemento destacado. */
    private capPos(kind: 'timer' | 'orders' | 'powerups' | 'click', land: Vec3): Vec3 {
        if (!Responsive.portrait) return land;
        const m = Responsive.portraitMetrics();
        switch (kind) {
            case 'timer': return new Vec3(0, m.timerBarY - 120, 0);
            case 'orders': return new Vec3(0, m.ordersTop - m.ordersH - 95, 0);
            case 'powerups': return new Vec3(0, m.barY + 150, 0);
            default: return new Vec3(0, m.comboY, 0);
        }
    }

    // ---------- Visual ----------

    private showFade(on: boolean) {
        const fade = this.fadeNode;
        if (!fade) return;
        fade.active = on;
        if (on) {
            const sorting = fade.getComponent(Sorting2D);
            if (sorting) sorting.sortingOrder = TutorialManager.FADE_ORDER;
            const sprite = fade.getComponent(Sprite);
            if (sprite) sprite.color = new Color(0, 0, 0, this.fadeOpacity);
        }
    }

    private highlight(nodes: Node[]) {
        this.clearHighlight();
        for (const node of nodes) {
            if (!node || !node.isValid) continue;
            node.getComponentsInChildren(Sorting2D).forEach(s => {
                this.raised.push({ sorting: s, original: s.sortingOrder });
                s.sortingOrder = s.sortingOrder + TutorialManager.HIGHLIGHT_OFFSET;
            });
        }
    }

    private clearHighlight() {
        for (const r of this.raised) {
            if (r.sorting && r.sorting.isValid) r.sorting.sortingOrder = r.original;
        }
        this.raised = [];
    }

    private get font(): Font | null {
        return OrderManager.instance ? OrderManager.instance.font : null;
    }

    private makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private makePanel(parent: Node, x: number, y: number, w: number, h: number, order: number, color: Color): Node {
        const node = this.makeNode('Panel', parent, x, y, w, h);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SLICED;
        const frame: SpriteFrame | null = this.panelFrame || (OrderManager.instance ? OrderManager.instance.cardBackground : null);
        if (frame) {
            if (frame.insetLeft === 0) { frame.insetLeft = frame.insetRight = frame.insetTop = frame.insetBottom = 24; }
            sprite.spriteFrame = frame;
        }
        sprite.color = color;
        node.addComponent(Sorting2D).sortingOrder = TutorialManager.UI_ORDER + order;
        return node;
    }

    private makeLabel(parent: Node, text: string, size: number, w: number, h: number, x: number, y: number, order: number,
        color: Color = Color.WHITE, outline: Color = new Color(10, 20, 40, 255)): Label {
        const n = this.makeNode('Text', parent, x, y, w, h);
        const label = n.addComponent(Label);
        // SHRINK antes do texto: com o overflow padrao o Label redimensiona o no para o tamanho do texto.
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = true;
        if (this.font) {
            label.useSystemFont = false;
            label.font = this.font;
        }
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 6;
        label.color = color;
        label.isBold = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 10));
        n.getComponent(UITransform)!.setContentSize(w, h);
        n.addComponent(Sorting2D).sortingOrder = TutorialManager.UI_ORDER + order;
        return label;
    }

    /** Caixa de texto do tutorial, com "Touch to continue" quando o passo avanca por toque. */
    private showCaption(text: string, position: Vec3, withContinue: boolean, scale: number = 1) {
        text = tr(text);
        if (!this.captionRoot) {
            const root = this.makeNode('Caption', this.node, 0, 0, 500, 170);
            this.makePanel(root, 0, 0, 500, 170, 0, new Color(25, 30, 60, 240));
            this.captionLabel = this.makeLabel(root, '', 30, 450, 100, 0, 22, 1);
            const cont = this.makeLabel(root, tr(this.continueText), 26, 300, 36, 0, -58, 1, new Color(255, 214, 51, 255), new Color(60, 40, 0, 255));
            this.continueLabel = cont.node;
            this.captionRoot = root;
        }
        const root = this.captionRoot;
        root.active = true;
        root.setPosition(position);
        this.captionLabel!.string = text;
        this.continueLabel!.active = withContinue;

        root.getComponent(UIOpacity)?.destroy();
        root.setScale(0.7 * scale, 0.7 * scale, 1);
        Tween.stopAllByTarget(root);
        tween(root).to(0.22, { scale: new Vec3(scale, scale, 1) }, { easing: 'backOut' }).start();

        // "Touch to continue" pulsa para chamar a atencao.
        Tween.stopAllByTarget(this.continueLabel!);
        this.continueLabel!.setScale(1, 1, 1);
        if (withContinue) {
            tween(this.continueLabel!)
                .to(0.6, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineInOut' })
                .to(0.6, { scale: Vec3.ONE }, { easing: 'sineInOut' })
                .union()
                .repeatForever()
                .start();
        }
    }
}
