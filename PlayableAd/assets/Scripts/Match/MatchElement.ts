import { SoundManager } from './SoundManager';
import { GoldenTime } from './GoldenTime';
import { _decorator, Component, Button, Sprite, Enum, Vec3, tween, Tween, Node, AudioSource, Sorting2D, Color, EventTouch, UITransform, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { MatchController } from './MatchController';
import { GameManager } from './GameManager';
import { OrderManager, OrderClaim } from './OrderManager';
import { PowerupManager } from './PowerupManager';

@ccclass('MatchElement')
export class MatchElement extends Component {

    @property(Button)
    public buttonComponent: Button = null!;

    @property(Sprite)
    public spriteComponent: Sprite = null!;

    @property({ type: ElementType })
    public type: ElementType = ElementType.Hamburguer;

    @property(Vec3)
    public availableScale: Vec3 = new Vec3(1, 1, 1);

    @property(Vec3)
    public selectedScale: Vec3 = new Vec3(1.2, 1.2, 1.2);

    @property(Vec3)
    public mergedScale: Vec3 = new Vec3(0, 0, 0);

    @property(Vec3)
    public mergedPosition: Vec3 = new Vec3(0, 0, 0);

    @property(MatchController)
    public matchController: MatchController = null!;

    @property
    public moveSpeed: number = 500;

    @property({ tooltip: 'Duracao (s) da atracao dos elementos ate o centro no merge.' })
    public mergePullDuration: number = 0.28;

    @property({ tooltip: 'Distancia (px) do recuo de antecipacao dos elementos laterais.' })
    public mergeWindUpDistance: number = 18;

    @property({ tooltip: 'Multiplicador de escala do elemento central enquanto os outros chegam.' })
    public mergeBuildUpScale: number = 1.25;

    @property({ tooltip: 'Multiplicador de escala do elemento central no impacto.' })
    public mergeImpactScale: number = 1.7;

    @property(AudioSource)
    public selectionAudio: AudioSource | null = null;

    @property(Sorting2D)
    public sorting2D: Sorting2D = null!;

    @property
    public defaultSortingOrder: number = 1;

    public isAvailable: boolean = true;
    private isRejecting: boolean = false;

    // ---------- Arrastar ----------
    @property({ tooltip: 'Distancia (px) de arraste a partir da qual o toque vira um arrasto (abaixo disso e um toque simples).' })
    public dragThreshold: number = 8;

    @property({ tooltip: 'Escala do item enquanto e arrastado.' })
    public dragScale: number = 1.2;

    /** A entrada do item e animada por fora (burst de troca de fase): o start() nao forca a escala. */
    public spawnAnimated: boolean = false;

    // ---------- Vizinhos se acomodando (ao selecionar um item) ----------
    private wiggleT: number = -1;
    private wiggleDir: Vec3 = new Vec3();
    private wiggleAmp: number = 0;
    private wiggleApplied: Vec3 = new Vec3();
    private wiggleAppliedRot: number = 0;
    /** Ponto de onde o item saiu ao ser selecionado por arrasto (os vizinhos se acomodam em torno dele). */
    private wiggleOrigin: Vec3 | null = null;

    private touchId: number = -1;
    private dragging: boolean = false;
    private clickedOnStart: boolean = false;
    private dragMoved: number = 0;
    private dragOrigin: Vec3 | null = null;

    /** Define o tipo e o sprite do item (um unico prefab serve para todos os alimentos). */
    public Setup(type: ElementType, maxSize: number = 90) {
        this.type = type;
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) ElementCatalog.applyFitted(sprite, type, maxSize);
    }

    start() {
        if (!this.spawnAnimated) this.node.setScale(this.availableScale);
        this.SetSortingOrder(this.defaultSortingOrder);

        // O Button so dispara o clique se o toque soltar em cima do mesmo item; aqui o toque e tratado por inteiro:
        // o item pressionado (e arrastado) e o que fica selecionado ao soltar, esteja o dedo onde estiver.
        if (this.buttonComponent) this.buttonComponent.enabled = false;
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy() {
        if (this.node && this.node.isValid) this.node.targetOff(this);
    }

    /** Pode comecar a arrastar este item agora? (partida rodando, item no tabuleiro e liberado pelo tutorial) */
    private canDrag(): boolean {
        const gm = GameManager.instance;
        if (this.inTutorial()) return false;
        if (gm && !gm.IsRunning() && !gm.IsTutorialRunning()) return false;
        const allowed = gm ? gm.tutorialAllowed : null;
        if (allowed && allowed.indexOf(this) === -1) return false;
        if (GoldenTime.active) return false;
        return this.isAvailable && !this.isRejecting;
    }

    /** Tutorial em andamento (intro ou passo guiado): sem arrastar, o simples toque ja seleciona. */
    private inTutorial(): boolean {
        const gm = GameManager.instance;
        return !!gm && (gm.IsTutorialRunning() || gm.tutorialAllowed !== null);
    }

    private onTouchStart(event: EventTouch) {
        if (this.touchId !== -1) return;
        this.touchId = event.getID();
        this.dragging = false;
        this.dragMoved = 0;
        this.clickedOnStart = false;
        if (this.inTutorial()) {
            this.clickedOnStart = true;
            this.dragOrigin = null;
            this.OnClick();
            return;
        }
        this.dragOrigin = this.canDrag() ? this.node.position.clone() : null;
    }

    private onTouchMove(event: EventTouch) {
        if (event.getID() !== this.touchId || !this.dragOrigin) return;
        const d = event.getUIDelta();
        this.dragMoved += Math.hypot(d.x, d.y);
        if (!this.dragging) {
            if (this.dragMoved < this.dragThreshold) return;
            // Comeca o arrasto: o item sobe para a frente de todos e cresce um pouco.
            this.dragging = true;
            this.cancelWiggle();
            Tween.stopAllByTarget(this.node);
            this.SetSortingOrder(6);
            this.node.setScale(this.dragScale, this.dragScale, 1);
            this.node.setSiblingIndex(this.node.parent ? this.node.parent.children.length - 1 : 0);
        }
        // O delta vem em unidades de tela; o pai (tabuleiro) pode estar com escala.
        const k = this.node.parent ? this.node.parent.worldScale.x || 1 : 1;
        const p = this.node.position;
        this.node.setPosition(p.x + d.x / k, p.y + d.y / k, p.z);
    }

    private onTouchEnd(event: EventTouch) {
        if (event.getID() !== this.touchId) return;
        this.touchId = -1;
        const origin = this.dragOrigin;
        const wasDragged = this.dragging;
        this.dragging = false;
        this.dragOrigin = null;

        // Soltar fora do item sem ter arrastado nao e um clique (igual ao Button).
        if (event.type === Node.EventType.TOUCH_CANCEL && !wasDragged) return;

        if (this.clickedOnStart) { this.clickedOnStart = false; return; }
        if (!wasDragged) {
            this.OnClick(); // toque simples: seleciona
            return;
        }
        if (!origin) return;

        // Arrastado: so seleciona se foi solto em cima de um pedido; no board, apenas muda de lugar.
        if (this.isOverOrders()) {
            this.wiggleOrigin = origin;
            this.OnClick();
            this.wiggleOrigin = null;
            if (this.isAvailable) {
                // Nao foi selecionado (nenhum pedido pede o alimento, tutorial...): volta ao lugar de onde saiu.
                Tween.stopAllByTarget(this.node);
                this.isRejecting = false; // o tremor de rejeicao foi interrompido
                this.SetSortingOrder(this.defaultSortingOrder);
                tween(this.node)
                    .to(0.18, { position: origin, scale: this.availableScale }, { easing: 'cubicOut' })
                    .start();
            }
        } else {
            this.dropOnBoard();
        }
    }

    private clampToBoard(p: Vec3): Vec3 {
        const parent = this.node.parent;
        const ut = parent ? parent.getComponent(UITransform) : null;
        let x = p.x, y = p.y;
        if (ut) {
            const inset = 90;
            const halfW = Math.max(0, ut.width - inset) / 2, halfH = Math.max(0, ut.height - inset) / 2;
            const cx = (0.5 - ut.anchorX) * ut.width, cy = (0.5 - ut.anchorY) * ut.height;
            x = Math.max(cx - halfW, Math.min(cx + halfW, x));
            y = Math.max(cy - halfH, Math.min(cy + halfH, y));
        }
        return new Vec3(x, y, p.z);
    }

    /** O centro do item esta sobre um cartao de pedido (soltar ali tambem seleciona)? */
    private isOverOrders(): boolean {
        const orders = OrderManager.instance;
        return !!orders && orders.isOverCard(this.node.worldPosition);
    }

    /** Solto no tabuleiro: fica onde foi largado (dentro da area do tabuleiro), sem ser selecionado. */
    private dropOnBoard() {
        const parent = this.node.parent;
        const p = this.node.position;
        const { x, y } = this.clampToBoard(p);
        Tween.stopAllByTarget(this.node);
        // Fica na frente dos demais itens do tabuleiro (ordem acima do padrao e por ultimo na hierarquia).
        this.SetSortingOrder(this.defaultSortingOrder + 1);
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);
        tween(this.node)
            .to(0.12, { position: new Vec3(x, y, p.z), scale: this.availableScale }, { easing: 'quadOut' })
            .start();
    }

    // ---------- Vizinhos se acomodando ----------

    /** Ao selecionar um item, os vizinhos no tabuleiro se afastam um pouco e voltam (como se reorganizando). */
    private wiggleNeighbors(origin: Vec3) {
        const parent = this.node.parent;
        if (!parent) return;
        const radius = 190;
        parent.children.forEach(c => {
            const el = c.getComponent(MatchElement);
            if (!el || el === this || !el.isAvailable || el.isRejecting || el.dragging) return;
            const dx = c.position.x - origin.x, dy = c.position.y - origin.y;
            const d = Math.hypot(dx, dy);
            if (d > radius) return;
            el.startWiggle(d < 1 ? 1 : dx / d, d < 1 ? 0 : dy / d, 5 + 13 * (1 - d / radius));
        });
    }

    private startWiggle(dx: number, dy: number, amp: number) {
        this.cancelWiggle();
        this.wiggleDir.set(dx, dy, 0);
        this.wiggleAmp = amp;
        this.wiggleT = 0;
    }

    /** Desfaz o deslocamento do balanco (o item volta exatamente ao lugar de antes). */
    private cancelWiggle() {
        if (this.wiggleT < 0) return;
        this.wiggleT = -1;
        if (this.node && this.node.isValid) {
            const p = this.node.position;
            this.node.setPosition(p.x - this.wiggleApplied.x, p.y - this.wiggleApplied.y, p.z);
            this.node.setRotationFromEuler(0, 0, this.node.eulerAngles.z - this.wiggleAppliedRot);
        }
        this.wiggleApplied.set(0, 0, 0);
        this.wiggleAppliedRot = 0;
    }

    private updateWiggle(dt: number) {
        if (this.wiggleT < 0) return;
        this.wiggleT += dt;
        const p = this.wiggleT / 0.5;
        if (p >= 1) { this.cancelWiggle(); return; }
        // Afasta e volta com uma pequena oscilacao no fim.
        const f = Math.sin(Math.PI * p) * (1 - 0.35 * Math.sin(Math.PI * 2 * p));
        const nx = this.wiggleDir.x * this.wiggleAmp * f, ny = this.wiggleDir.y * this.wiggleAmp * f;
        const rot = (this.wiggleDir.x >= 0 ? 1 : -1) * 4 * Math.sin(Math.PI * 2 * p);
        const pos = this.node.position;
        this.node.setPosition(pos.x + nx - this.wiggleApplied.x, pos.y + ny - this.wiggleApplied.y, pos.z);
        this.node.setRotationFromEuler(0, 0, this.node.eulerAngles.z + rot - this.wiggleAppliedRot);
        this.wiggleApplied.set(nx, ny, 0);
        this.wiggleAppliedRot = rot;
    }

    OnClick() {
        if (GameManager.instance && !GameManager.instance.IsRunning() && !GameManager.instance.IsTutorialRunning()) return;
        // Tutorial guiado: os demais itens ficam bloqueados ate o passo terminar.
        const allowed = GameManager.instance ? GameManager.instance.tutorialAllowed : null;
        if (allowed && allowed.indexOf(this) === -1) {
            if (this.isAvailable) this.PlayRejectedFeedback();
            return;
        }

        // Golden Time: o alimento virou moeda; tocar nele o coleta (vale para qualquer pedido, em dobro).
        if (GoldenTime.active && this.isAvailable) {
            GoldenTime.collect(this);
            return;
        }

        if (!this.isAvailable) return;

        // O alimento vai direto para o pedido (o 1o da tela que ainda o pede). Nenhum pedido pede: feedback negativo.
        const orders = OrderManager.instance;
        const claim = orders ? orders.TryAssign(this.type) : null;
        if (!claim) {
            this.PlayRejectedFeedback();
            return;
        }

        // Power-up Focus pode ter deixado o item pulsando/escurecido: limpa antes de voar.
        this.cancelWiggle();
        Tween.stopAllByTarget(this.node);
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) sprite.color = Color.WHITE;

        this.isAvailable = false;
        const origin = this.node.position.clone();
        // Os vizinhos se acomodam (ao arrastar, a partir do ponto de origem do item, ja que ele sai de la).
        this.wiggleNeighbors(this.wiggleOrigin || origin);
        this.SetSortingOrder(40); // voa por cima dos cartoes

        if (this.selectionAudio) this.selectionAudio.play();
        if (this.matchController) this.matchController.onElementClicked(this);
        this.flyToOrder(claim);
    }

    /** O alimento voa ate o icone da linha no cartao, encolhendo; ao chegar, o progresso do pedido sobe. */
    private flyToOrder(claim: OrderClaim) {
        const orders = OrderManager.instance;
        const node = this.node;
        const startPos = node.worldPosition.clone();
        const startScale = node.scale.clone();
        const endScale = new Vec3(startScale.x * 0.4, startScale.y * 0.4, 1);
        let target = orders ? orders.GetLineTarget(claim) : null;
        if (!target) target = startPos.clone();
        const dist = Vec3.distance(startPos, target);
        const dur = Math.max(0.28, Math.min(0.55, dist / (this.moveSpeed * 1.6)));
        const state = { t: 0 };
        const cur = new Vec3();
        tween(state)
            .to(dur, { t: 1 }, {
                easing: 'quadIn',
                onUpdate: () => {
                    if (!node.isValid) return;
                    const live = orders ? orders.GetLineTarget(claim) : null; // o cartao pode estar se mexendo
                    if (live) target = live;
                    Vec3.lerp(cur, startPos, target!, state.t);
                    node.setWorldPosition(cur);
                    node.setScale(startScale.x + (endScale.x - startScale.x) * state.t, startScale.y + (endScale.y - startScale.y) * state.t, 1);
                },
            })
            .call(() => {
                SoundManager.playAttach();
                orders?.OnItemArrived(claim);
                if (node.isValid) node.destroy();
            })
            .start();
    }

    /** Nenhum pedido pede este alimento: feedback negativo bem visivel (tremor, vermelho, X e som). */
    private PlayRejectedFeedback() {
        if (this.isRejecting) return;
        this.cancelWiggle();
        this.isRejecting = true;
        SoundManager.playWrongClick();
        const origin = this.node.position.clone();
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) sprite.color = new Color(255, 70, 70, 255);
        this.showWrongMark();
        const s = this.availableScale;
        tween(this.node)
            .to(0.05, { position: new Vec3(origin.x - 12, origin.y, origin.z), scale: new Vec3(s.x * 1.18, s.y * 1.18, 1) })
            .to(0.08, { position: new Vec3(origin.x + 12, origin.y, origin.z) })
            .to(0.08, { position: new Vec3(origin.x - 9, origin.y, origin.z) })
            .to(0.06, { position: new Vec3(origin.x + 6, origin.y, origin.z) })
            .to(0.08, { position: origin, scale: s.clone() })
            .call(() => {
                this.isRejecting = false;
                if (sprite && this.isAvailable) sprite.color = Color.WHITE;
            })
            .start();
    }

    /** Um X vermelho grande (duas barras cruzadas) sobre o item, que cresce e some. */
    private showWrongMark() {
        const frame = PowerupManager.instance ? PowerupManager.instance.dimFrame : null;
        if (!frame || !this.node.parent) return;
        const holder = new Node('WrongMark');
        holder.layer = this.node.layer;
        holder.parent = this.node.parent;
        holder.setPosition(this.node.position.x, this.node.position.y, 0);
        const op = holder.addComponent(UIOpacity);
        [45, -45].forEach(angle => {
            [[86, 20, new Color(255, 255, 255, 255)], [76, 12, new Color(235, 30, 30, 255)]].forEach(([len, thick, color]: any, i) => {
                const bar = new Node('Bar');
                bar.layer = holder.layer;
                bar.parent = holder;
                bar.setRotationFromEuler(0, 0, angle);
                bar.addComponent(UITransform).setContentSize(len, thick);
                const sp = bar.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = frame;
                sp.color = color;
                bar.addComponent(Sorting2D).sortingOrder = 45 + i;
            });
        });
        holder.setScale(0.3, 0.3, 1);
        tween(holder).to(0.12, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' }).to(0.08, { scale: Vec3.ONE })
            .delay(0.28).call(() => { if (holder.isValid) holder.destroy(); }).start();
        tween(op).delay(0.3).to(0.18, { opacity: 0 }).start();
    }

    public SetSortingOrder(order: number) {
        if (this.sorting2D) {
            this.sorting2D.sortingOrder = order;
        } else {
            const sorting = this.getComponent(Sorting2D);
            if (sorting) {
                sorting.sortingOrder = order;
            }
        }
    }

    update(deltaTime: number) {
        this.updateWiggle(deltaTime);
    }
}
