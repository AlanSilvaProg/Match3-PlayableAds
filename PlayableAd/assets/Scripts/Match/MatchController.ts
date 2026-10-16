import { _decorator, Component, Node, EventTarget, Prefab, instantiate, AudioSource, Vec3, Color } from 'cc';
const { ccclass, property } = _decorator;
import { MatchElement } from './MatchElement';
import { ElementType } from './ElementType';
import { GameManager } from './GameManager';
import { ComboManager } from './ComboManager';
import { ElementCatalog } from './ElementCatalog';
import { OrderManager, OrderClaim } from './OrderManager';
import { PowerupManager } from './PowerupManager';
import { PlayerStats, AchievementMetric } from './PlayerStats';
import { RayPickup } from './RayPickup';
import { SoundManager } from './SoundManager';
import { Haptics } from './Haptics';
import { Vfx } from './Vfx';

@ccclass('MatchController')
export class MatchController extends Component {

    public eventTarget: EventTarget = new EventTarget();
    public static readonly EVENT_ELEMENT_SELECTED = "element_selected";
    public static readonly EVENT_ELEMENT_RETURNED = "element_returned";

    @property(Prefab)
    public mergeEffectPrefab: Prefab = null!;

    @property(AudioSource)
    public mergeAudio: AudioSource | null = null;

    protected start() {
        // Todos os alimentos de uma linha chegaram ao cartao: combo, moedas e a linha fica pronta.
        GameManager.instance?.events.on(GameManager.EVENT_LINE_FULL, this.onLineFull, this);
    }

    protected onDestroy() {
        GameManager.instance?.events?.off(GameManager.EVENT_LINE_FULL, this.onLineFull, this);
    }

    /** Troca de fase: nada a limpar (os alimentos escolhidos ja foram consumidos pelos pedidos). */
    public ResetState() { }

    /** Um alimento foi escolhido (voa para o pedido): avisa quem precisa saber que o jogador agiu. */
    public onElementClicked(element: MatchElement) {
        this.eventTarget.emit(MatchController.EVENT_ELEMENT_SELECTED, element.type);
        GameManager.instance?.events.emit(GameManager.EVENT_SELECTION_CHANGED, new Map<ElementType, number>());
    }

    /** A linha do pedido ficou completa: era o "merge" (combo, estatistica, raio, moedas guardadas no pedido). */
    private onLineFull(claim: OrderClaim) {
        const mergedCount = claim.quantity;
        const comboWeight = ElementCatalog.comboWeight(claim.type);
        const golden = !!claim.order.plan.golden; // pedido de ouro: sem moedas
        let gained = 0;
        let holding = false;

        if (GameManager.instance) GameManager.instance.RegisterMatch(mergedCount);
        PlayerStats.increment(AchievementMetric.Merges);
        RayPickup.maybeSpawn(); // raro: o raio cai no tabuleiro depois de completar uma linha

        if (ComboManager.instance) {
            gained = ComboManager.instance.RegisterMatch(comboWeight, mergedCount, golden);
            // O texto do placar so sobe quando as moedas chegarem ao holder.
            if (gained > 0 && PowerupManager.instance && PowerupManager.instance.canFlyCoins) {
                ComboManager.instance.HoldDisplay(gained);
                holding = true;
            }
        }

        const orders = OrderManager.instance;
        orders?.CompleteLine(claim);

        // As moedas ficam no pedido e so voam ate o placar quando o jogador entregar.
        if (!golden && PowerupManager.instance && orders) {
            orders.AddPendingCoins(claim, holding ? gained : 0, Math.min(14, 5 + mergedCount * 2));
        } else if (holding && ComboManager.instance) {
            ComboManager.instance.ReleaseDisplay(gained);
        }

        // Brilho no icone da linha.
        SoundManager.playLineComplete();
        Haptics.line();
        const at = orders ? orders.GetLineTarget(claim) : null;
        const canvas = orders ? orders.node.parent : null;
        if (at && canvas) {
            const local = new Vec3();
            canvas.inverseTransformPoint(local, at);
            Vfx.burst(canvas, local, 1.2, new Color(120, 255, 130, 255), new Color(255, 255, 160, 255));
        }
        if (this.mergeEffectPrefab && at && canvas) {
            const effect = instantiate(this.mergeEffectPrefab);
            effect.parent = canvas;
            effect.setWorldPosition(at);
        }
        if (this.mergeAudio) this.mergeAudio.play();
    }
}
