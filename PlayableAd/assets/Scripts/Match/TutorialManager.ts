import { _decorator, Component, Node, Vec3, find, director } from 'cc';
const { ccclass, property } = _decorator;

import { MatchController } from './MatchController';
import { MatchElement } from './MatchElement';
import { MatchInitializer } from './MatchInitializer';
import { MatchSlots } from './MatchSlots';
import { ElementType } from './ElementType';
import { GameManager } from './GameManager';
import { GameState } from './GameState';

@ccclass('TutorialManager')
export class TutorialManager extends Component {

    @property(Node)
    public fadeNode: Node | null = null;

    @property(Node)
    public tutorialIndicator: Node | null = null;

    @property(MatchController)
    public matchController: MatchController = null!;

    @property
    public inactivityDelay: number = 2.0;

    @property
    public tutorialSortingOrder: number = 3;

    @property
    public outOfFocusSortingOrder: number = 1;

    @property
    public enableFadeEveryTime: boolean = false;

    @property(MatchInitializer)
    public initializer: MatchInitializer = null!;

    private inactivityTimer: number = 0;
    private isActive: boolean = false;
    private currentFocusElement: MatchElement | null = null;

    protected start() {
        if (this.fadeNode) this.fadeNode.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;

        this.scheduleOnce(() => {
            if (this.initializer && this.initializer.matchElementPrefabs.length > 0) {
                const prefabIndex = Math.floor(Math.random() * this.initializer.matchElementPrefabs.length);
                const prefab = this.initializer.matchElementPrefabs[prefabIndex];

                const matchSlots = this.initializer.matchSlots;
                if (matchSlots) {
                    for (let i = 0; i < 2; i++) {
                        const matchElement = this.initializer.CreateMatchElement(prefab, false);
                        if (matchElement) {
                            const slot = matchSlots.AssignSlot(matchElement);
                            if (slot) {
                                matchElement.ForceSetInSlot(slot);
                            }
                        }
                    }
                    this.initializer.CreateMatchElement(prefab, true);
                }
            }

            if (this.matchController) {
                this.matchController.eventTarget.on(MatchController.EVENT_ELEMENT_SELECTED, this.onElementSelected, this);
            }

            this.showTutorial();
            if (this.fadeNode) this.fadeNode.active = true;
        }, 0.1);
    }

    protected update(dt: number) {
        if (this.matchController && GameManager.instance && (GameManager.instance["currentState"] === GameState.Victory || GameManager.instance["currentState"] === GameState.Defeat)) {
            this.hideTutorial();
            return;
        }

        if (this.isActive) {
            this.inactivityTimer = 0;
            return;
        }

        this.inactivityTimer += dt;
        if (this.inactivityTimer >= this.inactivityDelay) {
            this.showTutorial();
        }
    }

    private onElementSelected() {
        if (GameManager.instance && !GameManager.instance.IsRunning()) {
            GameManager.instance.StartGame();
        }

        this.hideTutorial();
        this.inactivityTimer = 0;
    }

    private showTutorial() {
        if (this.isActive) return;

        const candidate = this.findCandidate();

        if (!candidate) {
            if (this.fadeNode) this.fadeNode.active = false;
            if (this.tutorialIndicator) this.tutorialIndicator.active = false;
            return;
        }

        this.isActive = true;
        this.currentFocusElement = candidate;

        if (this.enableFadeEveryTime && this.fadeNode) {
            this.fadeNode.active = true;
        }

        candidate.SetSortingOrder(this.tutorialSortingOrder);

        if (this.tutorialIndicator) {
            this.tutorialIndicator.active = true;

            const worldPos = new Vec3();
            candidate.node.getWorldPosition(worldPos);
            this.tutorialIndicator.setWorldPosition(worldPos);
        }
    }

    private hideTutorial() {
        if (!this.isActive) return;

        this.isActive = false;

        if (this.currentFocusElement && this.currentFocusElement.isAvailable) {
            this.currentFocusElement.SetSortingOrder(this.outOfFocusSortingOrder);
        }

        if (this.fadeNode) this.fadeNode.active = false;
        if (this.tutorialIndicator) this.tutorialIndicator.active = false;

        this.currentFocusElement = null;
    }

    private findCandidate(): MatchElement | null {
        let searchRoot: Node | null = find("Canvas");
        if (!searchRoot) {
            searchRoot = director.getScene();
        }

        if (!searchRoot) {
            return null;
        }

        const allElements = searchRoot.getComponentsInChildren(MatchElement);
        const availableOnBoard = allElements.filter(el => el.isAvailable);

        if (availableOnBoard.length === 0) {
            return null;
        }

        const selected = this.matchController.selectedElements;
        const counts: Map<ElementType, number> = new Map();

        selected.forEach(el => {
            counts.set(el.type, (counts.get(el.type) || 0) + 1);
        });

        for (const [type, count] of counts) {
            if (count === 2) {
                const match = availableOnBoard.find(el => el.type === type);
                if (match) return match;
            }
        }

        for (const [type, count] of counts) {
            if (count === 1) {
                const match = availableOnBoard.find(el => el.type === type);
                if (match) return match;
            }
        }

        return availableOnBoard[Math.floor(Math.random() * availableOnBoard.length)];
    }
}
