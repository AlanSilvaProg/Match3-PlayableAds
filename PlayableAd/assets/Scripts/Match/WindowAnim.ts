import { Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { Responsive } from './Responsive';

/**
 * Animacao padrao das janelas (Power-ups, Conquistas, Ranking): o painel `Window` sobe de baixo da tela e, ao fechar,
 * desce de volta enquanto o fundo escuro (`Dim`) aparece/some. A raiz so e desativada ao fim da animacao de saida.
 */
export class WindowAnim {
    private static roots: Set<Node> = new Set();
    private static hooked = false;

    /** Fora da tela por baixo, qualquer que seja a altura visivel. */
    private static get OFFSCREEN_Y() { return -(Responsive.height / 2 + 340); }

    /** Escala que faz a janela (1000x600) caber na tela visivel (principalmente no retrato). */
    public static fitScale(): number {
        return Math.min(1, (Responsive.width - 24) / 1000, (Responsive.height - 24) / 600);
    }

    /** Ajusta escala da janela e cobertura do fundo escuro ao tamanho visivel atual. */
    public static fit(root: Node) {
        const win = root.getChildByName('Window');
        const dim = root.getChildByName('Dim');
        const s = this.fitScale();
        if (win) win.setScale(s, s, 1);
        dim?.getComponent(UITransform)?.setContentSize(Responsive.width + 80, Responsive.height + 80);
    }
    private static readonly OPEN_TIME = 0.38;
    private static readonly CLOSE_TIME = 0.28;
    private static closing: WeakSet<Node> = new WeakSet();

    public static open(root: Node) {
        if (!this.hooked) {
            this.hooked = true;
            Responsive.onChange(() => this.roots.forEach(r => { if (r.isValid) this.fit(r); else this.roots.delete(r); }));
        }
        this.roots.add(root);
        this.fit(root);
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
