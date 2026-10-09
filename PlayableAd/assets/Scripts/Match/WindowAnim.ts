import { Node, Tween, tween, UIOpacity, Vec3 } from 'cc';

/**
 * Animacao padrao das janelas (Power-ups, Conquistas, Ranking): o painel `Window` sobe de baixo da tela e, ao fechar,
 * desce de volta enquanto o fundo escuro (`Dim`) aparece/some. A raiz so e desativada ao fim da animacao de saida.
 */
export class WindowAnim {
    private static readonly OFFSCREEN_Y = -780;
    private static readonly OPEN_TIME = 0.38;
    private static readonly CLOSE_TIME = 0.28;
    private static closing: WeakSet<Node> = new WeakSet();

    public static open(root: Node) {
        this.closing.delete(root);
        root.active = true;
        root.setScale(1, 1, 1);
        const win = root.getChildByName('Window');
        const dim = root.getChildByName('Dim');
        if (win) {
            Tween.stopAllByTarget(win);
            win.setPosition(0, this.OFFSCREEN_Y, 0);
            tween(win).to(this.OPEN_TIME, { position: new Vec3(0, 0, 0) }, { easing: 'backOut' }).start();
        }
        if (dim) {
            const op = dim.getComponent(UIOpacity) || dim.addComponent(UIOpacity);
            Tween.stopAllByTarget(op);
            op.opacity = 0;
            tween(op).to(0.25, { opacity: 255 }).start();
        }
    }

    public static close(root: Node, onClosed?: () => void) {
        if (!root || !root.active || this.closing.has(root)) return;
        this.closing.add(root);
        const win = root.getChildByName('Window');
        const dim = root.getChildByName('Dim');
        const finish = () => {
            if (!this.closing.has(root)) return; // reaberta durante a saida
            this.closing.delete(root);
            root.active = false;
            if (win) win.setPosition(0, 0, 0);
            if (onClosed) onClosed();
        };
        if (dim) {
            const op = dim.getComponent(UIOpacity) || dim.addComponent(UIOpacity);
            Tween.stopAllByTarget(op);
            tween(op).to(this.CLOSE_TIME, { opacity: 0 }).start();
        }
        if (win) {
            Tween.stopAllByTarget(win);
            tween(win).to(this.CLOSE_TIME, { position: new Vec3(0, this.OFFSCREEN_Y, 0) }, { easing: 'cubicIn' }).call(finish).start();
        } else {
            finish();
        }
    }
}
