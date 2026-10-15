import { Color, Font, instantiate, Label, Node, ParticleSystem2D, Prefab, Sorting2D, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { tr } from './I18n';
import { OrderManager } from './OrderManager';

/** Um degrau de parabenizacao: a partir de `streak` merges seguidos e rapidos aparece `text`. */
export interface CelebrationTier {
    streak: number;
    text: string;
    color: Color;
    outline: Color;
    /** Tamanho do texto (fonte) e quantidade de estouros de particulas. */
    size: number;
    bursts: number;
}

/**
 * Parabeniza o jogador por combos feitos rapido: texto grande que pula, balanca e sobe esvaecendo, com estouros de
 * particulas (reaproveita o prefab de merge, tingido na cor do degrau). So um por vez: o novo substitui o anterior.
 */
export class CelebrationFx {
    private static current: Node | null = null;

    public static show(parent: Node, at: Vec3, tier: CelebrationTier, streak: number, effectPrefab: Prefab | null) {
        if (!parent || !parent.isValid) return;
        if (this.current && this.current.isValid) { Tween.stopAllByTarget(this.current); this.current.destroy(); }

        const root = new Node('Celebration');
        root.layer = parent.layer;
        root.parent = parent;
        root.setPosition(at);
        root.addComponent(UITransform).setContentSize(10, 10);
        const opacity = root.addComponent(UIOpacity);
        this.current = root;

        // Texto principal + subtitulo com o tamanho da sequencia.
        const main = this.makeLabel(root, tr(tier.text), tier.size, 0, 0, tier.color, tier.outline, 3);
        const sub = this.makeLabel(root, tr('FAST COMBO x{0}', streak), Math.round(tier.size * 0.42), 0, -tier.size * 0.78, Color.WHITE, new Color(20, 30, 60, 255), 2);
        void main; void sub;

        // Animacao: surge pulando, balanca, sobe e esvaece.
        root.setScale(0.15, 0.15, 1);
        const tilt = tier.streak % 2 === 0 ? 7 : -7;
        tween(root)
            .to(0.16, { scale: new Vec3(1.45, 1.45, 1), eulerAngles: new Vec3(0, 0, tilt) }, { easing: 'quadOut' })
            .to(0.14, { scale: new Vec3(1, 1, 1), eulerAngles: new Vec3(0, 0, -tilt * 0.5) }, { easing: 'backOut' })
            .to(0.1, { eulerAngles: new Vec3(0, 0, 0) })
            .delay(0.6)
            .to(0.45, { position: new Vec3(at.x, at.y + 80, 0), scale: new Vec3(1.12, 1.12, 1) })
            .call(() => { if (this.current === root) this.current = null; root.destroy(); })
            .start();
        tween(opacity).delay(0.95).to(0.4, { opacity: 0 }).start();

        // Particulas: um estouro no centro e, nos degraus altos, estouros laterais.
        if (effectPrefab) {
            const offsets = [0, -150, 150, -75, 75, 0];
            for (let i = 0; i < Math.min(tier.bursts, offsets.length); i++) {
                const delay = i === 0 ? 0 : 0.08 * i;
                root.scene && tween(root).delay(delay).call(() => this.burst(parent, at, offsets[i], tier, effectPrefab)).start();
            }
        }
    }

    private static burst(parent: Node, at: Vec3, dx: number, tier: CelebrationTier, prefab: Prefab) {
        if (!parent.isValid) return;
        const fx = instantiate(prefab);
        fx.parent = parent;
        fx.setPosition(at.x + dx, at.y + (dx === 0 ? 0 : 20), 0);
        const k = 1.7 + tier.bursts * 0.12;
        fx.setScale(k, k, 1);
        const tint = new Color(tier.color.r, tier.color.g, tier.color.b, 255);
        const fade = new Color(tier.color.r, tier.color.g, tier.color.b, 0);
        fx.getComponentsInChildren(ParticleSystem2D).forEach(ps => {
            ps.startColor = tint;
            ps.endColor = fade;
            ps.resetSystem();
        });
        // Acima do texto/tabuleiro.
        fx.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingOrder = 480; });
    }

    public static makeLabel(parent: Node, text: string, size: number, x: number, y: number, color: Color, outline: Color, order: number): Label {
        const n = new Node('Text');
        n.layer = parent.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(900, size * 1.4);
        const label = n.addComponent(Label);
        const font: Font | null = OrderManager.instance ? OrderManager.instance.font : null;
        if (font) { label.useSystemFont = false; label.font = font; }
        label.string = text;
        label.fontSize = size;
        label.lineHeight = Math.round(size * 1.15);
        label.isBold = true;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(4, Math.round(size / 9));
        n.addComponent(Sorting2D).sortingOrder = 470 + order;
        return label;
    }
}
