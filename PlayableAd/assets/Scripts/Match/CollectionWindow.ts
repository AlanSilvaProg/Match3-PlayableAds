import { Color, Node, Sorting2D, Sprite } from 'cc';
import { tr } from './I18n';
import { UiKit } from './UiKit';
import { PowerupManager } from './PowerupManager';
import { ElementCatalog } from './ElementCatalog';
import { FoodStats } from './DailyData';
import { PlayerStats, AchievementMetric } from './PlayerStats';

/**
 * Janela "Colecao": todos os pratos do jogo. Pratos que o jogador ainda nao alcancou aparecem em silhueta com o nivel
 * em que chegam; os liberados mostram quantas vezes foram servidos. Os espacos "Em breve" ficam prontos para novos pratos.
 */
export class CollectionWindow {
    /** Espacos extras reservados para pratos futuros (cada um mostra "Em breve"). Diminua ao incluir pratos novos no ElementCatalog. */
    public static readonly COMING_SOON_SLOTS = 3;

    private static win: ReturnType<typeof UiKit.windowShell> = null;
    private static content: Node | null = null;

    public static createOpenButton(parent: Node, x: number, y: number, order: number, size: number = 110): Node | null {
        const pm = PowerupManager.instance;
        const b = UiKit.menuButton(parent, 'CollectionButton', x, y, order, size, pm ? pm.collectionIcon : null, tr('COLLECTION'), () => this.open());
        return b ? b.node : null;
    }

    public static open() {
        if (!this.win) {
            this.win = UiKit.windowShell('CollectionWindow', tr('COLLECTION'));
            if (!this.win) return;
            this.content = UiKit.node(this.win.win, 'Content', 0, 0, 1000, 600);
        }
        this.render();
        this.win!.open();
    }

    private static render() {
        const w = this.win!, base = w.base + 4;
        this.content!.destroy();
        const c = UiKit.node(w.win, 'Content', 0, 0, 1000, 600);
        this.content = c;

        // Ate onde o jogador chegou (maior nivel concluido, 1 = primeiro): pratos com unlockLevel <= isso estao liberados.
        const reached = PlayerStats.get(AchievementMetric.HighestLevel);
        const defs = ElementCatalog.defs;
        const found = defs.filter(d => d.unlockLevel <= reached).length;
        UiKit.label(c, tr('Discovered {0}/{1}', found, defs.length), 26, 520, 34, 0, 205, base, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));

        const cols = 6, cellW = 150, cellH = 150, gapX = 8, gapY = 8;
        const items = defs.length + this.COMING_SOON_SLOTS;
        const x0 = -((cellW * cols + gapX * (cols - 1)) / 2) + cellW / 2;
        for (let i = 0; i < items; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const cell = UiKit.node(c, 'Cell' + i, x0 + col * (cellW + gapX), 112 - row * (cellH + gapY), cellW, cellH);
            const soon = i >= defs.length;
            const def = soon ? null : defs[i];
            const open = !!def && def.unlockLevel <= reached;
            const bg = UiKit.sprite(cell, UiKit.pm!.pointsFrame, base, true);
            bg.color = open ? Color.WHITE : new Color(150, 150, 170, 255);
            if (def) {
                const icon = UiKit.node(cell, 'Icon', 0, 18, 84, 84);
                const sp = icon.addComponent(Sprite);
                ElementCatalog.applyFitted(sp, def.type, 84);
                sp.color = open ? Color.WHITE : new Color(0, 0, 0, 200); // silhueta
                icon.addComponent(Sorting2D).sortingOrder = base + 1;
                UiKit.label(cell, open ? tr(def.name) : '???', 22, cellW - 14, 26, 0, -34, base + 1);
                UiKit.label(cell, open ? tr('Served x{0}', FoodStats.get(def.type)) : tr('Level {0}', def.unlockLevel + 1), 18, cellW - 14, 22, 0, -58, base + 1,
                    open ? new Color(140, 255, 160, 255) : new Color(200, 210, 235, 255), new Color(10, 20, 40, 255), false, true);
            } else {
                UiKit.label(cell, '?', 64, 80, 80, 0, 14, base + 1, new Color(255, 255, 255, 120), new Color(10, 20, 40, 255));
                UiKit.label(cell, tr('Coming soon'), 22, cellW - 14, 26, 0, -44, base + 1, new Color(200, 210, 235, 255), new Color(10, 20, 40, 255), false, true);
            }
        }
    }
}

