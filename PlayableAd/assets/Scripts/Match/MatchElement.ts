import { _decorator, Component, Button, Sprite, Enum, Vec3, tween, Tween, Node, AudioSource, Sorting2D, Color } from 'cc';
const { ccclass, property } = _decorator;

import { MatchSlots } from './MatchSlots';
import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { MatchController } from './MatchController';
import { GameManager } from './GameManager';

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

    /** Define o tipo e o sprite do item (um unico prefab serve para todos os alimentos). */
    public Setup(type: ElementType, maxSize: number = 90) {
        this.type = type;
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) ElementCatalog.applyFitted(sprite, type, maxSize);
    }

    start() {
        if (!this.hasReachedSlot) {
            this.node.setScale(this.availableScale);
            this.SetSortingOrder(this.defaultSortingOrder);
        }

        if (this.buttonComponent) {
            this.buttonComponent.node.on(Button.EventType.CLICK, this.OnClick, this);
        }
    }

    OnClick() {
        if (GameManager.instance && !GameManager.instance.IsRunning() && !GameManager.instance.IsTutorialRunning()) return;
        // Tutorial guiado: os demais itens ficam bloqueados ate o passo terminar.
        const allowed = GameManager.instance ? GameManager.instance.tutorialAllowed : null;
        if (allowed && allowed.indexOf(this) === -1) {
            if (this.isAvailable) this.PlayRejectedFeedback();
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
        Tween.stopAllByTarget(this.node);
        const sprite = this.spriteComponent || this.getComponent(Sprite);
        if (sprite) sprite.color = Color.WHITE;

        this.isAvailable = false;
        this.boardPosition = this.node.position.clone();
        this.currentSlot = slot;

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
                if (this.matchController) {
                    this.matchController.onElementReachedSlot(this);
                }
            })
            .start();

        if (this.matchController) {
            this.matchController.onElementClicked(this);
        }
    }

    /** Prateleira cheia: balanca o item sem registra-lo como selecionado. */
    private PlayRejectedFeedback() {
        if (this.isRejecting) return;
        this.isRejecting = true;
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

    update(deltaTime: number) {
    }
}
