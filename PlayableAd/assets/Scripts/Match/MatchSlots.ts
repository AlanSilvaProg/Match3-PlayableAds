import { _decorator, Component, Node, Vec3, tween, Label, UITransform, Sorting2D, Color, Quat } from 'cc';
import { tr } from './I18n';
import { OrderManager } from './OrderManager';
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
        this.createTrayLabel();
    }

    /** Etiqueta "BANDEJA": deixa claro que e aqui que o pedido e montado (nao e um inventario). */
    private createTrayLabel() {
        const anchors = this.slots.length > 0 ? this.slots[0].parent : null;
        if (!anchors || anchors.getChildByName('TrayLabel')) return;
        const n = new Node('TrayLabel');
        n.layer = anchors.layer;
        n.parent = anchors;
        n.addComponent(UITransform).setContentSize(200, 26);
        const label = n.addComponent(Label);
        const font = OrderManager.instance ? OrderManager.instance.font : null;
        if (font) { label.useSystemFont = false; label.font = font; }
        label.string = tr('TRAY');
        label.fontSize = 22;
        label.lineHeight = 24;
        label.isBold = true;
        label.color = new Color(255, 230, 140, 255);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = new Color(40, 25, 0, 255);
        label.outlineWidth = 3;
        n.addComponent(Sorting2D).sortingOrder = 8;
        // ancora a esquerda: o texto comeca sobre o primeiro encaixe
        n.getComponent(UITransform)!.anchorX = 0;
        this.trayLabel = n;
        this.placeTrayLabel();
    }

    private trayLabel: Node | null = null;
    private labelTimer: number = 0;

    /** Acompanha a bandeja (ela muda de lugar/escala entre retrato e paisagem): canto superior esquerdo dos encaixes. */
    private placeTrayLabel() {
        const n = this.trayLabel;
        if (!n || !n.isValid || this.slots.length === 0) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.slots.forEach(sl => {
            const p = sl.worldPosition;
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        const k = n.parent ? Math.abs(n.parent.worldScale.x) || 1 : 1;
        const ut = n.getComponent(UITransform)!;
        n.setWorldRotation(Quat.IDENTITY); // a bandeja pode estar girada (paisagem); o texto fica sempre em pe
        if (maxY - minY > maxX - minX) {
            // Coluna vertical (paisagem): o texto fica centrado acima do primeiro encaixe.
            ut.anchorX = 0.5;
            n.setWorldPosition((minX + maxX) / 2, maxY + 62 * k, 0);
        } else {
            ut.anchorX = 0;
            n.setWorldPosition(minX - 30 * k, maxY + 52 * k, 0);
        }
        n.setScale(1, 1, 1);
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

    /** Quantos encaixes ainda estao livres. */
    public FreeCount(): number {
        return this.slotElements.filter(e => e === null).length;
    }

    /** Esvazia todos os encaixes (troca de fase: os itens da prateleira foram removidos). */
    public ResetSlots() {
        this.slotElements.fill(null);
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
        this.labelTimer -= deltaTime;
        if (this.labelTimer <= 0) { this.labelTimer = 0.25; this.placeTrayLabel(); }
    }
}


