import { _decorator, Component, Node, Prefab, instantiate, UITransform, Vec3, randomRange } from 'cc';
const { ccclass, property } = _decorator;

import { MatchElement } from './MatchElement';
import { MatchController } from './MatchController';
import { MatchElementCount } from './MatchElementCount';
import { ElementType } from './ElementType';
import { GameManager } from './GameManager';
import { MatchSlots } from './MatchSlots';

@ccclass('MatchInitializer')
export class MatchInitializer extends Component {

    @property([Prefab])
    public matchElementPrefabs: Prefab[] = [];

    @property(MatchController)
    public matchController: MatchController = null!;

    @property(MatchSlots)
    public matchSlots: MatchSlots = null!;

    @property
    public numberOfElements: number = 10;

    @property([MatchElementCount])
    public matchElementCounts: MatchElementCount[] = [];

    private width: number = 0;
    private height: number = 0;
    private anchorX: number = 0;
    private anchorY: number = 0;
    private typeCounts: Map<ElementType, number> = new Map();

    start() {
        const uiTransform = this.getComponent(UITransform);
        if (!uiTransform) {
            console.error("MatchInitializer requires a UITransform component.");
            return;
        }

        this.typeCounts.clear();

        this.width = uiTransform.width;
        this.height = uiTransform.height;
        this.anchorX = uiTransform.anchorX;
        this.anchorY = uiTransform.anchorY;

        for (let i = 0; i < this.numberOfElements; i++) {
            if (this.matchElementPrefabs.length === 0) continue;

            const prefabIndex = Math.floor(randomRange(0, this.matchElementPrefabs.length));
            const prefab = this.matchElementPrefabs[prefabIndex];

            for (let j = 0; j < 3; j++) {
                this.CreateMatchElement(prefab, true);
            }
        }

        // Total count will be handled individually in CreateMatchElement

        this.matchElementCounts.forEach(counter => {
            counter.Initialize(0, this.matchController);
        });
    }

    public CreateMatchElement(prefab: Prefab, randomizePosition: boolean): MatchElement | null {
        const instance = instantiate(prefab);
        instance.parent = this.node;

        const matchElement = instance.getComponent(MatchElement);
        if (!matchElement) {
            console.error("Prefab does not have a MatchElement component.");
            return null;
        }

        if (randomizePosition) {
            const x = (Math.random() - this.anchorX) * this.width;
            const y = (Math.random() - this.anchorY) * this.height;
            instance.setPosition(new Vec3(x, y, 0));
        }

        const currentCount = this.typeCounts.get(matchElement.type) || 0;
        this.typeCounts.set(matchElement.type, currentCount + 1);

        if (GameManager.instance) {
            GameManager.instance.IncreaseElements(1);
        }

        const counter = this.matchElementCounts.find(c => c.type === matchElement.type);
        if (counter) {
            counter.AddIncrement(1);
        }

        matchElement.matchController = this.matchController;
        matchElement.matchSlots = this.matchSlots;

        return matchElement;
    }
}
