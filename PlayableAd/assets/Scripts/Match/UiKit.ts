import { Color, Label, Node, Sorting2D, Sprite, SpriteFrame, UITransform } from 'cc';
import { Fonts } from './Fonts';
import { Haptics } from './Haptics';
import { PowerupManager } from './PowerupManager';
import { SoundManager } from './SoundManager';
import { WindowAnim } from './WindowAnim';
import { tr } from './I18n';

/** Pecas de interface compartilhadas pelas janelas novas (Diario, Colecao): usam os mesmos frames do PowerupManager. */
export class UiKit {
    public static get pm(): PowerupManager | null { return PowerupManager.instance || null; }

    public static node(parent: Node, name: string, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = parent.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    public static sprite(n: Node, frame: SpriteFrame | null, order: number, sliced: boolean = false): Sprite {
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sliced) sp.type = Sprite.Type.SLICED;
        sp.spriteFrame = frame;
        n.addComponent(Sorting2D).sortingOrder = order;
        return sp;
    }

    public static label(parent: Node, text: string, size: number, w: number, h: number, x: number, y: number, order: number,
        color: Color = Color.WHITE, outline: Color = new Color(10, 20, 40, 255), left: boolean = false, regular: boolean = false): Label {
        const n = UiKit.node(parent, 'Text', x, y, w, h);
        const label = n.addComponent(Label);
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        const font = regular ? (Fonts.regular || Fonts.bold) : (Fonts.bold || UiKit.pm?.font || null);
        if (font) { label.useSystemFont = false; label.font = font; }
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.color = color;
        label.isBold = false;
        label.horizontalAlign = left ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 10));
        if (left) n.getComponent(UITransform)!.anchorX = 0;
        n.addComponent(Sorting2D).sortingOrder = order;
        return label;
    }

    /** Botao verde (mesmo do jogo) tingido, com texto; `onTap` devolve false para tocar o som de bloqueado. */
    public static button(parent: Node, text: string, x: number, y: number, w: number, h: number, order: number, tint: Color,
        onTap: () => boolean | void): { node: Node, label: Label, bg: Sprite } {
        const node = UiKit.node(parent, 'Button', x, y, w, h);
        const bg = UiKit.sprite(node, UiKit.pm?.buttonFrame || null, order, true);
        bg.color = tint;
        const label = UiKit.label(node, text, Math.round(h * 0.45), w - 16, h - 10, 0, 3, order + 1);
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.93, 0.93, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => {
            node.setScale(1, 1, 1);
            const r = onTap();
            if (r === false) SoundManager.playBlocked(); else SoundManager.playMenuClick();
        });
        return { node, label, bg };
    }

    /** Botao do menu (holder + icone + nome + bolinha vermelha com contagem). */
    public static menuButton(parent: Node, name: string, x: number, y: number, order: number, size: number,
        icon: SpriteFrame | null, text: string, onTap: () => void): { node: Node, dot: Label } | null {
        const pm = UiKit.pm;
        if (!pm) return null;
        const node = UiKit.node(parent, name, x, y, size, size);
        UiKit.sprite(node, pm.holderFrame, order);
        const iconNode = UiKit.node(node, 'Icon', 0, 3, size * 0.7, size * 0.7);
        UiKit.sprite(iconNode, icon, order + 1);
        UiKit.label(node, text, 16, size + 30, 22, 0, -size * 0.58, order + 2);
        const dot = UiKit.node(node, 'Dot', size * 0.4, size * 0.4, 34, 34);
        UiKit.sprite(dot, pm.pointsFrame, order + 3, true).color = new Color(230, 40, 40, 255);
        const dotLabel = UiKit.label(dot, '0', 22, 30, 28, 0, 0, order + 4);
        dot.active = false;
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.92, 0.92, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); SoundManager.playMenuClick(); Haptics.tick(); onTap(); });
        return { node, dot: dotLabel };
    }

    /** Janela padrao (fade escuro, painel 1000x600 com titulo e X), animada pelo WindowAnim. */
    public static windowShell(name: string, title: string): { root: Node, win: Node, base: number, open: () => void, close: () => void } | null {
        const pm = UiKit.pm;
        if (!pm) return null;
        const base = pm.windowSortingBase;
        const canvas = pm.node.parent || pm.node;
        const root = UiKit.node(canvas, name, 0, 0, 1280, 720);
        const close = () => { SoundManager.playOpenMenu(); WindowAnim.close(root); };
        const dim = UiKit.node(root, 'Dim', 0, 0, 1400, 800);
        UiKit.sprite(dim, pm.dimFrame, base).color = new Color(0, 0, 0, 190);
        dim.on(Node.EventType.TOUCH_END, () => { SoundManager.playMenuClick(); close(); });
        const W = 1000, H = 600;
        const win = UiKit.node(root, 'Window', 0, 0, W, H);
        UiKit.sprite(win, pm.windowFrame, base + 1, true);
        [Node.EventType.TOUCH_START, Node.EventType.TOUCH_END].forEach(t => win.on(t, () => { }));
        UiKit.label(win, title, 46, 560, 60, 0, H / 2 - 62, base + 3, Color.WHITE, new Color(20, 70, 120, 255));
        UiKit.button(win, 'X', W / 2 - 78, H / 2 - 62, 64, 56, base + 3, new Color(255, 120, 120, 255), () => close());
        root.active = false;
        return {
            root, win, base,
            close,
            open: () => {
                const parent = root.parent;
                if (parent) root.setSiblingIndex(parent.children.length - 1);
                SoundManager.playOpenMenu();
                WindowAnim.open(root);
            },
        };
    }
}
