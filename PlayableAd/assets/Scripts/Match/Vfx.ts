import { Color, instantiate, Node, ParticleSystem2D, Sorting2D, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { PowerupManager } from './PowerupManager';
import { CelebrationFx } from './CelebrationFx';

/** Efeitos visuais curtos reaproveitados pelo jogo (rastro, estouro de particulas, texto flutuante). */
export class Vfx {
    private static readonly YELLOW = new Color(255, 232, 80, 255);
    private static readonly CYAN = new Color(120, 220, 255, 255);

    /** Faiscas em losango que ficam para tras de um item em voo (posicao local ao `parent`). */
    public static trail(parent: Node, at: Vec3, color: Color = Vfx.YELLOW, size: number = 16) {
        const frame = PowerupManager.instance ? PowerupManager.instance.dimFrame : null;
        if (!frame || !parent.isValid) return;
        const n = new Node('Spark');
        n.layer = parent.layer;
        n.parent = parent;
        n.setPosition(at.x + (Math.random() - 0.5) * 10, at.y + (Math.random() - 0.5) * 10, 0);
        n.setRotationFromEuler(0, 0, 45);
        n.addComponent(UITransform).setContentSize(size, size);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = frame;
        sp.color = color;
        n.addComponent(Sorting2D).sortingOrder = 39;
        const op = n.addComponent(UIOpacity);
        op.opacity = 230;
        n.setScale(1, 1, 1);
        tween(n).to(0.34, { scale: new Vec3(0.1, 0.1, 1), eulerAngles: new Vec3(0, 0, 160) }).call(() => { if (n.isValid) n.destroy(); }).start();
        tween(op).to(0.34, { opacity: 0 }).start();
    }

    /** Estouro de particulas (reaproveita o efeito de tempo). `at` e local ao `parent`. */
    public static burst(parent: Node, at: Vec3, scale: number = 1.6, start: Color = Vfx.YELLOW, end: Color = Vfx.CYAN) {
        const gm = GameManager.instance;
        const prefab = gm ? gm.timeEffectPrefab : null;
        if (!prefab || !parent.isValid) return;
        const fx = instantiate(prefab);
        fx.parent = parent;
        fx.setPosition(at.x, at.y, 0);
        fx.setScale(scale, scale, 1);
        const s = new Color(start.r, start.g, start.b, 255);
        const e = new Color(end.r, end.g, end.b, 0);
        fx.getComponentsInChildren(ParticleSystem2D).forEach(ps => { ps.startColor = s; ps.endColor = e; ps.resetSystem(); });
        fx.getComponentsInChildren(Sorting2D).forEach(so => { so.sortingOrder = 440; });
    }

    /** Texto que sobe e some ("+120", "PERFECT!"). `world` e a posicao inicial no mundo. */
    public static floatText(canvas: Node, world: Vec3, text: string, size: number, color: Color, outline: Color, rise: number = 90, life: number = 0.95) {
        if (!canvas || !canvas.isValid) return;
        const root = new Node('FloatText');
        root.layer = canvas.layer;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(10, 10);
        root.setWorldPosition(world);
        const op = root.addComponent(UIOpacity);
        CelebrationFx.makeLabel(root, text, size, 0, 0, color, outline, 6);
        root.setScale(0.4, 0.4, 1);
        const p = root.position;
        tween(root)
            .to(0.18, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: Vec3.ONE })
            .to(life, { position: new Vec3(p.x, p.y + rise, 0) }, { easing: 'quadOut' })
            .call(() => { if (root.isValid) root.destroy(); })
            .start();
        tween(op).delay(life * 0.55).to(life * 0.45, { opacity: 0 }).start();
    }
}
