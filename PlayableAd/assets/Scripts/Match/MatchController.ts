import { _decorator, Component, Node, EventTarget, Prefab, instantiate, AudioSource } from 'cc';
const { ccclass, property } = _decorator;
import { MatchElement } from './MatchElement';
import { ElementType } from './ElementType';
import { GameManager } from './GameManager';
import { ComboManager } from './ComboManager';
import { ElementCatalog } from './ElementCatalog';
import { OrderManager, OrderClaim } from './OrderManager';
import { PowerupManager } from './PowerupManager';
import { PlayerStats, AchievementMetric } from './PlayerStats';

@ccclass('MatchController')
export class MatchController extends Component {

    public eventTarget: EventTarget = new EventTarget();
    public static readonly EVENT_ELEMENT_SELECTED = "element_selected";
    public static readonly EVENT_ELEMENT_RETURNED = "element_returned";

    @property(Prefab)
    public mergeEffectPrefab: Prefab = null!;

    @property(AudioSource)
    public mergeAudio: AudioSource | null = null;

    public selectedElements: MatchElement[] = [];
    private pendingMatches: { elements: MatchElement[], arrivedCount: number, middleSlot: Node | null, claim: OrderClaim }[] = [];

    protected start() {
        // Quando um pedido novo chega, itens que ja estejam na prateleira fazem o merge automaticamente.
        GameManager.instance?.events.on(GameManager.EVENT_DEMAND_CHANGED, this.checkMatch, this);
    }

    protected onDestroy() {
        GameManager.instance?.events?.off(GameManager.EVENT_DEMAND_CHANGED, this.checkMatch, this);
    }

    private emitSelection() {
        const counts = new Map<ElementType, number>();
        this.selectedElements.forEach(el => counts.set(el.type, (counts.get(el.type) || 0) + 1));
        GameManager.instance?.events.emit(GameManager.EVENT_SELECTION_CHANGED, counts);
    }

    public onElementClicked(element: MatchElement) {
        this.selectedElements.push(element);
        this.eventTarget.emit(MatchController.EVENT_ELEMENT_SELECTED, element.type);

        this.emitSelection();
        this.checkMatch();
    }

    public onElementReturned(element: MatchElement) {
        const index = this.selectedElements.indexOf(element);
        if (index !== -1) this.selectedElements.splice(index, 1);
        this.eventTarget.emit(MatchController.EVENT_ELEMENT_RETURNED, element.type);
        this.emitSelection();
    }

    public onElementReachedSlot(element: MatchElement) {
        const matchIndex = this.pendingMatches.findIndex(m => m.elements.indexOf(element) !== -1);

        if (matchIndex !== -1) {
            const match = this.pendingMatches[matchIndex];

            // Conta o estado real, nao eventos: a reorganizacao da prateleira faz itens
            // "chegarem" varias vezes e antecipava o merge de itens ainda em movimento.
            if (match.elements.every(el => el.isValid && el.hasReachedSlot)) {
                this.ExecuteMerge(matchIndex);
            }
        }
    }

    /** Indice do item que fica no centro do merge (os demais sao atraidos para ele). */
    private middleIndex(count: number): number {
        return Math.min(1, count - 1);
    }

    /**
     * Um merge so acontece se algum pedido aberto pedir aquele alimento: quando a quantidade pedida ja esta na
     * prateleira, os itens (exatamente essa quantidade) se juntam e a linha do pedido e cumprida.
     */
    private checkMatch() {
        const orders = OrderManager.instance;
        if (!orders) return;

        const typeCount: Map<ElementType, MatchElement[]> = new Map();
        for (const element of this.selectedElements) {
            if (!typeCount.has(element.type)) {
                typeCount.set(element.type, []);
            }
            typeCount.get(element.type)!.push(element);
        }

        for (const [type, elements] of typeCount) {
            const claim = orders.TryClaim(type, elements.length);
            if (!claim) continue;

            const matchedSet = elements.slice(0, claim.quantity);
            this.selectedElements = this.selectedElements.filter(el => matchedSet.indexOf(el) === -1);
            this.emitSelection();

            const middleElement = matchedSet[this.middleIndex(matchedSet.length)];
            const allArrived = matchedSet.every(el => el.hasReachedSlot);

            this.pendingMatches.push({
                elements: matchedSet,
                arrivedCount: 0,
                middleSlot: middleElement.currentSlot,
                claim,
            });

            if (allArrived) {
                this.ExecuteMerge(this.pendingMatches.length - 1);
            }

            // Pode haver mais de um pedido atendivel com o que sobrou.
            this.checkMatch();
            break;
        }
    }

    private ExecuteMerge(matchIndex: number) {
        const match = this.pendingMatches[matchIndex];
        // O slot do elemento central pode ter mudado por reorganizacoes da prateleira.
        const middle = this.middleIndex(match.elements.length);
        const middleSlot = match.elements[middle].currentSlot || match.middleSlot;

        match.elements.forEach((el, index) => el.Merge(middleSlot, index === middle));
        const mergedCount = match.elements.length;
        const mergedType = match.elements[0].type;
        const comboWeight = ElementCatalog.comboWeight(mergedType);
        const claim = match.claim;
        let gained = 0;       // pontos deste merge (definidos mais abaixo, antes do callback abaixo rodar)
        let holding = false;  // se o placar esta segurando esses pontos ate as moedas chegarem

        this.scheduleOnce(() => {
            if (GameManager.instance) {
                GameManager.instance.RegisterMatch(mergedCount);
            }

            PlayerStats.increment(AchievementMetric.Merges);

            if (OrderManager.instance) {
                OrderManager.instance.CompleteLine(claim);
            }

            // Moedas do merge voam ate o placar de pontos da partida.
            if (PowerupManager.instance && middleSlot && middleSlot.isValid) {
                PowerupManager.instance.FlyCoins(middleSlot.worldPosition, Math.min(14, 5 + mergedCount * 2), holding ? gained : 0);
            } else if (holding && ComboManager.instance) {
                ComboManager.instance.ReleaseDisplay(gained); // sem como voar as moedas: libera o placar na hora
            }

            if (this.mergeEffectPrefab && middleSlot) {
                const effect = instantiate(this.mergeEffectPrefab);
                effect.parent = middleSlot;
                effect.setPosition(0, 0, 0);
            }

            if (this.mergeAudio) {
                this.mergeAudio.play();
            }
        }, 0.3);

        if (ComboManager.instance) {
            gained = ComboManager.instance.RegisterMatch(comboWeight, mergedCount);
            // O texto do placar so sobe quando as moedas chegarem ao holder.
            if (gained > 0 && PowerupManager.instance && PowerupManager.instance.canFlyCoins) {
                ComboManager.instance.HoldDisplay(gained);
                holding = true;
            }
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
