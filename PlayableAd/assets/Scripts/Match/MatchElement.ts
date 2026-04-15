import { _decorator, Component, Button, Sprite, Enum, Vec3, tween, Tween, Node, AudioSource, Sorting2D } from 'cc';
const { ccclass, property } = _decorator;

import { MatchSlots } from './MatchSlots';
import { ElementType } from './ElementType';
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
        if (!this.isAvailable) return;

        this.isAvailable = false;

        this.SetSortingOrder(3);

        if (this.selectionAudio) {
            this.selectionAudio.play();
        }

        if (this.matchSlots) {
            this.currentSlot = this.matchSlots.AssignSlot(this);
            if (this.currentSlot) {
                const targetWorldPos = new Vec3();
                this.currentSlot.getWorldPosition(targetWorldPos);

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
            }
        }

        if (this.matchController) {
            this.matchController.onElementClicked(this);
        }
    }

    public MoveToSlot(slot: Node) {
        this.currentSlot = slot;
        this.hasReachedSlot = false;

        const targetWorldPos = new Vec3();
        slot.getWorldPosition(targetWorldPos);

        const targetLocalPos = new Vec3();
        if (this.node.parent) {
            this.node.parent.inverseTransformPoint(targetLocalPos, targetWorldPos);
        }

        tween(this.node)
            .to(0.3, { position: targetLocalPos })
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

        if (isMiddle) {
            const overshootScale = this.selectedScale.clone().multiplyScalar(1.4);

            tween(this.node)
                .to(0.15, { scale: overshootScale }, { easing: 'backOut' })
                .delay(0.15)
                .to(0.15, { scale: Vec3.ZERO })
                .call(() => {
                    this.node.destroy();
                })
                .start();
        } else {
            tween(this.node)
                .to(0.3, { position: mergePosition, scale: Vec3.ZERO })
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
