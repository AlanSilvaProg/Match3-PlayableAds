import { Color, Node, Sorting2D, Sprite, UITransform } from 'cc';
import { tr } from './I18n';
import { UiKit } from './UiKit';
import { Responsive } from './Responsive';
import { GameManager } from './GameManager';
import { PokiService } from './PokiService';
import { PowerupManager } from './PowerupManager';
import { SoundManager } from './SoundManager';
import { WindowAnim } from './WindowAnim';
import { Haptics } from './Haptics';

/**
 * Botao SAIR (canto superior direito, so durante a partida) + janela de confirmacao. Sair volta ao seletor de
 * niveis e perde o progresso da rodada atual. A partida fica parada enquanto a confirmacao esta aberta.
 */
export class AbandonUi {
    private static button: Node | null = null;
    private static dialog: Node | null = null;
    private static heldBefore: boolean = false;

    /** Cria o botao (uma vez) e o mantem posicionado/visivel; chamado a cada quadro pelo PowerupManager. */
    public static refresh(visible: boolean) {
        const pm = PowerupManager.instance;
        if (!pm || !pm.node.parent) return;
        if (!this.button || !this.button.isValid) this.build(pm.node.parent);
        const b = this.button;
        if (!b) return;
        b.active = visible;
        if (visible) b.setPosition(Responsive.right - 66, Responsive.top - 38, 0);
    }

    private static build(canvas: Node) {
        const pm = UiKit.pm;
        if (!pm) return;
        const root = UiKit.node(canvas, 'AbandonButton', 0, 0, 104, 46);
        const bg = UiKit.sprite(root, pm.adButtonFrame || pm.buttonFrame, pm.windowSortingBase - 100, true);
        bg.color = Color.WHITE;
        UiKit.label(root, tr('QUIT'), 22, 90, 34, 0, 3, pm.windowSortingBase - 99);
        root.on(Node.EventType.TOUCH_START, () => root.setScale(0.92, 0.92, 1));
        root.on(Node.EventType.TOUCH_CANCEL, () => root.setScale(1, 1, 1));
        root.on(Node.EventType.TOUCH_END, () => { root.setScale(1, 1, 1); SoundManager.playMenuClick(); Haptics.tick(); this.confirm(); });
        this.button = root;
    }

    /** Abre a confirmacao (pausa o relogio e os pedidos). */
    public static confirm() {
        const pm = UiKit.pm, gm = GameManager.instance;
        if (!pm || !gm || !gm.IsRunning()) return;
        if (!this.dialog || !this.dialog.isValid) this.buildDialog(pm.node.parent!);
        const d = this.dialog!;
        this.heldBefore = gm.timeHeld;
        gm.timeHeld = true;
        const parent = d.parent;
        if (parent) d.setSiblingIndex(parent.children.length - 1);
        SoundManager.playOpenMenu();
        WindowAnim.open(d);
    }

    private static closeDialog(restoreTime: boolean) {
        const gm = GameManager.instance;
        if (restoreTime && gm) gm.timeHeld = this.heldBefore;
        if (this.dialog) WindowAnim.close(this.dialog);
    }

    private static buildDialog(canvas: Node) {
        const pm = UiKit.pm!;
        const base = pm.windowSortingBase + 60; // acima das demais janelas
        const root = UiKit.node(canvas, 'AbandonDialog', 0, 0, 1280, 720);
        const dim = UiKit.node(root, 'Dim', 0, 0, 1400, 800);
        UiKit.sprite(dim, pm.dimFrame, base).color = new Color(0, 0, 0, 200);
        dim.on(Node.EventType.TOUCH_END, () => { SoundManager.playMenuClick(); this.closeDialog(true); });
        const W = 760, H = 420;
        const win = UiKit.node(root, 'Window', 0, 0, W, H);
        UiKit.sprite(win, pm.windowFrame, base + 1, true);
        [Node.EventType.TOUCH_START, Node.EventType.TOUCH_END].forEach(t => win.on(t, () => { }));
        UiKit.label(win, tr('LEAVE THE MATCH?'), 48, 680, 62, 0, 120, base + 3, Color.WHITE, new Color(20, 70, 120, 255));
        const msg = UiKit.label(win, tr('You will lose the progress of the current round.'), 30, 640, 90, 0, 36, base + 3, Color.WHITE, new Color(10, 20, 40, 255), false, true);
        msg.enableWrapText = true;
        UiKit.button(win, tr('STAY'), -165, -100, 280, 80, base + 3, Color.WHITE, () => this.closeDialog(true));
        UiKit.button(win, tr('LEAVE'), 165, -100, 280, 80, base + 3, Color.WHITE, () => this.leave(), pm.adButtonFrame);
        root.active = false;
        this.dialog = root;
    }

    /** Confirmado: volta ao seletor de niveis (a rodada atual e descartada; nada e salvo). */
    private static leave() {
        const gm = GameManager.instance;
        if (gm) gm.timeHeld = false;
        PokiService.gameplayStop();
        GameManager.showSelectorOnLoad = true;
        if (!GameManager.reloadScene()) GameManager.showSelectorOnLoad = false;
    }
}
