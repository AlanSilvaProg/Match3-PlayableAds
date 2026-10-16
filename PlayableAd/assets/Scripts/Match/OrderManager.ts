import { SoundManager } from './SoundManager';
import { tr } from './I18n';
import { GoldenTime } from './GoldenTime';
import { Responsive } from './Responsive';
import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Font, UITransform, Vec3, Color, Sorting2D, tween, Tween, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;
import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { OrderPlan, LevelPlan } from './LevelConfig';
import { GameManager } from './GameManager';
import { PlayerStats, AchievementMetric } from './PlayerStats';
import { PowerupManager } from './PowerupManager';
import { ComboManager } from './ComboManager';

interface OrderLineView {
    type: ElementType;
    /** Quantidade exata pedida (um unico merge com esse numero de itens iguais). */
    quantity: number;
    /** Itens ja escolhidos (voando ou entregues ao cartao): a linha ja esta totalmente reservada quando chega a `quantity`. */
    assigned: number;
    /** Itens que ja chegaram ao cartao (e contam no progresso 1/3). */
    arrived: number;
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
    /** Todas as linhas prontas: o botao ENTREGAR do cartao esta liberado. */
    ready: boolean;
    /** Relogio (this.clock) do momento em que o pedido ficou pronto. */
    readyAt: number;
    footer: Node;
    footerBg: Sprite;
    footerLabel: Label;
    /** Moedas dos merges deste pedido, seguras ate o jogador entregar. */
    heldPoints: number;
    coinCount: number;
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
    private static readonly FOOTER_H = 40;

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
    /** Pedidos das fases ja concluidas deste nivel (as estatisticas acima sao so da fase atual). */
    private carryTotal: number = 0;
    private carryDelivered: number = 0;
    private carryLate: number = 0;
    private phaseIdx: number = -1;
    /** Totais do nivel inteiro (fases anteriores + fase atual): usados no calculo de estrelas e nos tutoriais. */
    public get levelTotalOrders(): number { return this.carryTotal + this.totalOrders; }
    public get levelDeliveredOrders(): number { return this.carryDelivered + this.deliveredOrders; }
    public get levelLateOrders(): number { return this.carryLate + this.lateOrders; }

    private plan: LevelPlan | null = null;
    private nextIndex: number = 0;
    private elapsed: number = 0;
    private active: OrderView[] = [];
    private clock: number = 0;

    @property({ tooltip: 'Dica: segundos sem entregar um pedido para os alimentos certos pulsarem.' })
    public hintSeconds: number = 8;

    @property({ tooltip: 'Dica: so nos primeiros N niveis.' })
    public hintLevels: number = 3;

    private sinceDelivery: number = 0;
    private hinted: any[] = [];
    private hintRefresh: number = 0;
    private allDelivered: boolean = false;
    private frozenFor: number = 0;
    /** Escala uniforme dos cartoes: diminui quando ha pedidos demais para a altura do painel. */
    private cardScale: number = 1;
    private titleNode: Node | null = null;

    private readonly goldenCard = new Color(255, 185, 30, 255);
    private readonly goldenCardLight = new Color(255, 232, 110, 255);
    private readonly cardColor = new Color(30, 36, 60, 235);
    private readonly readyCard = new Color(36, 128, 66, 245);
    private readonly lateColor = new Color(150, 20, 25, 240);
    private readonly okColor = new Color(60, 220, 90, 255);
    private readonly warnColor = new Color(255, 190, 40, 255);
    private readonly badColor = new Color(255, 70, 60, 255);
    private readonly frozenText = new Color(120, 220, 255, 255);
    private readonly frozenCard = new Color(25, 70, 130, 240);

    protected onLoad() {
        OrderManager.instance = this;
        this.createTitle();
        Responsive.onChange(this.onResponsive);
    }

    private onResponsive = () => { this.relayout(); };

    /** Orientacao mudou: reposiciona titulo e cartoes (coluna em paisagem, faixa em linhas no retrato). */
    public relayout() {
        if (!this.node || !this.node.isValid) return;
        this.titleNode?.setPosition(0, this.titleLocalY(), 0);
        this.layoutCards(false);
    }

    private titleLocalY(): number {
        // Paisagem: titulo ancorado no topo visivel (titleY foi definido para a altura 720).
        return Responsive.portrait ? 0 : this.titleY + Math.max(0, Responsive.height - Responsive.LAND_H) / 2;
    }

    protected onDestroy() {
        Responsive.offChange(this.onResponsive);
        if (OrderManager.instance === this) OrderManager.instance = null!;
        const events = GameManager.instance?.events;
        events?.off(GameManager.EVENT_LEVEL_READY, this.onLevelReady, this);
    }

    protected start() {
        const events = GameManager.instance?.events;
        events?.on(GameManager.EVENT_LEVEL_READY, this.onLevelReady, this);
    }

    private onLevelReady(plan: LevelPlan) {
        // Estatisticas do nivel: acumulam ao avancar de fase; repetir a mesma fase (checkpoint) mantem o acumulado anterior.
        if (plan.phaseIndex === 0) {
            this.carryTotal = this.carryDelivered = this.carryLate = 0;
        } else if (plan.phaseIndex !== this.phaseIdx) {
            this.carryTotal += this.totalOrders;
            this.carryDelivered += this.deliveredOrders;
            this.carryLate += this.lateOrders;
        }
        this.phaseIdx = plan.phaseIndex;

        // Cartoes de uma tentativa anterior (checkpoint) somem antes da nova fase.
        this.active.forEach(o => { Tween.stopAllByTarget(o.node); if (o.node.isValid) o.node.destroy(); });
        this.frozenFor = 0;
        this.sinceDelivery = 0;
        this.stopHint();
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
        if (running && !this.allDelivered && !GameManager.instance?.timeHeld) {
            if (this.frozenFor > 0) {
                // Power-up: os prazos dos pedidos e o aparecimento de novos ficam parados.
                this.frozenFor = Math.max(0, this.frozenFor - dt);
            } else {
                this.elapsed += dt;
                this.active.forEach(o => { o.timeLeft -= dt; });
                this.spawnDueOrders();
            }
        }

        this.active.forEach(o => {
            this.refreshTimer(o);
            if (o.ready && !o.delivered && o.footer.isValid) {
                const k = 1 + 0.12 * (0.5 + 0.5 * Math.sin(this.clock * 9));
                o.footer.setScale(k, k, 1);
                // O cartao inteiro pulsa e, a cada ~1,8s, balanca chamando a atencao.
                if (o.timeLeft >= 0 && this.frozenFor <= 0) {
                    const s = this.cardScale * (1 + 0.05 * (0.5 + 0.5 * Math.sin(this.clock * 6)));
                    o.node.setScale(s, s, 1);
                }
                const t = this.clock % 1.8;
                o.node.setRotationFromEuler(0, 0, t < 0.55 ? Math.sin(t * 34) * 5 * (1 - t / 0.55) : 0);
            }
        });
        this.updateHint(dt);
    }

    // ---------- Dica (primeiros niveis) ----------

    private updateHint(dt: number) {
        const gm = GameManager.instance;
        const ok = !!gm && GameManager.currentLevel < this.hintLevels && gm.IsRunning() && !gm.timeHeld
            && gm.tutorialAllowed === null && !GoldenTime.active && !this.allDelivered
            && !this.active.some(o => o.ready && !o.delivered); // pedido pronto: o proximo passo e ENTREGAR
        if (!ok) { if (this.hinted.length) this.stopHint(); return; }
        this.sinceDelivery += dt;
        if (this.sinceDelivery < this.hintSeconds) return;
        this.hintRefresh -= dt;
        if (this.hintRefresh > 0) return;
        this.hintRefresh = 0.4;
        this.hinted = this.hinted.filter(el => {
            if (el.isValid && el.isAvailable) return true;
            return false; // foi selecionado: o proprio OnClick ja parou o tween
        });
        const scene = gm!.node.parent;
        const board = scene ? scene.getChildByName('MatchSpace') : null;
        if (!board) return;
        const candidates: any[] = board.getComponentsInChildren('MatchElement').filter((e: any) => e.isValid && e.isAvailable);
        for (const line of this.GetPriorityOrderLines()) {
            const of = candidates.filter(e => e.type === line.type).slice(0, line.quantity);
            for (const el of of) {
                if (this.hinted.indexOf(el) !== -1) continue;
                this.hinted.push(el);
                const sc = el.availableScale;
                Tween.stopAllByTarget(el.node);
                tween(el.node)
                    .to(0.3, { scale: new Vec3(sc.x * 1.2, sc.y * 1.2, sc.z) }, { easing: 'sineInOut' })
                    .to(0.3, { scale: sc.clone() }, { easing: 'sineInOut' })
                    .union().repeatForever().start();
            }
        }
    }

    private stopHint() {
        for (const el of this.hinted) {
            if (!el.isValid || !el.node || !el.isAvailable) continue;
            Tween.stopAllByTarget(el.node);
            el.node.setScale(el.availableScale);
        }
        this.hinted = [];
        this.hintRefresh = 0;
    }

    // ---------- Pedidos x merges ----------

    /**
     * Escolhe o pedido que recebe um alimento de `type`, na ORDEM EM QUE OS PEDIDOS APARECEM NA TELA (de cima para
     * baixo): o primeiro com uma linha desse alimento ainda incompleta. Reserva a vaga e devolve a reserva; null =
     * nenhum pedido pede o alimento (o item nao pode ser selecionado).
     */
    public TryAssign(type: ElementType): OrderClaim | null {
        if (!this.plan || this.allDelivered) return null;
        for (const order of this.active) {
            if (order.delivered) continue;
            const line = order.lines.find(l => l.type === type && !l.done && l.assigned < l.quantity);
            if (!line) continue;
            line.assigned++;
            if (line.assigned >= line.quantity) line.reserved = true;
            return { order, line, quantity: line.quantity, type };
        }
        return null;
    }

    /** Um ponto (mundo) esta sobre algum cartao de pedido ainda aberto? (soltar um alimento ali o seleciona) */
    public isOverCard(world: Vec3): boolean {
        for (const o of this.active) {
            if (o.delivered || !o.node.isValid) continue;
            const ut = o.node.getComponent(UITransform);
            if (!ut) continue;
            const r = ut.getBoundingBoxToWorld();
            if (world.x >= r.x && world.x <= r.x + r.width && world.y >= r.y && world.y <= r.y + r.height) return true;
        }
        return false;
    }

    /** Ponto (mundo) onde o alimento escolhido deve pousar: o icone da linha no cartao. */
    public GetLineTarget(claim: OrderClaim): Vec3 | null {
        const row = claim.line.row;
        if (!row || !row.isValid || claim.order.delivered) return null;
        const icon = row.getChildByName('Icon');
        return (icon || row).worldPosition.clone();
    }

    /** O alimento chegou ao cartao: o progresso da linha sobe; ao completar, o MatchController registra o combo/moedas. */
    public OnItemArrived(claim: OrderClaim) {
        const { order, line } = claim;
        if (order.delivered || line.done || this.active.indexOf(order) === -1) return;
        line.arrived++;
        this.refreshLine(line);
        Tween.stopAllByTarget(line.row);
        line.row.setScale(1, 1, 1);
        tween(line.row).to(0.06, { scale: new Vec3(1.15, 1.15, 1) }).to(0.1, { scale: Vec3.ONE }).start();
        if (line.arrived >= line.quantity) GameManager.instance?.events.emit(GameManager.EVENT_LINE_FULL, claim);
    }

    // ---------- Power-ups ----------

    public FreezeOrders(seconds: number) {
        this.frozenFor = Math.max(this.frozenFor, seconds);
    }

    public get frozenSecondsLeft(): number { return this.frozenFor; }

    /** Power-up: todo produto de todo pedido passa a pedir apenas 1 (ou o que ja foi escolhido). Retorna false se nada mudou. */
    public ReduceQuantities(): boolean {
        let changed = false;
        const completed: OrderClaim[] = [];
        for (const order of this.active) {
            if (order.delivered) continue;
            for (const line of order.lines) {
                if (line.done) continue;
                const target = Math.max(1, line.assigned);
                if (line.quantity <= target) continue;
                line.quantity = target;
                if (line.assigned >= line.quantity) line.reserved = true;
                this.refreshLine(line);
                Tween.stopAllByTarget(line.row);
                line.row.setScale(1, 1, 1);
                tween(line.row).to(0.1, { scale: new Vec3(1.25, 1.25, 1) }).to(0.15, { scale: Vec3.ONE }).start();
                changed = true;
                if (line.arrived >= line.quantity) completed.push({ order, line, quantity: line.quantity, type: line.type });
            }
        }
        completed.forEach(c => GameManager.instance?.events.emit(GameManager.EVENT_LINE_FULL, c));
        return changed;
    }

    /** Primeiro cartao de pedido atrasado (prazo negativo) ainda nao entregue, ou null. Usado pelo tutorial de pedido atrasado. */
    public firstLateOrderNode(): Node | null {
        for (const o of this.active) if (!o.delivered && o.timeLeft < 0 && o.node.isValid) return o.node;
        return null;
    }

    /** Menor prazo (s) entre os pedidos abertos ainda no tempo (Infinity se nao ha). Usado pelos tutoriais de power-up. */
    public minOrderTimeLeft(): number {
        let min = Infinity;
        for (const o of this.active) if (!o.delivered && o.timeLeft >= 0) min = Math.min(min, o.timeLeft);
        return min;
    }

    /** Maior quantidade pedida numa linha ainda pendente (0 se nao ha). */
    public maxPendingQuantity(): number {
        let max = 0;
        for (const o of this.active) {
            if (o.delivered) continue;
            for (const l of o.lines) if (!l.done && !l.reserved) max = Math.max(max, l.quantity);
        }
        return max;
    }

    /** Primeira linha pendente (na ordem da tela): o proximo alimento a juntar. */
    public GetNextPendingLine(): { type: ElementType, quantity: number } | null {
        for (const order of this.active) {
            if (order.delivered) continue;
            const line = order.lines.find(l => !l.done && !l.reserved);
            if (line) return { type: line.type, quantity: line.quantity - line.assigned };
        }
        return null;
    }

    /** Alimentos ainda necessarios para fechar a fase: linhas abertas (nao reservadas) + pedidos que ainda vao aparecer. */
    public RemainingDemand(): Map<ElementType, number> {
        const demand = new Map<ElementType, number>();
        const add = (t: ElementType, n: number) => { if (n > 0) demand.set(t, (demand.get(t) || 0) + n); };
        for (const o of this.active) {
            if (o.delivered) continue;
            o.lines.forEach(l => { if (!l.done && !l.reserved) add(l.type, l.quantity - l.assigned); });
        }
        if (this.plan) {
            for (let i = this.nextIndex; i < this.plan.orders.length; i++) this.plan.orders[i].lines.forEach(l => add(l.type, l.quantity));
        }
        return demand;
    }

    /** Linhas pendentes (nao cumpridas nem reservadas) do primeiro pedido ainda nao entregue na tela: o proximo pedido a completar. */
    public GetPriorityOrderLines(): { type: ElementType, quantity: number }[] {
        for (const order of this.active) {
            if (order.delivered) continue;
            const lines = order.lines.filter(l => !l.done && !l.reserved).map(l => ({ type: l.type, quantity: l.quantity - l.assigned }));
            if (lines.length > 0) return lines;
        }
        return [];
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
            if (line) return line.quantity - line.assigned;
        }
        return 0;
    }

    /** Chamado quando o merge reservado termina: a linha esta cumprida. */
    public CompleteLine(claim: OrderClaim) {
        const { order, line } = claim;
        if (order.delivered || line.done) return;
        line.done = true;
        line.reserved = false;
        this.refreshAllLines();

        Tween.stopAllByTarget(line.row);
        tween(line.row)
            .to(0.08, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.12, { scale: Vec3.ONE })
            .start();

        if (order.lines.every(l => l.done)) this.markReady(order);
    }

    /** Pedido pronto na bandeja: libera o botao ENTREGAR do cartao. A entrega e uma acao do jogador. */
    private markReady(order: OrderView) {
        if (order.ready || order.delivered) return;
        order.ready = true;
        order.readyAt = this.clock;
        this.refreshFooter(order);
        this.addReadyGlow(order);
        SoundManager.playNotification();
        GameManager.instance?.events.emit(GameManager.EVENT_ORDER_READY, order.node);
    }

    /** Pedido pronto: aura verde pulsando atras do cartao (o resto do destaque e feito no update). */
    private addReadyGlow(order: OrderView) {
        if (!this.cardBackground || order.node.getChildByName('ReadyGlow')) return;
        const w = this.cardWidth + 44, h = order.height + 44;
        const g = this.makeNode('ReadyGlow', order.node, 0, 0, w, h);
        g.setSiblingIndex(0);
        const sp = g.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SLICED;
        sp.spriteFrame = this.cardBackground;
        sp.color = new Color(120, 255, 120, 255);
        g.addComponent(Sorting2D).sortingOrder = this.sortingBase - 1;
        const op = g.addComponent(UIOpacity);
        op.opacity = 140;
        tween(op).to(0.3, { opacity: 255 }).to(0.3, { opacity: 110 }).union().repeatForever().start();
    }

    /** As moedas de um merge ficam no pedido e so voam ate o placar quando ele for entregue. */
    public AddPendingCoins(claim: OrderClaim, points: number, count: number) {
        claim.order.heldPoints += points;
        claim.order.coinCount += count;
    }

    /** O jogador tocou em ENTREGAR. */
    public DeliverOrder(order: OrderView) {
        const gm = GameManager.instance;
        if (!order.ready || order.delivered || !gm || (!gm.IsRunning() && !gm.IsTutorialRunning())) return;
        order.ready = false;
        order.node.setRotationFromEuler(0, 0, 0);
        SoundManager.playMenuClick();
        const pm = PowerupManager.instance;
        if (order.coinCount > 0 && pm) {
            pm.FlyCoins(order.footer.worldPosition, Math.max(4, Math.min(20, order.coinCount)), order.heldPoints);
        } else if (order.heldPoints > 0) {
            ComboManager.instance?.ReleaseDisplay(order.heldPoints);
        }
        this.deliver(order);
    }

    /** Cartao ENTREGAR para a mao-guia: pedido pronto ha `minReady`s e com o prazo abaixo de `maxTime`s (ou ja atrasado), ou null. */
    public GetDeliverHintTarget(minReady: number, maxTime: number): Node | null {
        for (const o of this.active) {
            if (o.ready && !o.delivered && o.footer.isValid && this.clock - o.readyAt >= minReady && o.timeLeft < maxTime) return o.footer;
        }
        return null;
    }

    /** O no do botao ENTREGAR do 1o pedido pronto (usado pelo tutorial), ou null. */
    public firstReadyFooter(): Node | null {
        for (const o of this.active) if (o.ready && !o.delivered && o.footer.isValid) return o.footer;
        return null;
    }

    private refreshFooter(order: OrderView) {
        const ready = order.ready && !order.delivered;
        order.footerBg.color = ready ? new Color(50, 235, 85, 255) : new Color(70, 78, 110, 255);
        order.footerLabel.color = ready ? Color.WHITE : new Color(160, 170, 200, 255);
        if (!ready) order.footer.setScale(1, 1, 1);
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
        if (spawned) {
            this.refreshAllLines();
            GameManager.instance?.events.emit(GameManager.EVENT_DEMAND_CHANGED);
        }
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
            // Entrega no prazo conta para o combo (sem moedas extras: elas ja vieram dos merges).
            ComboManager.instance?.RegisterMatch(1, Math.max(1, order.lines.length), true);
            const bonus = Math.min(this.maxEarlyBonus, Math.floor(order.timeLeft * this.earlyBonusFactor));
            if (gm && bonus > 0) gm.AddTime(bonus, worldPos);
        } else {
            this.lateOrders++;
            ComboManager.instance?.BreakCombo(); // entrega atrasada zera o combo
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
                this.refreshAllLines(); // a prioridade passa para o proximo pedido
            })
            .start();

        this.sinceDelivery = 0;
        this.stopHint();
        gm?.events.emit(GameManager.EVENT_ORDER_DELIVERED, this.deliveredOrders);

        // Pedido de ouro entregue no prazo e que NAO e o ultimo da fase: Golden Time.
        if (order.plan.golden && !late && gm && gm.IsRunning() && this.deliveredOrders < this.totalOrders) {
            GoldenTime.start();
        }

        if (this.deliveredOrders >= this.totalOrders) {
            this.allDelivered = true;
            gm?.CompleteLevel();
        }
    }

    // ---------- Visual ----------

    private heightFor(order: OrderPlan): number {
        return 36 + order.lines.length * 44 + 10 + OrderManager.FOOTER_H;
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
        const n = this.makeNode('OrdersTitle', this.node, 0, this.titleLocalY(), this.cardWidth + 10, 44);
        this.titleNode = n;
        const label = this.makeLabel(n, 38, 3, Color.WHITE, new Color(20, 70, 120, 255));
        label.string = tr(this.titleText);
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
        bg.color = plan.golden ? this.goldenCard : this.cardColor;
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

            const line: OrderLineView = { type: l.type, quantity: l.quantity, assigned: 0, arrived: 0, reserved: false, done: false, row, countLabel };
            this.refreshLine(line);
            return line;
        });

        // Botao ENTREGAR (cinza ate o pedido ficar pronto, verde e pulsando depois).
        const footer = this.makeNode('Deliver', node, 0, -h / 2 + OrderManager.FOOTER_H / 2 + 4, w - 14, OrderManager.FOOTER_H - 4);
        const footerBg = footer.addComponent(Sprite);
        footerBg.sizeMode = Sprite.SizeMode.CUSTOM;
        footerBg.type = Sprite.Type.SLICED;
        if (this.cardBackground) footerBg.spriteFrame = this.cardBackground;
        footer.addComponent(Sorting2D).sortingOrder = this.sortingBase + 1;
        const footerTextNode = this.makeNode('Text', footer, 0, 0, w - 24, OrderManager.FOOTER_H - 8);
        const footerLabel = this.makeLabel(footerTextNode, 20, 3, Color.WHITE, new Color(10, 40, 20, 255));
        footerLabel.isBold = true;
        footerLabel.enableWrapText = false;
        footerLabel.overflow = Label.Overflow.SHRINK;
        footerLabel.fontSize = 19;
        footerLabel.lineHeight = 20;
        footerLabel.string = tr('DELIVER');

        const view: OrderView = {
            plan, node, height: h, bg, timerLabel, lines, timeLeft: plan.deliverTime, delivered: false,
            ready: false, readyAt: 0, footer, footerBg, footerLabel, heldPoints: 0, coinCount: 0,
        };
        // O cartao inteiro entrega (nao so o botao): qualquer toque nele, com o pedido pronto, faz a entrega.
        node.on(Node.EventType.TOUCH_END, () => this.DeliverOrder(view));
        this.refreshFooter(view);
        this.refreshTimer(view);

        node.setScale(0, 0, 1);
        tween(node).to(0.25, { scale: new Vec3(this.cardScale, this.cardScale, 1) }, { easing: 'backOut' }).start();
        return view;
    }

    private refreshAllLines() {
        this.active.forEach(o => o.lines.forEach(l => this.refreshLine(l)));
    }

    /** Progresso da linha: "0/3", "1/3"... (amarelo enquanto parcial, verde ao completar). */
    private refreshLine(line: OrderLineView) {
        if (line.done) {
            line.countLabel.string = `${line.quantity}/${line.quantity}`;
            line.countLabel.color = this.okColor;
        } else {
            const have = Math.min(line.arrived, line.quantity);
            line.countLabel.string = `${have}/${line.quantity}`;
            line.countLabel.color = have > 0 ? this.warnColor : Color.WHITE;
        }
        line.countLabel.fontSize = 26;
        line.countLabel.lineHeight = line.countLabel.fontSize;
    }

    /** Cor normal do cartao: azul escuro; pedidos de ouro brilham em dourado. */
    private baseCard(order: OrderView): Color {
        if (order.ready && !order.plan.golden) return this.readyCard;
        if (!order.plan.golden) return this.cardColor;
        const k = 0.5 + 0.5 * Math.sin(this.clock * 4);
        return Color.lerp(new Color(), this.goldenCard, this.goldenCardLight, k);
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
            order.bg.color = Color.lerp(new Color(), this.baseCard(order), this.lateColor, 0.35 + 0.65 * pulse);
            order.timerLabel.node.setScale(1 + 0.15 * pulse, 1 + 0.15 * pulse, 1);
        } else if (t / order.plan.deliverTime <= this.warnRatio) {
            order.timerLabel.color = t / order.plan.deliverTime <= this.warnRatio / 2 ? this.badColor : this.warnColor;
            order.bg.color = this.baseCard(order);
        } else {
            order.timerLabel.color = Color.WHITE;
            order.bg.color = this.baseCard(order);
        }
    }

    /** Empilha os cartoes de cima para baixo, animando a reacomodacao. Com muitos pedidos, todos encolhem para caber. */
    private layoutCards(animate: boolean) {
        if (Responsive.portrait) { this.layoutCardsFlow(animate); return; }
        const total = this.usedHeight();
        const areaH = this.cardsAreaHeight + Math.max(0, Responsive.height - Responsive.LAND_H);
        const newScale = total > areaH ? Math.max(0.5, areaH / total) : 1;
        const rescaled = Math.abs(newScale - this.cardScale) > 0.001;
        this.cardScale = newScale;
        const cs = this.cardScale;

        let y = this.titleLocalY() - 30;
        for (const o of this.active) {
            const h = o.height * cs;
            const target = y - h / 2;
            const pos = o.node.position;
            if (rescaled && !o.delivered) this.applyCardScale(o, cs);
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

    /** Novo tamanho dos cartoes. Cartao que ainda esta aparecendo (escala 0) refaz a animacao de entrada ate o tamanho novo, senao ficaria no antigo e sobreporia os vizinhos. */
    private applyCardScale(o: OrderView, s: number) {
        Tween.stopAllByTarget(o.node);
        if (o.node.scale.x > 0) { o.node.setScale(s, s, 1); return; }
        tween(o.node).to(0.25, { scale: new Vec3(s, s, 1) }, { easing: 'backOut' }).start();
    }

    /** Retrato: cartoes lado a lado, quebrando em linhas; todos encolhem para caber na faixa de pedidos. */
    private layoutCardsFlow(animate: boolean) {
        const m = Responsive.portraitMetrics();
        const areaW = 700, areaH = m.ordersH, gap = 8;
        const orders = this.active;
        const w = this.cardWidth;

        const plan = (scale: number) => {
            const rows: { items: OrderView[], width: number, height: number }[] = [];
            let row = { items: [] as OrderView[], width: 0, height: 0 };
            for (const o of orders) {
                const cw = w * scale;
                const ch = o.height * scale;
                if (row.items.length > 0 && row.width + gap + cw > areaW) {
                    rows.push(row);
                    row = { items: [], width: 0, height: 0 };
                }
                row.width += (row.items.length > 0 ? gap : 0) + cw;
                row.height = Math.max(row.height, ch);
                row.items.push(o);
            }
            if (row.items.length > 0) rows.push(row);
            const total = rows.reduce((t, r) => t + r.height, 0) + Math.max(0, rows.length - 1) * gap;
            return { rows, total };
        };

        let scale = 1;
        let layout = plan(scale);
        while (layout.total > areaH && scale > 0.45) {
            scale = Math.max(0.45, scale - 0.05);
            layout = plan(scale);
        }
        const rescaled = Math.abs(scale - this.cardScale) > 0.001;
        this.cardScale = scale;

        let y = -30;
        for (const row of layout.rows) {
            let x = -row.width / 2;
            for (const o of row.items) {
                const cw = w * scale;
                const targetX = x + cw / 2;
                const targetY = y - row.height / 2;
                if (rescaled && !o.delivered) this.applyCardScale(o, scale);
                const pos = o.node.position;
                const isNew = pos.y === 0 && pos.x === 0;
                if (animate && o.node.activeInHierarchy && !isNew && o.node.scale.x > 0
                    && (Math.abs(pos.x - targetX) > 0.5 || Math.abs(pos.y - targetY) > 0.5)) {
                    tween(o.node).to(0.2, { position: new Vec3(targetX, targetY, 0) }, { easing: 'quadOut' }).start();
                } else {
                    o.node.setPosition(targetX, targetY, 0);
                }
                x += cw + gap;
            }
            y -= row.height + gap;
        }
    }
}
