import { SoundManager } from './SoundManager';
import { GoldenTime } from './GoldenTime';
import { _decorator, Component, Button, Sprite, Enum, Vec3, tween, Tween, Node, AudioSource, Sorting2D, Color, EventTouch, UITransform } from 'cc';
const { ccclass, property } = _decorator;

import { MatchSlots } from './MatchSlots';
import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { MatchController } from './MatchController';
import { GameManager } from './GameManager';
import { OrderManager } from './OrderManager';

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

    @property(MatchSlots)
    public matchSlots: MatchSlots = null!;

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
    public currentSlot: Node | null = null;
    private movementDuration: number = 0;
    public hasReachedSlot: boolean = false;
    private boardPosition: Vec3 | null = null;
    private isRejecting: boolean = false;

    // ---------- Arrastar ----------
    @property({ tooltip: 'Distancia (px) de arraste a partir da qual o toque vira um arrasto (abaixo disso e um toque simples).' })
    public dragThreshold: number = 8;

    @property({ tooltip: 'Escala do item enquanto e arrastado.' })
    public dragScale: number = 1.2;

    // ---------- Reforco visual: item errado parado na prateleira ----------
    @property({ tooltip: 'Segundos que um item errado (que nenhum pedido pede) pode ficar na prateleira antes de comecar a pulsar.' })
    public wrongPulseDelay: number = 3;

    @property({ tooltip: 'Amplitude da pulsacao (fracao da escala) do item errado.' })
    public wrongPulseAmount: number = 0.25;

    @property({ tooltip: 'Velocidade (rad/s) da pulsacao do item errado.' })
    public wrongPulseSpeed: number = 9;

    private wrongTime: number = 0;
    private wrongNow: boolean = false;
    private wrongCheck: number = 0;
    private pulsing: boolean = false;
    private pulseClock: number = 0;
    private merging: boolean = false;
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
        if (!this.hasReachedSlot) {
            if (!this.spawnAnimated) this.node.setScale(this.availableScale);
            this.SetSortingOrder(this.defaultSortingOrder);
        }

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
        return this.isAvailable && !this.hasReachedSlot && !this.isRejecting;
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

        // Arrastado: so seleciona se foi solto em cima da area dos selecionados; no board, apenas muda de lugar.
        if (this.isOverTray()) {
            this.wiggleOrigin = origin;
            this.OnClick();
            this.wiggleOrigin = null;
            if (this.isAvailable) {
                // Nao foi selecionado (prateleira cheia, tutorial...): volta ao lugar de onde saiu.
                Tween.stopAllByTarget(this.node);
                this.isRejecting = false; // o tremor de rejeicao foi interrompido
                this.SetSortingOrder(this.defaultSortingOrder);
                tween(this.node)
                    .to(0.18, { position: origin, scale: this.availableScale }, { easing: 'cubicOut' })
                    .start();
            } else {
                // Selecionado: se for devolvido ao tabuleiro, volta ao lugar de origem (nao ao ponto onde soltou).
                this.boardPosition = origin;
            }
        } else {
            this.dropOnBoard();
        }
    }

    /** O centro do item esta sobre a area dos encaixes (selecionados)? */
    private isOverTray(): boolean {
        const slots = this.matchSlots ? this.matchSlots.slots : null;
        if (!slots || slots.length === 0) return false;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        slots.forEach(n => {
            const p = n.worldPosition;
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const margin = 70;
        const w = this.node.worldPosition;
        return w.x >= minX - margin && w.x <= maxX + margin && w.y >= minY - margin && w.y <= maxY + margin;
    }

    /** Solto no tabuleiro: fica onde foi largado (dentro da area do tabuleiro), sem ser selecionado. */
    private dropOnBoard() {
        const parent = this.node.parent;
        const ut = parent ? parent.getComponent(UITransform) : null;
        const p = this.node.position;
        let x = p.x, y = p.y;
        if (ut) {
            const inset = 90;
            const halfW = Math.max(0, ut.width - inset) / 2, halfH = Math.max(0, ut.height - inset) / 2;
            const cx = (0.5 - ut.anchorX) * ut.width, cy = (0.5 - ut.anchorY) * ut.height;
            x = Math.max(cx - halfW, Math.min(cx + halfW, x));
            y = Math.max(cy - halfH, Math.min(cy + halfH, y));
        }
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
            if (!el || el === this || !el.isAvailable || el.merging || el.isRejecting || el.dragging) return;
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

        if (!this.isAvailable) {
            this.TryReturnToBoard();
            return;
        }

        // Reserva o slot antes de alterar qualquer estado: com a prateleira cheia o clique e rejeitado.
        const slot = this.matchSlots ? this.matchSlots.AssignSlot(this) : null;
        if (!slot) {
            this.PlayRejectedFeedback();
            return;
        }

        // Power-up Focus pode ter deixado o item pulsando/escurecido: limpa antes de mover para a prateleira.
        this.cancelWiggle();
        Tween.stopAllByTarget(this.node);
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) sprite.color = Color.WHITE;

        this.isAvailable = false;
        this.boardPosition = this.node.position.clone();
        this.currentSlot = slot;
        // Os vizinhos se acomodam (ao arrastar, a partir do ponto de origem do item, ja que ele sai de la).
        this.wiggleNeighbors(this.wiggleOrigin || this.boardPosition);

        this.SetSortingOrder(3);

        if (this.selectionAudio) {
            this.selectionAudio.play();
        }

        const targetWorldPos = new Vec3();
        slot.getWorldPosition(targetWorldPos);

        const currentWorldPos = new Vec3();
        this.node.getWorldPosition(currentWorldPos);

        const targetLocalPos = new Vec3();
        if (this.node.parent) {
            this.node.parent.inverseTransformPoint(targetLocalPos, targetWorldPos);
        }

        const distance = Vec3.distance(currentWorldPos, targetWorldPos);
        this.movementDuration = distance / this.moveSpeed;

        tween(this.node)
            .to(this.movementDuration, { position: targetLocalPos, scale: this.selectedScale })
            .call(() => {
                this.hasReachedSlot = true;
                // Primeiro a logica (o merge depende dela), depois o som.
                if (this.matchController) {
                    this.matchController.onElementReachedSlot(this);
                }
                SoundManager.playAttach();
            })
            .start();

        if (this.matchController) {
            this.matchController.onElementClicked(this);
        }
    }

    /** Prateleira cheia: balanca o item sem registra-lo como selecionado. */
    private PlayRejectedFeedback() {
        if (this.isRejecting) return;
        this.cancelWiggle();
        this.isRejecting = true;
        SoundManager.playBlocked();
        const origin = this.node.position.clone();
        tween(this.node)
            .to(0.04, { position: new Vec3(origin.x - 8, origin.y, origin.z) })
            .to(0.08, { position: new Vec3(origin.x + 8, origin.y, origin.z) })
            .to(0.04, { position: origin })
            .call(() => { this.isRejecting = false; })
            .start();
    }

    /** Devolve um item que esta na prateleira (e ainda nao entrou em um merge) para sua posicao no board. */
    private TryReturnToBoard() {
        const gm = GameManager.instance;
        if (gm && !gm.IsRunning()) return;
        if (!this.hasReachedSlot || !this.boardPosition || !this.currentSlot) return;
        if (!this.matchController || this.matchController.selectedElements.indexOf(this) === -1) return;

        const slots = this.matchSlots;
        slots.ReleaseSlot(this.currentSlot);
        this.currentSlot = null;
        this.hasReachedSlot = false;
        this.matchController.onElementReturned(this);
        SoundManager.playRemovedFromSelected();

        Tween.stopAllByTarget(this.node);
        this.SetSortingOrder(3);
        const distance = Vec3.distance(this.node.position, this.boardPosition);
        const duration = Math.max(0.15, distance / this.moveSpeed);
        tween(this.node)
            .to(duration, { position: this.boardPosition, scale: this.availableScale }, { easing: 'cubicOut' })
            .call(() => {
                this.isAvailable = true;
                this.SetSortingOrder(this.defaultSortingOrder);
            })
            .start();

        slots.CompactSlots();
    }

    public MoveToSlot(slot: Node) {
        this.cancelWiggle();
        this.currentSlot = slot;
        this.hasReachedSlot = false;
        Tween.stopAllByTarget(this.node);

        const targetWorldPos = new Vec3();
        slot.getWorldPosition(targetWorldPos);

        const targetLocalPos = new Vec3();
        if (this.node.parent) {
            this.node.parent.inverseTransformPoint(targetLocalPos, targetWorldPos);
        }

        tween(this.node)
            .to(0.3, { position: targetLocalPos, scale: this.selectedScale })
            .call(() => {
                this.hasReachedSlot = true;
                if (this.matchController) {
                    this.matchController.onElementReachedSlot(this);
                }
            })
            .start();
    }

    public ForceSetInSlot(slot: Node) {
        this.isAvailable = false;
        this.boardPosition = this.node.position.clone();
        this.currentSlot = slot;
        this.hasReachedSlot = true;

        const targetWorldPos = new Vec3();
        slot.getWorldPosition(targetWorldPos);

        const targetLocalPos = new Vec3();
        if (this.node.parent) {
            this.node.parent.inverseTransformPoint(targetLocalPos, targetWorldPos);
        }

        this.node.setPosition(targetLocalPos);
        this.node.setScale(this.selectedScale);
        this.SetSortingOrder(3);

        if (this.matchController) {
            this.matchController.onElementClicked(this);
            this.matchController.onElementReachedSlot(this);
        }
    }

    public getMovementDuration(): number {
        return this.movementDuration;
    }

    public Merge(targetSlot: Node | null = null, isMiddle: boolean = false) {
        this.cancelWiggle();
        this.merging = true;
        this.StopWrongPulse(false);
        if (this.currentSlot && this.matchSlots) {
            this.matchSlots.ReleaseSlot(this.currentSlot);
            this.currentSlot = null;
        }

        if (isMiddle) {
            this.SetSortingOrder(4);
        } else {
            this.SetSortingOrder(3);
        }

        let mergePosition = this.mergedPosition;

        if (targetSlot) {
            const targetWorldPos = new Vec3();
            targetSlot.getWorldPosition(targetWorldPos);

            mergePosition = new Vec3();
            if (this.node.parent) {
                this.node.parent.inverseTransformPoint(mergePosition, targetWorldPos);
            }
        }

        const pull = this.mergePullDuration;

        if (isMiddle) {
            // Centro: cresce e vibra enquanto os outros sao atraidos, e explode no impacto.
            const buildUp = this.selectedScale.clone().multiplyScalar(this.mergeBuildUpScale);
            const impact = this.selectedScale.clone().multiplyScalar(this.mergeImpactScale);

            tween(this.node)
                .parallel(
                    tween().to(pull, { scale: buildUp }, { easing: 'sineOut' }),
                    tween()
                        .to(pull * 0.25, { eulerAngles: new Vec3(0, 0, 8) })
                        .to(pull * 0.5, { eulerAngles: new Vec3(0, 0, -8) })
                        .to(pull * 0.25, { eulerAngles: new Vec3(0, 0, 0) })
                )
                .to(0.07, { scale: impact }, { easing: 'backOut' })
                .to(0.12, { scale: Vec3.ZERO }, { easing: 'quadIn' })
                .call(() => {
                    this.node.destroy();
                })
                .start();
        } else {
            // Laterais: recuam um pouco (antecipacao) e sao sugadas para o centro, acelerando.
            const start = this.node.position.clone();
            const dir = new Vec3();
            Vec3.subtract(dir, start, mergePosition);
            dir.z = 0;
            if (dir.lengthSqr() > 0.0001) dir.normalize();
            const windUp = new Vec3(start.x + dir.x * this.mergeWindUpDistance, start.y + dir.y * this.mergeWindUpDistance, start.z);
            const windUpScale = this.selectedScale.clone().multiplyScalar(1.1);
            const endScale = this.selectedScale.clone().multiplyScalar(0.6);

            tween(this.node)
                .to(0.08, { position: windUp, scale: windUpScale }, { easing: 'sineOut' })
                .to(pull - 0.08, { position: mergePosition, scale: endScale }, { easing: 'cubicIn' })
                .call(() => {
                    this.node.destroy();
                })
                .start();
        }
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

    /** Na prateleira, quieto, e nenhum pedido aberto pede este alimento (e ele nao esta num merge). */
    private isWrongSelection(): boolean {
        const gm = GameManager.instance;
        if (!gm || !gm.IsRunning() || this.merging || !this.matchController) return false;
        if (this.matchController.isInPendingMerge(this)) return false;
        const orders = OrderManager.instance;
        return !!orders && orders.NextQuantityFor(this.type) === 0;
    }

    private StopWrongPulse(restoreScale: boolean) {
        if (!this.pulsing) return;
        this.pulsing = false;
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) sprite.color = Color.WHITE;
        if (restoreScale && this.node.isValid) this.node.setScale(this.selectedScale);
    }

    update(deltaTime: number) {
        this.updateWiggle(deltaTime);
        const inTray = !this.isAvailable && this.hasReachedSlot && !this.merging;
        if (!inTray) {
            // Saiu da prateleira (voltou ao tabuleiro, esta se movendo ou entrou em merge): zera o relogio.
            this.wrongTime = 0;
            this.wrongNow = false;
            this.StopWrongPulse(false);
            return;
        }

        this.wrongCheck -= deltaTime;
        if (this.wrongCheck <= 0) {
            this.wrongCheck = 0.2;
            this.wrongNow = this.isWrongSelection();
        }
        if (!this.wrongNow) {
            this.wrongTime = 0;
            this.StopWrongPulse(true);
            return;
        }

        this.wrongTime += deltaTime;
        if (this.wrongTime < this.wrongPulseDelay) return;

        // Pulsa (escala + tom avermelhado) ate o jogador remover o item ou um pedido passar a pedi-lo.
        if (!this.pulsing) {
            this.pulsing = true;
            this.pulseClock = 0;
            Tween.stopAllByTarget(this.node);
        }
        this.pulseClock += deltaTime;
        const k = 0.5 + 0.5 * Math.sin(this.pulseClock * this.wrongPulseSpeed);
        const s = 1 + this.wrongPulseAmount * k;
        this.node.setScale(this.selectedScale.x * s, this.selectedScale.y * s, this.selectedScale.z);
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) sprite.color = new Color(255, Math.round(255 - 130 * k), Math.round(255 - 130 * k), 255);
    }
}
