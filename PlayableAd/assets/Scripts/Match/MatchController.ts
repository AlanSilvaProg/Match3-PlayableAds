import { _decorator, Component, Node, EventTarget, Prefab, instantiate, AudioSource } from 'cc';
const { ccclass, property } = _decorator;
import { MatchElement } from './MatchElement';
import { ElementType } from './ElementType';
import { GameManager } from './GameManager';

@ccclass('MatchController')
export class MatchController extends Component {

    public eventTarget: EventTarget = new EventTarget();
    public static readonly EVENT_ELEMENT_SELECTED = "element_selected";

    @property(Prefab)
    public mergeEffectPrefab: Prefab = null!;

    @property(AudioSource)
    public mergeAudio: AudioSource | null = null;

    public selectedElements: MatchElement[] = [];
    private pendingMatches: { elements: MatchElement[], arrivedCount: number, middleSlot: Node | null }[] = [];

    public onElementClicked(element: MatchElement) {
        this.selectedElements.push(element);
        this.eventTarget.emit(MatchController.EVENT_ELEMENT_SELECTED, element.type);

        this.checkMatch();
    }

    public onElementReachedSlot(element: MatchElement) {
        const matchIndex = this.pendingMatches.findIndex(m => m.elements.indexOf(element) !== -1);

        if (matchIndex !== -1) {
            const match = this.pendingMatches[matchIndex];
            match.arrivedCount++;

            if (match.arrivedCount >= 3) {
                this.ExecuteMerge(matchIndex);
            }
        }
    }

    private checkMatch() {
        const typeCount: Map<ElementType, MatchElement[]> = new Map();

        for (const element of this.selectedElements) {
            if (!typeCount.has(element.type)) {
                typeCount.set(element.type, []);
            }
            typeCount.get(element.type)!.push(element);
        }

        for (const [type, elements] of typeCount) {
            if (elements.length >= 3) {
                const matchedSet = elements.slice(0, 3);
                this.selectedElements = this.selectedElements.filter(el => matchedSet.indexOf(el) === -1);

                const middleElement = matchedSet[1];
                const alreadyArrived = matchedSet.filter(el => el.hasReachedSlot).length;

                const newMatch = {
                    elements: matchedSet,
                    arrivedCount: alreadyArrived,
                    middleSlot: middleElement.currentSlot
                };

                this.pendingMatches.push(newMatch);

                if (alreadyArrived >= 3) {
                    this.ExecuteMerge(this.pendingMatches.length - 1);
                }

                this.checkMatch();
                break;
            }
        }
    }

    private ExecuteMerge(matchIndex: number) {
        const match = this.pendingMatches[matchIndex];
        const middleSlot = match.middleSlot;

        match.elements.forEach((el, index) => el.Merge(middleSlot, index === 1));

        this.scheduleOnce(() => {
            if (this.mergeEffectPrefab && middleSlot) {
                const effect = instantiate(this.mergeEffectPrefab);
                effect.parent = middleSlot;
                effect.setPosition(0, 0, 0);
            }

            if (this.mergeAudio) {
                this.mergeAudio.play();
            }
        }, 0.3);

        if (GameManager.instance) {
            GameManager.instance.RegisterMatch(3);
        }

        const firstEl = match.elements[0];
        const matchSlots = firstEl.getComponent(MatchElement)?.matchSlots;
        if (matchSlots) {
            this.scheduleOnce(() => {
                matchSlots.CompactSlots();
            }, 0.5);
        }

        this.pendingMatches.splice(matchIndex, 1);
    }
}
