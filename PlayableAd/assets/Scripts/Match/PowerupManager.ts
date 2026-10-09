import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Font, UITransform, Vec3, Color, Sorting2D, tween, Tween, Prefab, instantiate } from 'cc';
const { ccclass, property } = _decorator;

import { PowerupType, PowerupCatalog } from './PowerupCatalog';
import { PowerupInventory, PlayerWallet } from './PlayerInventory';
import { PokiService } from './PokiService';
import { GameManager } from './GameManager';
import { OrderManager } from './OrderManager';
import { ComboManager } from './ComboManager';
import { MatchController } from './MatchController';
import { MatchElement } from './MatchElement';
import { CoinsHolderView } from './CoinsHolderView';
import { PlayerStats, AchievementMetric } from './PlayerStats';

interface PowerupSlotView {
    type: PowerupType;
    node: Node;
    icon: Sprite;
    countLabel: Label;
    timerLabel: Label;
}

/**
 * Power-ups: barra usada durante a partida, janela de inventario (menu principal e selecao de niveis) com compra
 * por pontos / anuncio com recompensa, e os efeitos de cada power-up.
 */
@ccclass('PowerupManager')
export class PowerupManager extends Component {

    public static instance: PowerupManager = null!;

    // ---------- Assets ----------
    @property({ type: SpriteFrame, tooltip: 'powerups-sheet.png inteiro (os icones sao recortados dele).' })
    public sheetFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'powerup-button-holder.' })
    public holderFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'power-ups-window (nine slice definido no import).' })
    public windowFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Botao verde (mesmo da tela de vitoria), usado em Buy / Free / fechar.' })
    public buttonFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'points-holder (nine slice): fundo de todo exibidor de pontos.' })
    public pointsFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'moeda-de-dolar: icone dos pontos.' })
    public coinFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'moeda-de-dolar-group: icone que indica premios e precos em coins.' })
    public coinGroupFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'play: icone que indica recompensa por anuncio (no lugar do texto AD).' })
    public adFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'powerup-icon: icone geral dos power-ups (botao que abre o inventario).' })
    public powerupIcon: SpriteFrame | null = null;

    @property({ type: Prefab, tooltip: 'Prefab CoinsHolder: exibidor de coins (ajuste tamanhos e posicoes no prefab).' })
    public coinsHolderPrefab: Prefab | null = null;

    @property({ type: SpriteFrame, tooltip: 'Sprite preto usado para escurecer o fundo da janela.' })
    public dimFrame: SpriteFrame | null = null;

    @property({ type: Font, tooltip: 'Fonte dos textos.' })
    public font: Font | null = null;

    @property({ tooltip: 'Coins ganhos ao assistir o anuncio ao lado do saldo.' })
    public coinAdReward: number = 5000;

    @property({ type: SpriteFrame, tooltip: 'Botao dos anuncios com recompensa: a Poki proibe verde (use o botao vermelho).' })
    public adButtonFrame: SpriteFrame | null = null;

    @property({ type: Prefab, tooltip: 'Efeito de brilho ao ativar um power-up (MergeEffect).' })
    public activateEffectPrefab: Prefab | null = null;

    // ---------- Referencias da cena ----------
    @property(MatchController)
    public matchController: MatchController = null!;

    @property({ type: Node, tooltip: 'Container dos itens do tabuleiro (MatchSpace).' })
    public matchSpace: Node | null = null;

    // ---------- Layout ----------
    @property({ tooltip: 'Posicao vertical da barra de power-ups durante a partida.' })
    public barY: number = -283;

    @property({ tooltip: 'Posicao horizontal central da barra de power-ups.' })
    public barX: number = 100;

    @property({ tooltip: 'Tamanho (px) de cada botao da barra.' })
    public barButtonSize: number = 74;

    @property({ tooltip: 'Sorting order base da janela de power-ups (acima de todo o resto).' })
    public windowSortingBase: number = 400;

    private bar: Node | null = null;
    private slots: PowerupSlotView[] = [];
    private windowRoot: Node | null = null;
    private windowRefresh: (() => void) | null = null;
    private badges: { label: Label }[] = [];
    private remaining: number[] = [];
    private highlightRemaining: number = 0;
    private highlightTick: number = 0;
    private highlighted: MatchElement[] = [];
    private toast: Node | null = null;
    private clock: number = 0;
    private adBusy: boolean = false;
    private tooltip: Node | null = null;
    private tooltipName: Label | null = null;
    private tooltipText: Label | null = null;
    private tooltipFor: Node | null = null;
    private longPressShown: boolean = false;

    /** O tutorial mostra a barra de power-ups mesmo fora da partida. */
    public tutorialBarVisible: boolean = false;

    public get barNode(): Node | null { return this.bar; }
    private scoreHolder: Node | null = null;
    private coinTarget: Node | null = null;
    private lastCoinPunch: number = 0;

    protected onLoad() {
        PowerupManager.instance = this;
        PowerupCatalog.init(this.sheetFrame);
        this.remaining = PowerupCatalog.defs.map(() => 0);
    }

    protected onDestroy() {
        if (PowerupManager.instance === this) PowerupManager.instance = null!;
        GameManager.instance?.events?.off(GameManager.EVENT_REVIVED, this.onRevived, this);
    }

    protected start() {
        this.buildBar();
        this.wrapScoreLabel();
        GameManager.instance?.events.on(GameManager.EVENT_REVIVED, this.onRevived, this);
    }

    protected update(dt: number) {
        this.clock += dt;
        const gm = GameManager.instance;

        // A barra so aparece com a partida em andamento (nao no menu, no tutorial nem nas telas de fim).
        if (this.bar) this.bar.active = (!!gm && gm.IsRunning()) || this.tutorialBarVisible;

        // Tempos restantes dos efeitos ativos (para o contador nos botoes).
        const r = this.remaining;
        r[PowerupType.FreezeTimer] = gm ? gm.timerFrozenSecondsLeft : 0;
        r[PowerupType.FreezeOrders] = OrderManager.instance ? OrderManager.instance.frozenSecondsLeft : 0;
        r[PowerupType.MaxCombo] = ComboManager.instance ? ComboManager.instance.maxComboSecondsLeft : 0;
        r[PowerupType.DoublePoints] = ComboManager.instance ? ComboManager.instance.scoreMultiplierSecondsLeft : 0;

        if (this.highlightRemaining > 0) {
            this.highlightRemaining = Math.max(0, this.highlightRemaining - dt);
            this.highlightTick -= dt;
            if (this.highlightTick <= 0) {
                this.highlightTick = 0.4;
                this.applyHighlight();
            }
            if (this.highlightRemaining === 0) this.clearHighlight();
        }
        r[PowerupType.Highlight] = this.highlightRemaining;

        if (this.bar && this.bar.active) this.refreshBar();
    }

    // ---------- Uso durante a partida ----------

    public secondsLeft(type: PowerupType): number {
        return this.remaining[type] || 0;
    }

    /** Usa 1 unidade do power-up. Retorna true se o efeito foi aplicado. */
    public Use(type: PowerupType, fromNode?: Node): boolean {
        const gm = GameManager.instance;
        if (!gm || !gm.IsRunning()) return false;
        if (PowerupInventory.getCount(type) <= 0) {
            this.shake(fromNode);
            return false;
        }
        if (this.secondsLeft(type) > 0) {
            this.shake(fromNode);
            return false;
        }

        const def = PowerupCatalog.getDef(type);
        let ok = false;
        switch (type) {
            case PowerupType.FreezeTimer:
                gm.FreezeTimer(def.seconds);
                ok = true;
                break;
            case PowerupType.FreezeOrders:
                if (OrderManager.instance) { OrderManager.instance.FreezeOrders(def.seconds); ok = true; }
                break;
            case PowerupType.TimeBonus:
                gm.AddTime(def.seconds, fromNode ? fromNode.worldPosition : undefined);
                ok = true;
                break;
            case PowerupType.ReduceQuantity:
                ok = !!OrderManager.instance && OrderManager.instance.ReduceQuantities();
                break;
            case PowerupType.AutoSelect:
                ok = this.autoSelect();
                break;
            case PowerupType.Highlight:
                this.highlightRemaining = def.seconds;
                this.highlightTick = 0;
                ok = true;
                break;
            case PowerupType.MaxCombo:
                if (ComboManager.instance) { ComboManager.instance.ForceMax(def.seconds); ok = true; }
                break;
            case PowerupType.DoublePoints:
                if (ComboManager.instance) { ComboManager.instance.SetScoreMultiplier(2, def.seconds); ok = true; }
                break;
        }

        if (!ok) {
            this.shake(fromNode);
            this.showToast('Nothing to use it on right now');
            return false;
        }

        PowerupInventory.consume(type);
        PlayerStats.increment(AchievementMetric.PowerupsUsed);
        this.showToast(def.name);
        this.playActivateEffect(fromNode);
        this.refreshBar();
        return true;
    }

    /** Seleciona sozinho os alimentos que faltam para o proximo pedido. */
    private autoSelect(): boolean {
        const line = OrderManager.instance?.GetNextPendingLine();
        const space = this.matchSpace;
        if (!line || !space || !this.matchController) return false;

        const have = this.matchController.selectedElements.filter(e => e.type === line.type).length;
        const need = Math.max(0, line.quantity - have);
        const candidates = space.getComponentsInChildren(MatchElement).filter(e => e.isAvailable && e.type === line.type);
        const picks = candidates.slice(0, need);
        if (picks.length === 0) return false;

        picks.forEach((el, i) => {
            this.scheduleOnce(() => {
                if (el.isValid && el.node && el.isAvailable) el.OnClick();
            }, i * 0.2);
        });
        return true;
    }

    /** Power-up Focus: escurece os itens que nao servem e faz pulsar os do proximo pedido. */
    private applyHighlight() {
        const space = this.matchSpace;
        if (!space) return;
        const line = OrderManager.instance?.GetNextPendingLine();
        this.clearHighlight();
        if (!line) return;

        space.getComponentsInChildren(MatchElement).forEach(el => {
            if (!el.isAvailable) return;
            const sprite = el.spriteComponent || el.getComponent(Sprite);
            if (!sprite) return;
            this.highlighted.push(el);
            if (el.type === line.type) {
                sprite.color = Color.WHITE;
                const s = el.availableScale;
                tween(el.node)
                    .to(0.3, { scale: new Vec3(s.x * 1.18, s.y * 1.18, s.z) }, { easing: 'sineInOut' })
                    .to(0.3, { scale: s.clone() }, { easing: 'sineInOut' })
                    .union().repeatForever().start();
            } else {
                sprite.color = new Color(110, 110, 110, 255);
            }
        });
    }

    private clearHighlight() {
        for (const el of this.highlighted) {
            if (!el.isValid || !el.node) continue;
            if (!el.isAvailable) continue; // ja foi para a prateleira: o OnClick limpou
            Tween.stopAllByTarget(el.node);
            el.node.setScale(el.availableScale);
            const sprite = el.spriteComponent || el.getComponent(Sprite);
            if (sprite) sprite.color = Color.WHITE;
        }
        this.highlighted = [];
    }

    private onRevived(count: number) {
        this.showToast(`+${count} random power-ups!`);
        this.refreshBar();
    }

    // ---------- Construcao de UI ----------

    private makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private makeSprite(n: Node, frame: SpriteFrame | null, order: number, sliced: boolean = false): Sprite {
        const sprite = n.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sliced) sprite.type = Sprite.Type.SLICED;
        sprite.spriteFrame = frame;
        n.addComponent(Sorting2D).sortingOrder = order;
        return sprite;
    }

    private makeLabel(parent: Node, text: string, size: number, w: number, h: number, x: number, y: number, order: number,
        color: Color = Color.WHITE, outline: Color = new Color(10, 20, 40, 255)): Label {
        const n = this.makeNode('Text', parent, x, y, w, h);
        const label = n.addComponent(Label);
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        if (this.font) {
            label.useSystemFont = false;
            label.font = this.font;
        }
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.color = color;
        label.isBold = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 10));
        n.getComponent(UITransform)!.setContentSize(w, h);
        n.addComponent(Sorting2D).sortingOrder = order;
        return label;
    }

    /** Botao generico: fundo (botao verde tingido) + texto + toque. */
    private makeButton(parent: Node, text: string, x: number, y: number, w: number, h: number, order: number, tint: Color,
        onTap: () => void, frame: SpriteFrame | null = this.buttonFrame): { node: Node, label: Label, bg: Sprite } {
        const node = this.makeNode('Button', parent, x, y, w, h);
        const bg = this.makeSprite(node, frame, order, true);
        bg.color = tint;
        const label = this.makeLabel(node, text, Math.round(h * 0.5), w - 14, h - 10, 0, 3, order + 1);
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.93, 0.93, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); onTap(); });
        return { node, label, bg };
    }

    // ---------- Barra durante a partida ----------

    private buildBar() {
        const size = this.barButtonSize;
        const gap = 8;
        const count = PowerupCatalog.defs.length;
        const total = count * size + (count - 1) * gap;
        this.bar = this.makeNode('PowerupBar', this.node, this.barX, this.barY, total, size);

        this.slots = PowerupCatalog.defs.map((def, i) => {
            const x = -total / 2 + size / 2 + i * (size + gap);
            const node = this.makeNode(def.name, this.bar!, x, 0, size, size);
            this.makeSprite(node, this.holderFrame, 10);
            const iconNode = this.makeNode('Icon', node, 0, 2, size * 0.7, size * 0.7);
            const icon = iconNode.addComponent(Sprite);
            PowerupCatalog.applyFitted(icon, def.type, size * 0.68);
            iconNode.addComponent(Sorting2D).sortingOrder = 11;

            const countLabel = this.makeLabel(node, 'x0', 22, size * 0.6, 26, size * 0.2, -size * 0.36, 13);
            const timerLabel = this.makeLabel(node, '', 30, size * 0.9, 34, 0, 4, 14, new Color(120, 255, 255, 255));

            this.attachTooltip(node, def.type);
            node.on(Node.EventType.TOUCH_END, () => {
                // Um toque longo so mostra a descricao: nao usa o power-up ao soltar.
                if (this.longPressShown) { this.longPressShown = false; return; }
                this.Use(def.type, node);
            });
            return { type: def.type, node, icon, countLabel, timerLabel };
        });
        this.bar.active = false;
        this.refreshBar();
    }

    private refreshBar() {
        for (const s of this.slots) {
            const count = PowerupInventory.getCount(s.type);
            const left = this.secondsLeft(s.type);
            s.countLabel.string = `x${count}`;
            s.icon.color = count > 0 ? (left > 0 ? new Color(120, 120, 120, 255) : Color.WHITE) : new Color(90, 90, 90, 200);
            s.timerLabel.string = left > 0 ? `${Math.ceil(left)}` : '';
        }
    }

    // ---------- Botao de abrir, contador de pontos e janela ----------

    /** Botao "power-ups" (holder + icone) que abre a janela de inventario. */
    public createOpenButton(parent: Node, x: number, y: number, order: number, size: number = 110): Node {
        const node = this.makeNode('PowerupsButton', parent, x, y, size, size);
        this.makeSprite(node, this.holderFrame, order);
        const iconNode = this.makeNode('Icon', node, 0, 3, size * 0.7, size * 0.7);
        const icon = iconNode.addComponent(Sprite);
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.spriteFrame = this.powerupIcon;
        iconNode.addComponent(Sorting2D).sortingOrder = order + 1;
        this.makeLabel(node, 'POWER-UPS', 16, size + 20, 22, 0, -size * 0.58, order + 2);

        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.92, 0.92, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); this.openWindow(); });
        return node;
    }

    /** Instancia o prefab CoinsHolder (tamanhos e posicoes internas vem do prefab). */
    private spawnCoinsHolder(parent: Node, x: number, y: number, order: number, showHolder: boolean): CoinsHolderView | null {
        if (!this.coinsHolderPrefab) {
            console.warn('[PowerupManager] coinsHolderPrefab nao atribuido.');
            return null;
        }
        const node = instantiate(this.coinsHolderPrefab);
        node.layer = this.node.layer;
        node.parent = parent;
        node.setPosition(x, y, 0);
        const view = node.getComponent(CoinsHolderView);
        if (!view) return null;
        view.setSortingBase(order);
        view.setHolderVisible(showHolder);
        view.setValue(PlayerWallet.getPoints());
        return view;
    }

    /** Contador do saldo de coins do jogador (menu, selecao de niveis e janela de power-ups). */
    public createPointsBadge(parent: Node, x: number, y: number, order: number, showHolder: boolean = true): Node | null {
        return this.createPointsBadgeView(parent, x, y, order, showHolder)?.node ?? null;
    }

    /** Igual a createPointsBadge, mas devolve o CoinsHolderView (texto e moeda) para animar o valor. */
    public createPointsBadgeView(parent: Node, x: number, y: number, order: number, showHolder: boolean = true): CoinsHolderView | null {
        const view = this.spawnCoinsHolder(parent, x, y, order, showHolder);
        if (!view || !view.label) return null;
        this.badges.push({ label: view.label });
        return view;
    }

    /** Troca o texto de pontos da partida (HUD) por uma instancia do prefab CoinsHolder. */
    private wrapScoreLabel() {
        const cm = ComboManager.instance;
        const old = cm ? cm.scoreLabel : null;
        if (!cm || !old || this.scoreHolder) return;
        const parent = old.node.parent;
        if (!parent) return;
        const order = (old.node.getComponent(Sorting2D)?.sortingOrder ?? 2) - 1;
        const pos = old.node.position;

        // Na partida o fundo (holder) fica escondido: so a moeda e o numero.
        const view = this.spawnCoinsHolder(parent, pos.x, pos.y, order, false);
        if (!view || !view.label) return;
        view.setValue(cm.score);
        old.node.active = false;
        cm.scoreLabel = view.label; // o ComboManager passa a escrever o placar no prefab
        this.scoreHolder = view.node;
        this.coinTarget = view.coin;
    }

    /** Chuva de moedas: voam do merge ate o placar de pontos da partida. */
    /** O placar so pode esperar as moedas se existir destino e sprite da moeda. */
    public get canFlyCoins(): boolean {
        return !!this.coinTarget && this.coinTarget.isValid && !!this.coinFrame;
    }

    /**
     * Chuva de moedas do merge ate o placar. `points` e o valor que o placar segurou: cada moeda que chega
     * libera a sua parte, entao o numero do holder sobe so quando as moedas comecam a chegar.
     */
    public FlyCoins(fromWorld: Vec3, count: number, points: number = 0) {
        const target = this.coinTarget;
        if (!target || !target.isValid || !this.coinFrame) {
            if (points > 0) ComboManager.instance?.ReleaseDisplay(points);
            return;
        }
        const base = Math.floor(points / count);
        this.FlyCoinsTo(fromWorld, count, target, i => {
            // Parte fixa por indice (as moedas chegam fora de ordem); a ultima leva o resto do arredondamento.
            const part = i === count - 1 ? points - base * (count - 1) : base;
            if (part > 0) ComboManager.instance?.ReleaseDisplay(part);
            this.punchNode(this.scoreHolder);
        });
    }

    /**
     * Chuva de moedas generica: explodem a partir de `fromWorld` e voam ate `target`. `onArrive(i)` roda quando a
     * moeda de indice `i` chega (use para aumentar o valor exibido aos poucos).
     */
    public FlyCoinsTo(fromWorld: Vec3, count: number, target: Node, onArrive: (index: number) => void) {
        if (!this.coinFrame || !target || !target.isValid) {
            for (let i = 0; i < count; i++) onArrive(i);
            return;
        }
        const targetPos = target.worldPosition.clone();

        for (let i = 0; i < count; i++) {
            const coin = this.makeNode('FlyingCoin', this.node, 0, 0, 38, 38);
            const sprite = coin.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = this.coinFrame;
            sprite.trim = false;
            coin.addComponent(Sorting2D).sortingOrder = this.windowSortingBase + 40;
            coin.setWorldPosition(fromWorld);
            coin.setScale(0.4, 0.4, 1);

            // Explode para os lados e depois acelera ate o destino.
            const burst = new Vec3(fromWorld.x + (Math.random() - 0.5) * 150, fromWorld.y + (Math.random() - 0.3) * 110, 0);
            tween(coin)
                .delay(i * 0.025)
                .parallel(
                    tween().to(0.22, { worldPosition: burst }, { easing: 'quadOut' }),
                    tween().to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }),
                )
                .delay(Math.random() * 0.12)
                .parallel(
                    tween().to(0.5, { worldPosition: targetPos }, { easing: 'quadIn' }),
                    tween().to(0.5, { scale: new Vec3(0.55, 0.55, 1) }),
                )
                .call(() => {
                    coin.destroy();
                    onArrive(i);
                })
                .start();
        }
    }

    /** Pulso curto (com limite de frequencia) num no, usado quando uma moeda chega. */
    public punchNode(node: Node | null) {
        const now = performance.now();
        if (!node || !node.isValid || now - this.lastCoinPunch < 70) return;
        this.lastCoinPunch = now;
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        tween(node).to(0.05, { scale: new Vec3(1.1, 1.1, 1) }).to(0.1, { scale: Vec3.ONE }).start();
    }


    public refreshBadges() {
        const points = `${PlayerWallet.getPoints()}`;
        this.badges = this.badges.filter(b => b.label && b.label.isValid);
        this.badges.forEach(b => { b.label.string = points; });
    }

    public openWindow() {
        if (!this.windowRoot) this.buildWindow();
        const root = this.windowRoot!;
        root.active = true;
        const parent = root.parent;
        if (parent) root.setSiblingIndex(parent.children.length - 1);
        this.windowRefresh?.();
        root.setScale(0.85, 0.85, 1);
        Tween.stopAllByTarget(root);
        tween(root).to(0.2, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    }

    public closeWindow() {
        if (this.windowRoot) this.windowRoot.active = false;
        this.refreshBar();
    }

    private buildWindow() {
        const base = this.windowSortingBase;
        const root = this.makeNode('PowerupWindow', this.node.parent || this.node, 0, 0, 1280, 720);
        this.windowRoot = root;

        // Fundo escuro que absorve os toques.
        const dim = this.makeNode('Dim', root, 0, 0, 1400, 800);
        const dimSprite = this.makeSprite(dim, this.dimFrame, base);
        dimSprite.color = new Color(0, 0, 0, 190);
        dim.on(Node.EventType.TOUCH_END, () => { });

        const W = 1000, H = 600;
        const win = this.makeNode('Window', root, 0, 0, W, H);
        this.makeSprite(win, this.windowFrame, base + 1, true);

        this.makeLabel(win, 'POWER-UPS', 46, 420, 60, 0, H / 2 - 62, base + 3, Color.WHITE, new Color(20, 70, 120, 255));

        // Saldo de pontos (canto superior esquerdo da janela).
        // Na janela de power-ups o fundo (holder) fica escondido: so a moeda e o numero.
        this.createPointsBadge(win, -W / 2 + 190, H / 2 - 62, base + 3, false);

        this.makeButton(win, 'X', W / 2 - 78, H / 2 - 62, 64, 56, base + 3, new Color(255, 120, 120, 255), () => this.closeWindow());


        const cellW = 215, cellH = 205;
        const cols = 4;
        const refreshers: (() => void)[] = [];

        PowerupCatalog.defs.forEach((def, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const cx = (col - (cols - 1) / 2) * cellW;
            const cy = 55 - row * (cellH - 5) - 5;
            const cell = this.makeNode(def.name, win, cx, cy, cellW, cellH);

            const holder = this.makeNode('Holder', cell, 0, 52, 104, 104);
            this.makeSprite(holder, this.holderFrame, base + 3);
            this.attachTooltip(holder, def.type);
            const iconNode = this.makeNode('Icon', holder, 0, 3, 74, 74);
            const icon = iconNode.addComponent(Sprite);
            PowerupCatalog.applyFitted(icon, def.type, 74);
            iconNode.addComponent(Sorting2D).sortingOrder = base + 4;
            const count = this.makeLabel(holder, 'x0', 28, 70, 32, 34, -42, base + 6, Color.WHITE, new Color(20, 20, 50, 255));

            this.makeLabel(cell, def.name, 20, cellW - 16, 26, 0, -14, base + 4, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));

            // Compra com pontos: sem fundo visivel (so a moeda e o preco); a area de toque continua a mesma.
            const buy = this.makeButton(cell, `${def.cost}`, -53, -58, 100, 44, base + 4, Color.WHITE, () => this.buy(def.type), this.pointsFrame);
            // Fundo desligado (nao alpha 0: o alpha do Sprite se propaga aos filhos e apagaria o texto e a moeda).
            buy.bg.enabled = false;
            // Icone da moeda ao lado do preco.
            const buyCoin = this.makeNode('Coin', buy.node, -30, 0, 36, 36);
            const buyCoinSprite = buyCoin.addComponent(Sprite);
            buyCoinSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            buyCoinSprite.spriteFrame = this.coinGroupFrame || this.coinFrame;
            buyCoinSprite.trim = false;
            buyCoin.addComponent(Sorting2D).sortingOrder = base + 6;
            const buyCoinTint = buyCoinSprite;
            buy.label.node.setPosition(14, 2, 0);
            buy.label.node.getComponent(UITransform)!.setContentSize(60, 34);

            const free = this.makeButton(cell, 'FREE', 53, -58, 100, 44, base + 4, new Color(255, 255, 255, 255), () => this.watchAd(def.type, free.node), this.adButtonFrame || this.buttonFrame);
            // Icone de video (play) no lugar do texto "AD".
            const adIcon = this.makeNode('AdIcon', free.node, -25, 0, 28, 28);
            const adSprite = adIcon.addComponent(Sprite);
            adSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            adSprite.spriteFrame = this.adFrame;
            adIcon.addComponent(Sorting2D).sortingOrder = base + 6;
            free.label.node.setPosition(15, 2, 0);
            free.label.node.getComponent(UITransform)!.setContentSize(46, 34);

            refreshers.push(() => {
                count.string = `x${PowerupInventory.getCount(def.type)}`;
                const affordable = PlayerWallet.getPoints() >= def.cost;
                // Sem o fundo, o estado "sem saldo" aparece no preco e na moeda (escurecidos).
                buy.label.color = affordable ? Color.WHITE : new Color(150, 150, 150, 255);
                buyCoinTint.color = affordable ? Color.WHITE : new Color(110, 110, 110, 255);
            });
        });

        this.windowRefresh = () => {
            refreshers.forEach(r => r());
            this.refreshBadges();
        };
        root.active = false;
    }

    private buy(type: PowerupType) {
        const def = PowerupCatalog.getDef(type);
        if (!PlayerWallet.spend(def.cost)) {
            this.showToast('Not enough coins');
            return;
        }
        PowerupInventory.add(type, 1);
        PlayerStats.increment(AchievementMetric.PowerupsBought);
        this.showToast(`+1 ${def.name}`);
        this.windowRefresh?.();
    }

    private watchAd(type: PowerupType, button: Node) {
        if (this.adBusy) return;
        this.adBusy = true;
        PokiService.rewardedBreak().then(ok => {
            this.adBusy = false;
            if (!ok) return; // sem anuncio/recompensa: nada acontece (a Poki cuida da mensagem)
            PowerupInventory.add(type, 1);
            this.showToast(`+1 ${PowerupCatalog.getDef(type).name}`);
            this.windowRefresh?.();
        });
    }

    // ---------- Anuncio de coins (ao lado do saldo) ----------

    /**
     * Botao "assistir anuncio = +coins" ao lado do holder de saldo. Sem cooldown proprio: a frequencia dos anuncios e
     * controlada pela Poki. `holder` e o exibidor de saldo que recebe as moedas.
     */
    public createCoinAdButton(parent: Node, x: number, y: number, order: number, holder: CoinsHolderView | null): Node {
        const w = 140, h = 54;
        const btn = this.makeButton(parent, `+${this.coinAdReward}`, x, y, w, h, order, Color.WHITE, () => this.onCoinAdTap(btn.node, holder),
            this.adButtonFrame || this.buttonFrame);
        const coinNode = this.makeNode('CoinGroup', btn.node, -w * 0.34, 0, 38, 38);
        const coin = coinNode.addComponent(Sprite);
        coin.sizeMode = Sprite.SizeMode.CUSTOM;
        coin.spriteFrame = this.coinGroupFrame || this.coinFrame;
        coin.trim = false;
        coinNode.addComponent(Sorting2D).sortingOrder = order + 2;
        btn.label.node.setPosition(w * 0.03, 2, 0);
        btn.label.node.getComponent(UITransform)!.setContentSize(w * 0.5, h - 14);

        // Icone de video (anuncio) dentro do botao, a direita.
        const adNode = this.makeNode('AdIcon', btn.node, w * 0.37, 0, 24, 24);
        const ad = adNode.addComponent(Sprite);
        ad.sizeMode = Sprite.SizeMode.CUSTOM;
        ad.spriteFrame = this.adFrame;
        adNode.addComponent(Sorting2D).sortingOrder = order + 3;
        return btn.node;
    }

    private onCoinAdTap(button: Node, holder: CoinsHolderView | null) {
        if (this.adBusy) return;
        this.adBusy = true;
        PokiService.rewardedBreak().then(ok => {
            this.adBusy = false;
            if (!ok) return; // sem anuncio/recompensa: nada acontece (a Poki cuida da mensagem)
            this.grantCoinsAnimated(this.coinAdReward, button.worldPosition.clone(), holder);
        });
    }

    /** Soma coins ao saldo; as moedas voam do botao ate o holder e o valor sobe conforme chegam. */
    private grantCoinsAnimated(amount: number, fromWorld: Vec3, holder: CoinsHolderView | null) {
        const before = PlayerWallet.getPoints();
        PlayerWallet.addPoints(amount);
        if (!holder || !holder.coin) {
            this.refreshBadges();
            return;
        }
        holder.setValue(before);
        const count = 18;
        const base = Math.floor(amount / count);
        let shown = before;
        this.FlyCoinsTo(fromWorld, count, holder.coin, i => {
            shown += i === count - 1 ? amount - base * (count - 1) : base;
            holder.setValue(shown);
            this.punchNode(holder.node);
        });
        this.showToast(`+${amount} coins`);
    }

    // ---------- Descricao ao passar o mouse ----------

    /** Mouse sobre o power-up (ou toque longo no celular) mostra uma janelinha com o efeito. */
    private attachTooltip(node: Node, type: PowerupType) {
        node.on(Node.EventType.MOUSE_ENTER, () => this.showTooltip(node, type));
        node.on(Node.EventType.MOUSE_LEAVE, () => this.hideTooltip(node));
        node.on(Node.EventType.TOUCH_START, () => {
            this.longPressShown = false;
            this.scheduleOnce(() => {
                this.longPressShown = true;
                this.showTooltip(node, type);
            }, 0.4);
        });
        const cancel = () => {
            this.unscheduleAllCallbacks();
            this.hideTooltip(node);
        };
        node.on(Node.EventType.TOUCH_END, cancel);
        node.on(Node.EventType.TOUCH_CANCEL, () => { this.longPressShown = false; cancel(); });
    }

    private showTooltip(target: Node, type: PowerupType) {
        if (!this.tooltip) {
            const root = this.makeNode('PowerupTooltip', this.node.parent || this.node, 0, 0, 320, 104);
            const base = this.windowSortingBase + 60;
            this.makeSprite(root, this.pointsFrame, base, true);
            this.tooltipName = this.makeLabel(root, '', 26, 290, 30, 0, 26, base + 1, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));
            this.tooltipText = this.makeLabel(root, '', 20, 290, 48, 0, -14, base + 1);
            this.tooltipText.enableWrapText = true;
            this.tooltip = root;
        }
        const def = PowerupCatalog.getDef(type);
        this.tooltipName!.string = def.name;
        this.tooltipText!.string = def.description;

        const root = this.tooltip;
        root.active = true;
        this.tooltipFor = target;
        const parent = root.parent;
        if (parent) root.setSiblingIndex(parent.children.length - 1);

        // Acima do power-up, sem sair da tela.
        const world = target.worldPosition;
        const height = target.getComponent(UITransform)?.height ?? 80;
        const x = Math.max(160 + 20, Math.min(1280 - 160 - 20, world.x));
        const y = Math.min(720 - 70, world.y + height / 2 + 62);
        root.setWorldPosition(x, y, 0);
    }

    private hideTooltip(target?: Node) {
        if (!this.tooltip) return;
        if (target && this.tooltipFor !== target) return;
        this.tooltip.active = false;
        this.tooltipFor = null;
    }

    // ---------- Feedback ----------

    private shake(node?: Node) {
        if (!node) return;
        Tween.stopAllByTarget(node);
        node.setRotationFromEuler(0, 0, 0);
        tween(node)
            .to(0.05, { eulerAngles: new Vec3(0, 0, 8) })
            .to(0.1, { eulerAngles: new Vec3(0, 0, -8) })
            .to(0.05, { eulerAngles: new Vec3(0, 0, 0) })
            .start();
    }

    private playActivateEffect(node?: Node) {
        if (!this.activateEffectPrefab || !node) return;
        const fx = instantiate(this.activateEffectPrefab);
        fx.parent = this.node;
        fx.setWorldPosition(node.worldPosition);
        fx.setScale(1.1, 1.1, 1);
    }

    /** Aviso curto no centro da tela. */
    public showToast(text: string, bottom: boolean = false) {
        if (!this.toast) {
            const root = this.makeNode('Toast', this.node.parent || this.node, 0, 0, 700, 60);
            const label = this.makeLabel(root, '', 36, 680, 56, 0, 0, this.windowSortingBase + 20, Color.WHITE, new Color(10, 40, 90, 255));
            (root as any).__label = label;
            this.toast = root;
        }
        const root = this.toast;
        const parent = root.parent;
        if (parent) root.setSiblingIndex(parent.children.length - 1);
        ((root as any).__label as Label).string = text;
        root.active = true;
        Tween.stopAllByTarget(root);
        // Com a janela aberta o aviso fica no espaco livre no rodape dela (nao cobre o titulo); em jogo, perto do topo.
        const baseY = bottom || (this.windowRoot && this.windowRoot.active) ? -252 : 250;
        root.setPosition(0, baseY, 0);
        root.setScale(0.6, 0.6, 1);
        tween(root)
            .to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' })
            .delay(1.0)
            .to(0.3, { position: new Vec3(0, baseY + 40, 0), scale: new Vec3(0.8, 0.8, 1) })
            .call(() => { root.active = false; })
            .start();
    }
}
