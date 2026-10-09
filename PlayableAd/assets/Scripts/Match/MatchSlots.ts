import { _decorator, Component, Node, Vec3, tween } from 'cc';
const { ccclass, property } = _decorator;

import { MatchElement } from './MatchElement';

@ccclass('MatchSlots')
export class MatchSlots extends Component {

    @property([Node])
    public slots: Node[] = [];

    private slotElements: (MatchElement | null)[] = [];

    onLoad() {
        this.slotElements = new Array(this.slots.length).fill(null);
    }

    start() {
    }

    public AssignSlot(element: MatchElement): Node | null {
        let lastSameTypeIndex = -1;
        for (let i = 0; i < this.slotElements.length; i++) {
            if (this.slotElements[i] && this.slotElements[i]!.type === element.type) {
                lastSameTypeIndex = i;
            }
        }

        let insertIndex: number;

        if (lastSameTypeIndex === -1) {
            insertIndex = this.slotElements.indexOf(null);
            if (insertIndex === -1) return null;
        } else {
            insertIndex = lastSameTypeIndex + 1;

            // O ultimo slot ja pertence ao mesmo tipo: nao ha onde agrupar, usa a primeira vaga livre (ou rejeita).
            if (insertIndex >= this.slotElements.length) {
                insertIndex = this.slotElements.indexOf(null);
                if (insertIndex === -1) return null;
            } else if (this.slotElements[insertIndex] !== null) {
                // So da para empurrar os itens para a direita se houver vaga depois do ponto de insercao;
                // caso contrario usa a primeira vaga livre (sem agrupar) para nao sobrescrever ninguem.
                let freeAfter = -1;
                for (let i = insertIndex + 1; i < this.slotElements.length; i++) {
                    if (this.slotElements[i] === null) { freeAfter = i; break; }
                }

                if (freeAfter !== -1) {
                    this.ShiftElementsFrom(insertIndex, freeAfter);
                } else {
                    insertIndex = this.slotElements.indexOf(null);
                    if (insertIndex === -1) return null;
                }
            }
        }

        this.slotElements[insertIndex] = element;
        return this.slots[insertIndex];
    }

    private ShiftElementsFrom(startIndex: number, freeIndex: number) {
        for (let i = freeIndex; i > startIndex; i--) {
            this.slotElements[i] = this.slotElements[i - 1];

            if (this.slotElements[i]) {
                this.slotElements[i]!.MoveToSlot(this.slots[i]);
            }
        }
        this.slotElements[startIndex] = null;
    }

    public GetNextFreeSlot(): Node | null {
        for (let i = 0; i < this.slotElements.length; i++) {
            if (this.slotElements[i] === null) {
                return this.slots[i];
            }
        }
        return null;
    }

    public ReleaseSlot(slotNode: Node) {
        const index = this.slots.indexOf(slotNode);
        if (index !== -1) {
            this.slotElements[index] = null;
        }
    }

    public CompactSlots() {
        const remainingElements = this.slotElements.filter(el => el !== null) as MatchElement[];

        this.slotElements.fill(null);

        for (let i = 0; i < remainingElements.length; i++) {
            this.slotElements[i] = remainingElements[i];
            this.slotElements[i]!.MoveToSlot(this.slots[i]);
        }
    }

    update(deltaTime: number) {
    }
}


