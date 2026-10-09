import { SoundManager } from './SoundManager';
import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Font, UITransform, Vec3, Color, Sorting2D, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;
import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { OrderPlan, LevelPlan } from './LevelConfig';
import { GameManager } from './GameManager';
import { PlayerStats, AchievementMetric } from './PlayerStats';

interface OrderLineView {
    type: ElementType;
    /** Quantidade exata pedida (um unico merge com esse numero de itens iguais). */
    quantity: number;
    /** Um merge ja foi iniciado para esta linha (aguardando os itens chegarem a prateleira). */
    reserved: boolean;
    done: boolean;
    row: Node;
    countLabel: Label;
}

interface OrderView {
    plan: OrderPlan;
    node: Node;
    height: number;
    bg: Sprite;
    timerLabel: Label;
    lines: OrderLineView[];
    timeLeft: number;
    delivered: boolean;
}

/** Reserva de uma linha de pedido por um merge em andamento. */
export interface OrderClaim {
    order: OrderView;
    line: OrderLineView;
    quantity: number;
    type: ElementType;
}

/**
 * Painel "Orders": pedidos que aparecem ao longo da rodada. Cada linha pede uma quantidade EXATA de um
 * alimento (1 a 4) e o merge so acontece quando existe um pedido aberto que o peca. Entregar com tempo sobrando
 * soma tempo ao nivel; entregar atrasado subtrai o atraso. O nivel termina quando todos os pedidos forem
 * entregues (vitoria) ou o tempo acabar (derrota).
 */
@ccclass('OrderManager')
export class OrderManager extends Component {

    public static instance: OrderManager = null!;

    @property({ type: Font, tooltip: 'Fonte dos textos do painel (vazio = fonte do sistema).' })
    public font: Font | null = null;

    @property({ type: SpriteFrame, tooltip: 'Fundo arredondado dos cartoes de pedido.' })
    public cardBackground: SpriteFrame | null = null;

    @property({ tooltip: 'Titulo do painel.' })
    public titleText: string = 'Orders';

    @property({ tooltip: 'Largura (px) de cada cartao de pedido.' })
    public cardWidth: number = 128;

    @property({ tooltip: 'Altura (px) do espaco para os cartoes (abaixo do titulo).' })
    public cardsAreaHeight: number = 620;

    @property({ tooltip: 'Posicao vertical (px) do titulo.' })
    public titleY: number = 318;

    @property({ tooltip: 'Fracao do tempo que sobrou que e somada ao tempo do nivel ao entregar um pedido cedo.' })
    public earlyBonusFactor: number = 0.4;

    @property({ tooltip: 'Bonus maximo (s) por pedido entregue cedo.' })
    public maxEarlyBonus: number = 15;

    @property({ tooltip: 'Multiplicador do atraso subtraido do tempo do nivel (1 = segundo por segundo).' })
    public latePenaltyFactor: number = 1;

    @property({ tooltip: 'Abaixo desta fracao do prazo o timer do pedido fica em alerta (amarelo/laranja).' })
    public warnRatio: number = 0.3;

    @property({ tooltip: 'Sorting order base dos elementos do painel.' })
    public sortingBase: number = 6;

    /** Estatisticas lidas pela tela de vitoria / calculo de estrelas. */
    public totalOrders: number = 0;
    public deliveredOrders: number = 0;
    public lateOrders: number = 0;

    private plan: LevelPlan | null = null;
    private nextIndex: number = 0;
    private elapsed: number = 0;
    private active: OrderView[] = [];
    private clock: number = 0;
    private allDelivered: boolean = false;
    private frozenFor: number = 0;
    /** Escala uniforme dos cartoes: diminui quando ha pedidos demais para a altura do painel. */
    private cardScale: number = 1;
    private selection: Map<ElementType, number> = new Map();

    private readonly cardColor = new Color(30, 36, 60, 235);
    private readonly lateColor = new Color(150, 20, 25, 240);
    private readonly okColor = new Color(60, 220, 90, 255);
    private readonly warnColor = new Color(255, 190, 40, 255);
    private readonly badColor = new Color(255, 70, 60, 255);
    private readonly frozenText = new Color(120, 220, 255, 255);
    private readonly frozenCard = new Color(25, 70, 130, 240);

    protected onLoad() {
        OrderManager.instance = this;
        this.createTitle();
    }

    protected onDestroy() {
        if (OrderManager.instance === this) OrderManager.instance = null!;
        const events = GameManager.instance?.events;
        events?.off(GameManager.EVENT_LEVEL_READY, this.onLevelReady, this);
        events?.off(GameManager.EVENT_SELECTION_CHANGED, this.onSelectionChanged, this);
    }

    protected start() {
        const events = GameManager.instance?.events;
        events?.on(GameManager.EVENT_LEVEL_READY, this.onLevelReady, this);
        events?.on(GameManager.EVENT_SELECTION_CHANGED, this.onSelectionChanged, this);
    }

    private onLevelReady(plan: LevelPlan) {
        this.plan = plan;
        this.nextIndex = 0;
        this.elapsed = 0;
        this.active = [];
        this.totalOrders = plan.orders.length;
        this.deliveredOrders = 0;
        this.lateOrders = 0;
        this.allDelivered = false;
        this.spawnDueOrders();
    }

    protected update(dt: number) {
        if (!this.plan) return;
        this.clock += dt;

        const running = GameManager.instance?.IsRunning();
        if (running && !this.allDelivered) {
            if (this.frozenFor > 0) {
                // Power-up: os prazos dos pedidos e o aparecimento de novos ficam parados.
                this.frozenFor = Math.max(0, this.frozenFor - dt);
            } else {
                this.elapsed += dt;
                this.active.forEach(o => { o.timeLeft -= dt; });
                this.spawnDueOrders();
            }
        }

        this.active.forEach(o => this.refreshTimer(o));
    }

    // ---------- Pedidos x merges ----------

    /**
     * Procura o pedido que deve receber o merge de `type`, respeitando a ORDEM EM QUE OS PEDIDOS APARECEM NA TELA
     * (de cima para baixo): vale o primeiro pedido com uma linha desse alimento ainda pendente. Se a quantidade
     * dele ainda nao esta na prateleira, o merge espera (nao e entregue a um pedido de baixo).
     * Reserva a linha e devolve a reserva, ou null.
     */
    public TryClaim(type: ElementType, available: number): OrderClaim | null {
        if (!this.plan || this.allDelivered) return null;

        for (const order of this.active) {
            if (order.delivered) continue;
            const line = order.lines.find(l => l.type === type && !l.done && !l.reserved);
            if (!line) continue;

            // Primeiro pedido (na ordem da tela) que quer este alimento: ele tem a prioridade.
            if (line.quantity > available) return null;
            line.reserved = true;
            return { order, line, quantity: line.quantity, type };
        }
        return null;
    }

    // ---------- Power-ups ----------

    public FreezeOrders(seconds: number) {
        this.frozenFor = Math.max(this.frozenFor, seconds);
    }

    public get frozenSecondsLeft(): number { return this.frozenFor; }

    /** Power-up: todo produto de todo pedido passa a pedir apenas 1. Retorna false se nada mudou. */
    public ReduceQuantities(): boolean {
        let changed = false;
        for (const order of this.active) {
            if (order.delivered) continue;
            for (const line of order.lines) {
                if (line.done || line.reserved || line.quantity <= 1) continue;
                line.quantity = 1;
                this.refreshLine(line);
                Tween.stopAllByTarget(line.row);
                line.row.setScale(1, 1, 1);
                tween(line.row).to(0.1, { scale: new Vec3(1.25, 1.25, 1) }).to(0.15, { scale: Vec3.ONE }).start();
                changed = true;
            }
        }
        // Com menos itens exigidos, o que ja esta na prateleira pode completar pedidos na hora.
        if (changed) GameManager.instance?.events.emit(GameManager.EVENT_DEMAND_CHANGED);
        return changed;
    }

    /** Primeira linha pendente (na ordem da tela): o proximo alimento a juntar. */
    public GetNextPendingLine(): { type: ElementType, quantity: number } | null {
        for (const order of this.active) {
            if (order.delivered) continue;
            const line = order.lines.find(l => !l.done && !l.reserved);
            if (line) return { type: line.type, quantity: line.quantity };
        }
        return null;
    }

    /** Linhas (alimento + quantidade) do primeiro pedido aberto: usado pelo tutorial guiado. */
    public GetFirstOrderLines(): { type: ElementType, quantity: number }[] {
        const order = this.active[0];
        return order ? order.lines.map(l => ({ type: l.type, quantity: l.quantity })) : [];
    }

    /** Quantidade que o primeiro pedido (na ordem da tela) ainda pede desse alimento (0 = ninguem pede). */
    public NextQuantityFor(type: ElementType): number {
        for (const order of this.active) {
            if (order.delivered) continue;
            const line = order.lines.find(l => l.type === type && !l.done && !l.reserved);
            if (line) return line.quantity;
        }
        return 0;
    }

    /** Chamado quando o merge reservado termina: a linha esta cumprida. */
    public CompleteLine(claim: OrderClaim) {
        const { order, line } = claim;
        if (order.delivered || line.done) return;
        line.done = true;
        line.reserved = false;
        this.refreshLine(line);

        Tween.stopAllByTarget(line.row);
        tween(line.row)
            .to(0.08, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.12, { scale: Vec3.ONE })
            .start();

        if (order.lines.every(l => l.done)) this.deliver(order);
    }

    private onSelectionChanged(counts: Map<ElementType, number>) {
        this.selection = counts;
        this.active.forEach(o => o.lines.forEach(l => this.refreshLine(l)));
    }

    // ---------- Pedidos ----------

    private spawnDueOrders() {
        const plan = this.plan;
        if (!plan) return;
        let spawned = false;
        while (this.nextIndex < plan.orders.length) {
            const next = plan.orders[this.nextIndex];
            // Nunca fica sem pedidos na tela: abaixo do minimo o proximo pedido aparece sem esperar o horario.
            if (next.spawnTime > this.elapsed && this.active.length >= plan.minActiveOrders) break;
            // Sem limite de pedidos simultaneos: todo pedido aparece no horario. Se faltar espaco na coluna,
            // os cartoes encolhem (veja layoutCards).
            this.nextIndex++;
            this.active.push(this.createOrder(next));
            this.layoutCards(true);
            spawned = true;
        }
        // Novo pedido: se os itens ja estiverem na prateleira, o merge acontece automaticamente.
        if (spawned) GameManager.instance?.events.emit(GameManager.EVENT_DEMAND_CHANGED);
    }

    private deliver(order: OrderView) {
        if (order.delivered) return;
        order.delivered = true;
        this.deliveredOrders++;
        if (GameManager.instance?.IsRunning()) {
            PlayerStats.increment(AchievementMetric.OrdersDelivered);
            if (order.timeLeft >= 0) PlayerStats.increment(AchievementMetric.OrdersOnTime);
        }

        const gm = GameManager.instance;
        const worldPos = order.node.worldPosition.clone();
        // Durante o tutorial (cronometro parado) a entrega nao altera o tempo nem conta como atraso.
        if (gm && !gm.IsRunning()) {
            // sem bonus/penalidade
        } else if (order.timeLeft >= 0) {
            const bonus = Math.min(this.maxEarlyBonus, Math.floor(order.timeLeft * this.earlyBonusFactor));
            if (gm && bonus > 0) gm.AddTime(bonus, worldPos);
        } else {
            this.lateOrders++;
            SoundManager.playBadResultOrder();
            const penalty = Math.ceil(-order.timeLeft * this.latePenaltyFactor);
            if (gm && penalty > 0) gm.AddTime(-penalty, worldPos);
        }

        const late = order.timeLeft < 0;
        if (!late) SoundManager.playSuccessOrder();
        order.bg.color = late ? this.badColor : this.okColor;
        Tween.stopAllByTarget(order.node);
        const cs = this.cardScale;
        tween(order.node)
            .to(0.12, { scale: new Vec3(1.12 * cs, 1.12 * cs, 1) })
            .to(0.22, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .call(() => {
                const i = this.active.indexOf(order);
                if (i !== -1) this.active.splice(i, 1);
                order.node.destroy();
                this.layoutCards(true);
                this.spawnDueOrders();
            })
            .start();

        gm?.events.emit(GameManager.EVENT_ORDER_DELIVERED, this.deliveredOrders);

        if (this.deliveredOrders >= this.totalOrders) {
            this.allDelivered = true;
            gm?.CompleteLevel();
        }
    }

    // ---------- Visual ----------

    private heightFor(order: OrderPlan): number {
        return 36 + order.lines.length * 44 + 10;
    }

    private usedHeight(): number {
        return this.active.reduce((s, o) => s + o.height + 8, 0);
    }

    private makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private makeLabel(n: Node, size: number, order: number, color: Color, outline: Color): Label {
        const label = n.addComponent(Label);
        if (this.font) {
            label.useSystemFont = false;
            label.font = this.font;
        }
        label.fontSize = size;
        label.lineHeight = size;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 10));
        n.addComponent(Sorting2D).sortingOrder = this.sortingBase + order;
        return label;
    }

    private createTitle() {
        const n = this.makeNode('OrdersTitle', this.node, 0, this.titleY, this.cardWidth + 10, 44);
        const label = this.makeLabel(n, 38, 3, Color.WHITE, new Color(20, 70, 120, 255));
        label.string = this.titleText;
        label.isBold = true;
        label.overflow = Label.Overflow.SHRINK;
    }

    private createOrder(plan: OrderPlan): OrderView {
        const w = this.cardWidth;
        const h = this.heightFor(plan);
        const node = this.makeNode('Order', this.node, 0, 0, w, h);

        const bgNode = this.makeNode('BG', node, 0, 0, w, h);
        const bg = bgNode.addComponent(Sprite);
        bg.sizeMode = Sprite.SizeMode.CUSTOM;
        bg.type = Sprite.Type.SLICED;
        if (this.cardBackground) {
            const f = this.cardBackground;
            if (f.insetLeft === 0) { f.insetLeft = f.insetRight = f.insetTop = f.insetBottom = 24; }
            bg.spriteFrame = f;
        }
        bg.color = this.cardColor;
        bgNode.addComponent(Sorting2D).sortingOrder = this.sortingBase;

        const timerNode = this.makeNode('Timer', node, 0, h / 2 - 20, w - 12, 30);
        const timerLabel = this.makeLabel(timerNode, 28, 2, Color.WHITE, new Color(10, 10, 20, 255));
        timerLabel.isBold = true;

        const lines: OrderLineView[] = plan.lines.map((l, i) => {
            const y = h / 2 - 36 - 22 - i * 44;
            const row = this.makeNode('Line', node, 0, y, w - 12, 40);

            const icon = this.makeNode('Icon', row, -(w - 12) / 2 + 26, 0, 40, 40);
            const sprite = icon.addComponent(Sprite);
            ElementCatalog.applyFitted(sprite, l.type, 38);
            icon.addComponent(Sorting2D).sortingOrder = this.sortingBase + 2;

            const countNode = this.makeNode('Count', row, 22, 0, 64, 36);
            const countLabel = this.makeLabel(countNode, 30, 3, Color.WHITE, new Color(10, 10, 20, 255));
            countLabel.isBold = true;

            const line: OrderLineView = { type: l.type, quantity: l.quantity, reserved: false, done: false, row, countLabel };
            this.refreshLine(line);
            return line;
        });

        const view: OrderView = { plan, node, height: h, bg, timerLabel, lines, timeLeft: plan.deliverTime, delivered: false };
        this.refreshTimer(view);

        node.setScale(0, 0, 1);
        tween(node).to(0.25, { scale: new Vec3(this.cardScale, this.cardScale, 1) }, { easing: 'backOut' }).start();
        return view;
    }

    /** "x3" = quantidade pedida; com itens ja na prateleira vira "1/3", "2/3"... */
    private refreshLine(line: OrderLineView) {
        if (line.done) {
            line.countLabel.string = 'OK';
            line.countLabel.color = this.okColor;
            line.countLabel.fontSize = 24;
        } else if (line.reserved) {
            line.countLabel.string = `${line.quantity}/${line.quantity}`;
            line.countLabel.color = this.okColor;
            line.countLabel.fontSize = 26;
        } else {
            const have = Math.min(this.selection.get(line.type) || 0, line.quantity);
            line.countLabel.string = have > 0 ? `${have}/${line.quantity}` : `x${line.quantity}`;
            line.countLabel.color = have > 0 ? this.warnColor : Color.WHITE;
            line.countLabel.fontSize = have > 0 ? 26 : 30;
        }
        line.countLabel.lineHeight = line.countLabel.fontSize;
    }

    private refreshTimer(order: OrderView) {
        if (order.delivered) return;
        const t = order.timeLeft;
        const late = t < 0;
        const abs = Math.ceil(Math.abs(t));
        const mm = Math.floor(abs / 60);
        const ss = abs % 60;
        // Atrasado: sinal negativo e contagem do atraso.
        order.timerLabel.string = `${late ? '-' : ''}${mm}:${ss < 10 ? '0' : ''}${ss}`;

        if (this.frozenFor > 0) {
            // Pedidos congelados (power-up): cartao e timer em azul, sem pulsar.
            order.timerLabel.color = this.frozenText;
            order.bg.color = this.frozenCard;
            order.node.setScale(this.cardScale, this.cardScale, 1);
            order.timerLabel.node.setScale(1, 1, 1);
        } else if (late) {
            order.timerLabel.color = this.badColor;
            // Efeito ruim: o cartao pulsa e pisca em vermelho.
            const pulse = 0.5 + 0.5 * Math.sin(this.clock * 12);
            const s = (1 + 0.05 * pulse) * this.cardScale;
            order.node.setScale(s, s, 1);
            order.bg.color = Color.lerp(new Color(), this.cardColor, this.lateColor, 0.35 + 0.65 * pulse);
            order.timerLabel.node.setScale(1 + 0.15 * pulse, 1 + 0.15 * pulse, 1);
        } else if (t / order.plan.deliverTime <= this.warnRatio) {
            order.timerLabel.color = t / order.plan.deliverTime <= this.warnRatio / 2 ? this.badColor : this.warnColor;
            order.bg.color = this.cardColor;
        } else {
            order.timerLabel.color = Color.WHITE;
            order.bg.color = this.cardColor;
        }
    }

    /** Empilha os cartoes de cima para baixo, animando a reacomodacao. Com muitos pedidos, todos encolhem para caber. */
    private layoutCards(animate: boolean) {
        const total = this.usedHeight();
        const newScale = total > this.cardsAreaHeight ? Math.max(0.5, this.cardsAreaHeight / total) : 1;
        const rescaled = Math.abs(newScale - this.cardScale) > 0.001;
        this.cardScale = newScale;
        const cs = this.cardScale;

        let y = this.titleY - 30;
        for (const o of this.active) {
            const h = o.height * cs;
            const target = y - h / 2;
            const pos = o.node.position;
            if (rescaled && !o.delivered && o.node.scale.x > 0) {
                Tween.stopAllByTarget(o.node);
                o.node.setScale(cs, cs, 1);
            }
            if (animate && o.node.activeInHierarchy && Math.abs(pos.y - target) > 0.5 && o.node.scale.x > 0) {
                const isNew = pos.y === 0 && pos.x === 0;
                if (isNew) {
                    o.node.setPosition(0, target, 0);
                } else {
                    tween(o.node).to(0.2, { position: new Vec3(0, target, 0) }, { easing: 'quadOut' }).start();
                }
            } else {
                o.node.setPosition(0, target, 0);
            }
            y -= h + 8 * cs;
        }
    }
}
