import { _decorator, Component, Prefab, instantiate, Node } from 'cc';
const { ccclass, property } = _decorator;

import { ElementType } from './ElementType';
import { MatchController } from './MatchController';
import { MatchCounterUI } from './MatchCounterUI';

@ccclass('MatchElementCount')
export class MatchElementCount extends Component {

    @property({ type: ElementType })
    public type: ElementType = ElementType.Hamburguer;

    @property(Prefab)
    public counterPrefab: Prefab = null!;

    private isInitialized: boolean = false;
    private currentCount: number = 0;
    private counterUI: MatchCounterUI | null = null;
    private counterNode: Node | null = null;

    public Initialize(count: number, matchController: MatchController) {
        if (this.isInitialized) return;
        this.isInitialized = true;

        matchController.eventTarget.on(MatchController.EVENT_ELEMENT_SELECTED, this.onElementSelected, this);

        if (count > 0) {
            this.AddIncrement(count);
        }
    }

    public AddIncrement(count: number) {
        this.currentCount += count;

        if (this.currentCount > 0 && !this.counterNode && this.counterPrefab) {
            this.counterNode = instantiate(this.counterPrefab);
            this.counterNode.parent = this.node;
            this.counterUI = this.counterNode.getComponent(MatchCounterUI);
        }

        if (this.counterUI) {
            this.counterUI.updateCount(this.currentCount);
        }
    }

    private onElementSelected(type: ElementType) {
        if (this.type === type) {
            this.currentCount--;
            if (this.counterUI) {
                this.counterUI.updateCount(this.currentCount);
            }

            if (this.currentCount <= 0) {
                if (this.counterNode) {
                    this.counterNode.destroy();
                    this.counterNode = null;
                    this.counterUI = null;
                }
                this.node.destroy();
            }
        }
    }
}
