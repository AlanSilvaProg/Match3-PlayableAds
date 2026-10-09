import { SoundManager } from './SoundManager';
import { _decorator, Component, Node, Vec3, Color, Sprite, SpriteFrame, Label, Font, UITransform, Sorting2D, tween, Tween, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

import { MatchController } from './MatchController';
import { MatchElement } from './MatchElement';
import { MatchInitializer } from './MatchInitializer';
import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { OrderManager } from './OrderManager';
import { ComboManager } from './ComboManager';
import { PowerupManager } from './PowerupManager';
import { RankingManager } from './RankingManager';
import { GameManager } from './GameManager';

enum TutorialStep {
    None,
    Timer,
    Combo,
    Orders,
    Powerups,
    Click,
    TimeRules,
    Done,
}

/**
 * Tutorial da primeira sessao (cache local, veja GameManager.BeginPlay):
 * 1) timer  2) combo  3) pedidos  4) clique guiado ate entregar o 1o pedido  5) regras de atraso/ganho de tempo.
 * Os passos 1, 2, 3 e 5 avancam com um toque; no passo 4 so os alimentos do 1o pedido aceitam clique.
 * O tempo so comeca a correr quando o tutorial termina.
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

    @property({ tooltip: 'Segundos ate um toque poder avancar o passo (evita pulos acidentais).' })
    public tapDelay: number = 0.35;

    private static readonly FADE_ORDER = 90;
    private static readonly HIGHLIGHT_OFFSET = 100;
    private static readonly UI_ORDER = 300;

    private step: TutorialStep = TutorialStep.None;
    private canTap: boolean = false;
    private raised: { sorting: Sorting2D, original: number }[] = [];
    private captionRoot: Node | null = null;
    private captionLabel: Label | null = null;
    private continueLabel: Node | null = null;
    private rulesRoot: Node | null = null;
    private whitelist: MatchElement[] = [];
    private skipButton: Node | null = null;

    protected start() {
        if (this.fadeNode) this.fadeNode.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;

        // O tutorial so comeca no primeiro Play do jogador (veja GameManager.BeginPlay).
        GameManager.instance?.events.on(GameManager.EVENT_PLAY, this.onPlay, this);
        GameManager.instance?.events.on(GameManager.EVENT_ORDER_DELIVERED, this.onOrderDelivered, this);
    }

    protected onDestroy() {
        const events = GameManager.instance?.events;
        events?.off(GameManager.EVENT_PLAY, this.onPlay, this);
        events?.off(GameManager.EVENT_ORDER_DELIVERED, this.onOrderDelivered, this);
        // Na troca de cena o no do fade pode ja ter sido destruido.
        if (this.fadeNode && this.fadeNode.isValid) this.fadeNode.off(Node.EventType.TOUCH_END, this.onTap, this);
        if (GameManager.instance) GameManager.instance.tutorialAllowed = null;
    }

    private onPlay(firstTime: boolean) {
        if (!firstTime || this.step !== TutorialStep.None) return;
        // Aguarda o tabuleiro e o primeiro pedido serem criados.
        this.scheduleOnce(() => this.goTo(TutorialStep.Timer), 0.4);
    }

    protected update() {
        // A mao segue o proximo alimento a clicar.
        if (this.step !== TutorialStep.Click || !this.tutorialIndicator) return;
        const selected = this.matchController ? this.matchController.selectedElements : [];
        const next = this.whitelist.find(el => el.isValid && el.node && el.isAvailable && selected.indexOf(el) === -1);
        if (next) {
            this.tutorialIndicator.active = true;
            this.tutorialIndicator.setWorldPosition(next.node.worldPosition);
        } else {
            this.tutorialIndicator.active = false;
        }
    }

    // ---------- Fluxo ----------

    private goTo(step: TutorialStep) {
        // Som a cada passo que avanca (o primeiro passo, que so aparece, nao conta).
        if (this.step !== TutorialStep.None) SoundManager.playTutorialStep();
        this.ensureSkipButton();
        this.clearHighlight();
        this.step = step;
        this.canTap = false;
        if (this.rulesRoot) this.rulesRoot.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
        if (GameManager.instance) GameManager.instance.tutorialAllowed = null;
        if (PowerupManager.instance) PowerupManager.instance.tutorialBarVisible = false;

        this.showFade(true);

        switch (step) {
            case TutorialStep.Timer: {
                const gm = GameManager.instance;
                const nodes: Node[] = [];
                if (gm?.timerLabel) nodes.push(gm.timerLabel.node);
                if (gm?.timerBar?.node.parent) nodes.push(gm.timerBar.node.parent);
                this.highlight(nodes);
                this.showCaption('This is your TIME!\nDon\'t let it hit zero.', new Vec3(60, 40, 0), true);
                break;
            }
            case TutorialStep.Combo:
                if (ComboManager.instance) this.highlight([ComboManager.instance.node]);
                this.showCaption('Merge fast for COMBOS!\nBigger combo = more coins.', new Vec3(60, -110, 0), true);
                break;
            case TutorialStep.Orders:
                if (OrderManager.instance) this.highlight([OrderManager.instance.node]);
                this.showCaption('These are your ORDERS!\nCollect the exact amount before time runs out.', new Vec3(95, 120, 0), true);
                break;
            case TutorialStep.Powerups:
                if (PowerupManager.instance) {
                    PowerupManager.instance.tutorialBarVisible = true;
                    this.highlight([PowerupManager.instance.barNode!]);
                }
                this.showCaption('These are POWER-UPS!\nHover or hold one to see what it does.', new Vec3(100, -10, 0), true);
                break;
            case TutorialStep.Click:
                this.startClickStep();
                break;
            case TutorialStep.TimeRules:
                this.showTimeRules();
                break;
            case TutorialStep.Done:
                this.finish();
                break;
        }

        // Passos por toque: o fundo escuro captura o toque (e bloqueia o tabuleiro). No passo guiado ele fica sem
        // listener, deixando os cliques passarem para os alimentos liberados.
        const tapStep = step === TutorialStep.Timer || step === TutorialStep.Combo || step === TutorialStep.Orders
            || step === TutorialStep.Powerups || step === TutorialStep.TimeRules;
        this.fadeNode?.off(Node.EventType.TOUCH_END, this.onTap, this);
        if (tapStep) this.fadeNode?.on(Node.EventType.TOUCH_END, this.onTap, this);
        if (tapStep) {
            this.scheduleOnce(() => { this.canTap = true; }, this.tapDelay);
        }
    }

    private onTap() {
        if (!this.canTap) return;
        switch (this.step) {
            case TutorialStep.Timer: this.goTo(TutorialStep.Combo); break;
            case TutorialStep.Combo: this.goTo(TutorialStep.Orders); break;
            case TutorialStep.Orders: this.goTo(TutorialStep.Powerups); break;
            case TutorialStep.Powerups: this.goTo(TutorialStep.Click); break;
            case TutorialStep.TimeRules: this.goTo(TutorialStep.Done); break;
        }
    }

    private onOrderDelivered() {
        // O 1o pedido foi entregue: libera o passo final.
        if (this.step === TutorialStep.Click) {
            this.scheduleOnce(() => this.goTo(TutorialStep.TimeRules), 0.9);
        }
    }

    /** Botao no canto superior direito para pular todo o tutorial. */
    private ensureSkipButton() {
        if (!this.skipButton) {
            const w = 150, h = 56;
            const node = this.makeNode('SkipButton', this.node, 540, 318, w, h);
            const sprite = this.makePanelSprite(node, new Color(255, 140, 40, 255));
            sprite.node.getComponent(Sorting2D)!.sortingOrder = TutorialManager.UI_ORDER + 60;
            this.makeLabel(node, 'SKIP', 32, w - 16, h - 10, 0, 2, 61);
            node.on(Node.EventType.TOUCH_END, () => { SoundManager.playMenuClick(); this.skip(); });
            this.skipButton = node;
        }
        this.skipButton.active = true;
        this.skipButton.setSiblingIndex(this.node.children.length - 1);
    }

    private makePanelSprite(node: Node, color: Color): Sprite {
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SLICED;
        const frame: SpriteFrame | null = this.panelFrame || (OrderManager.instance ? OrderManager.instance.cardBackground : null);
        if (frame) {
            if (frame.insetLeft === 0) { frame.insetLeft = frame.insetRight = frame.insetTop = frame.insetBottom = 24; }
            sprite.spriteFrame = frame;
        }
        sprite.color = color;
        node.addComponent(Sorting2D);
        return sprite;
    }

    /** Pula o tutorial inteiro e libera o jogo. */
    private skip() {
        if (this.step === TutorialStep.None || this.step === TutorialStep.Done) return;
        this.unscheduleAllCallbacks();
        this.clearHighlight();
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;
        this.step = TutorialStep.Done;
        this.finish();
    }

    private finish() {
        if (PowerupManager.instance) PowerupManager.instance.tutorialBarVisible = false;
        if (this.skipButton) this.skipButton.active = false;
        this.fadeNode?.off(Node.EventType.TOUCH_END, this.onTap, this);
        this.showFade(false);
        if (this.captionRoot) this.captionRoot.active = false;
        if (this.rulesRoot) this.rulesRoot.active = false;
        this.whitelist = [];
        const gm = GameManager.instance;
        if (!gm) return;
        gm.tutorialAllowed = null;

        // Depois do tutorial: apelido (e login da Poki, se disponivel) antes do cronometro comecar a correr.
        const ranking = RankingManager.instance;
        if (ranking && ranking.NeedsProfile()) {
            ranking.PromptProfile(() => GameManager.instance?.StartGame());
        } else {
            gm.StartGame();
        }
    }

    // ---------- Passo 4: clique guiado ----------

    private startClickStep() {
        // Fade visivel mas sem capturar toques: os cliques chegam aos alimentos liberados.
        if (this.fadeNode) this.fadeNode.active = true;

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

        // Alimentos liberados e o painel de pedidos ficam acima do fundo escuro.
        const nodes: Node[] = this.whitelist.map(el => el.node);
        if (OrderManager.instance) nodes.push(OrderManager.instance.node);
        this.highlight(nodes);

        if (this.tutorialIndicator) {
            this.tutorialIndicator.getComponentsInChildren(Sorting2D).forEach(s => {
                s.sortingOrder = TutorialManager.UI_ORDER + 50 + s.sortingOrder;
            });
        }
        this.showCaption('Tap the highlighted foods!', new Vec3(95, -300, 0), false);
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
    private showCaption(text: string, position: Vec3, withContinue: boolean) {
        if (!this.captionRoot) {
            const root = this.makeNode('Caption', this.node, 0, 0, 500, 170);
            this.makePanel(root, 0, 0, 500, 170, 0, new Color(25, 30, 60, 240));
            this.captionLabel = this.makeLabel(root, '', 30, 450, 100, 0, 22, 1);
            const cont = this.makeLabel(root, this.continueText, 26, 300, 36, 0, -58, 1, new Color(255, 214, 51, 255), new Color(60, 40, 0, 255));
            this.continueLabel = cont.node;
            this.captionRoot = root;
        }
        const root = this.captionRoot;
        root.active = true;
        root.setPosition(position);
        this.captionLabel!.string = text;
        this.continueLabel!.active = withContinue;

        root.getComponent(UIOpacity)?.destroy();
        root.setScale(0.7, 0.7, 1);
        Tween.stopAllByTarget(root);
        tween(root).to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' }).start();

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

    /** Passo final: centralizado, com imagens, texto e fundo escurecido, explica ganho e atraso de tempo. */
    private showTimeRules() {
        if (this.captionRoot) this.captionRoot.active = false;

        if (!this.rulesRoot) {
            const root = this.makeNode('TimeRules', this.node, 0, 0, 820, 430);
            this.makePanel(root, 0, 0, 820, 430, 0, new Color(25, 30, 60, 245));
            this.makeLabel(root, 'DELIVERY TIME', 46, 600, 60, 0, 165, 1, Color.WHITE, new Color(20, 70, 120, 255));

            const type = OrderManager.instance?.GetFirstOrderLines()[0]?.type ?? ElementType.Fries;
            const good = new Color(70, 255, 100, 255);
            const bad = new Color(255, 80, 70, 255);
            this.buildRule(root, 65, type, good, new Color(10, 70, 20, 255), '0:12', '+0:05',
                'On time: leftover time is ADDED!');
            this.buildRule(root, -65, type, bad, new Color(80, 0, 0, 255), '-0:04', '-0:04',
                'Too late: the delay is SUBTRACTED!');

            const cont = this.makeLabel(root, this.continueText, 28, 360, 40, 0, -170, 1, new Color(255, 214, 51, 255), new Color(60, 40, 0, 255));
            tween(cont.node)
                .to(0.6, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineInOut' })
                .to(0.6, { scale: Vec3.ONE }, { easing: 'sineInOut' })
                .union()
                .repeatForever()
                .start();
            this.rulesRoot = root;
        }
        this.rulesRoot.active = true;
        this.rulesRoot.setScale(0.7, 0.7, 1);
        Tween.stopAllByTarget(this.rulesRoot);
        tween(this.rulesRoot).to(0.25, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    }

    /** Uma linha de regra: mini cartao de pedido, resultado no tempo e explicacao. */
    private buildRule(root: Node, y: number, type: ElementType, color: Color, outline: Color, cardTime: string, delta: string, text: string) {
        const card = this.makePanel(root, -300, y, 120, 100, 1, new Color(55, 65, 115, 255));
        this.makeLabel(card, cardTime, 28, 100, 30, 0, 30, 2, color, outline);
        const iconNode = this.makeNode('Icon', card, 0, -14, 52, 52);
        const sprite = iconNode.addComponent(Sprite);
        ElementCatalog.applyFitted(sprite, type, 50);
        iconNode.addComponent(Sorting2D).sortingOrder = TutorialManager.UI_ORDER + 2;

        this.makeLabel(root, delta, 52, 170, 64, -165, y, 2, color, outline);
        this.makeLabel(root, text, 24, 400, 100, 150, y, 2, Color.WHITE);
    }
}
