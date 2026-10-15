import { Color, instantiate, Node, ParticleSystem2D, Sorting2D, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { MatchElement } from './MatchElement';
import { OrderManager } from './OrderManager';
import { PowerupManager } from './PowerupManager';
import { SoundManager } from './SoundManager';
import { ElementType } from './ElementType';

/**
 * Raio: item raro que cai no tabuleiro depois de um merge (com efeito de relampago). Ao ser tocado, ele mesmo
 * seleciona, com raios e particulas, TODOS os alimentos do proximo pedido (o prioritario, o 1o da tela).
 */
export class RayPickup {
    private static node: Node | null = null;
    private static lastSpawn: number = -1e9;
    private static readonly SIZE = 112;
    private static readonly YELLOW = new Color(255, 232, 80, 255);
    private static readonly CYAN = new Color(120, 220, 255, 255);

    // ---------- Aparecer ----------

    /** Chamado depois de cada merge: com baixa chance (e com intervalo minimo) o raio cai no tabuleiro. */
    public static maybeSpawn() {
        const gm = GameManager.instance;
        if (!gm || !gm.rayIcon || !gm.IsRunning() || gm.timeHeld) return;
        if (this.node && this.node.isValid) return;
        if (performance.now() - this.lastSpawn < gm.rayCooldown * 1000) return;
        if (Math.random() >= gm.rayChance) return;
        if (!this.pickNext().length) return; // nada para o raio selecionar
        this.spawn(gm);
    }

    private static boardNode(gm: GameManager): Node | null {
        return gm.node.parent ? gm.node.parent.getChildByName('MatchSpace') : null;
    }

    private static spawn(gm: GameManager) {
        const board = this.boardNode(gm);
        const icon = gm.rayIcon;
        if (!board || !icon) return;
        this.lastSpawn = performance.now();

        const ut = board.getComponent(UITransform);
        const inset = 130;
        const w = ut ? Math.max(0, ut.width - inset) : 500, h = ut ? Math.max(0, ut.height - inset) : 400;
        const x = ((ut ? 0.5 - ut.anchorX : 0) * (ut ? ut.width : 0)) + (Math.random() - 0.5) * w;
        const y = ((ut ? 0.5 - ut.anchorY : 0) * (ut ? ut.height : 0)) + (Math.random() - 0.5) * h;

        const root = new Node('RayPickup');
        root.layer = board.layer;
        root.parent = board;
        root.setPosition(x, y, 0);
        root.addComponent(UITransform).setContentSize(this.SIZE, this.SIZE);
        this.node = root;

        // Brilho atras (pulsa) + icone.
        const glow = this.makeSprite(root, 'Glow', icon, this.SIZE * 1.7, new Color(255, 235, 90, 140), 4);
        const op = glow.addComponent(UIOpacity);
        const img = this.makeSprite(root, 'Icon', icon, this.SIZE, Color.WHITE, 5);
        void img;
        tween(op).to(0.5, { opacity: 90 }).to(0.5, { opacity: 255 }).union().repeatForever().start();
        tween(root).by(0.7, { position: new Vec3(0, 7, 0) }, { easing: 'sineInOut' })
            .by(0.7, { position: new Vec3(0, -7, 0) }, { easing: 'sineInOut' }).union().repeatForever().start();

        // Cai um relampago de cima e o raio aparece com um estouro.
        const top = new Vec3(x + (Math.random() - 0.5) * 120, y + 520, 0);
        this.bolt(board, top, new Vec3(x, y, 0), this.CYAN, 14, 0.28);
        this.bolt(board, top, new Vec3(x, y, 0), Color.WHITE, 6, 0.28);
        this.burst(board, new Vec3(x, y, 0), 2.2);
        SoundManager.playRayEnabled();
        root.setScale(0, 0, 1);
        tween(root).to(0.3, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' }).to(0.1, { scale: Vec3.ONE }).start();

        // Faiscas em volta enquanto espera; fica por cima dos itens (ordem da hierarquia = ordem do toque).
        tween(root).delay(0.35).call(() => {
            if (!root.isValid) return;
            root.setSiblingIndex(root.parent!.children.length - 1);
            const p = root.position;
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2, r1 = 38, r2 = 70 + Math.random() * 30;
                this.bolt(board, new Vec3(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1, 0),
                    new Vec3(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2, 0), Math.random() < 0.5 ? this.YELLOW : this.CYAN, 6, 0.14);
            }
        }).union().repeatForever().start();

        root.on(Node.EventType.TOUCH_END, () => this.activate(gm, root));

        // Some sozinho se ninguem pegar (pisca no final).
        tween(root).delay(13).call(() => this.expire(root)).start();
    }

    private static expire(root: Node) {
        if (!root.isValid) return;
        root.off(Node.EventType.TOUCH_END);
        const op = root.getComponentInChildren(UIOpacity);
        tween(root).to(0.15, { scale: new Vec3(1.2, 1.2, 1) }).to(0.15, { scale: Vec3.ONE })
            .to(0.15, { scale: new Vec3(1.2, 1.2, 1) }).to(0.2, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .call(() => { Tween.stopAllByTarget(root); if (root.isValid) root.destroy(); if (this.node === root) this.node = null; })
            .start();
        void op;
    }

    /** Remove o raio da tela (troca de fase). */
    public static clear() {
        if (this.node && this.node.isValid) { Tween.stopAllByTarget(this.node); this.node.destroy(); }
        this.node = null;
    }

    // ---------- Usar ----------

    /** Os alimentos que faltam para completar o proximo pedido inteiro (todas as linhas), limitados pelas vagas da prateleira. */
    private static pickNext(): MatchElement[] {
        const gm = GameManager.instance;
        const orders = OrderManager.instance;
        const scene = gm ? gm.node.parent : null;
        const board = scene ? scene.getChildByName('MatchSpace') : null;
        const mc: any = gm && scene ? scene.getComponentInChildren('MatchController') : null;
        const slots: any = scene ? scene.getComponentInChildren('MatchSlots') : null;
        if (!gm || !orders || !board || !mc) return [];

        const lines = orders.GetPriorityOrderLines();
        if (lines.length === 0) return [];

        const selectedByType = new Map<ElementType, number>();
        (mc.selectedElements as MatchElement[]).forEach(e => selectedByType.set(e.type, (selectedByType.get(e.type) || 0) + 1));
        const free = slots ? slots.FreeCount() : 99;
        const candidates = board.getComponentsInChildren(MatchElement).filter(e => e.isAvailable && e.isValid);

        const picks: MatchElement[] = [];
        for (const line of lines) {
            const have = Math.min(selectedByType.get(line.type) || 0, line.quantity);
            const need = line.quantity - have;
            selectedByType.set(line.type, Math.max(0, (selectedByType.get(line.type) || 0) - have));
            if (need <= 0) continue;
            const of = candidates.filter(e => e.type === line.type && picks.indexOf(e) === -1).slice(0, need);
            // So linhas inteiras: se nao cabem na prateleira, para aqui.
            if (picks.length + of.length > free) break;
            picks.push(...of);
        }
        return picks;
    }

    private static activate(gm: GameManager, root: Node) {
        if (!gm.IsRunning() || !root.isValid) return;
        const picks = this.pickNext();
        const board = root.parent;
        if (!board) return;
        root.off(Node.EventType.TOUCH_END);
        Tween.stopAllByTarget(root);
        if (this.node === root) this.node = null;

        const from = root.position.clone();
        this.burst(board, from, 2.6);

        // Um raio liga o icone a cada alimento escolhido, com estouro de particulas; depois eles sao selecionados.
        picks.forEach((el, i) => {
            tween(board).delay(i * 0.14).call(() => {
                if (!el.isValid || !el.node || !el.isAvailable) return;
                const to = el.node.position.clone();
                this.bolt(board, from, to, this.CYAN, 14, 0.3);
                this.bolt(board, from, to, Color.WHITE, 6, 0.3);
                this.burst(board, to, 1.5);
                SoundManager.playRaySelect();
                el.OnClick();
            }).start();
        });

        tween(root).to(0.18, { scale: new Vec3(1.6, 1.6, 1) })
            .to(0.2, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .delay(Math.max(0, picks.length * 0.14 - 0.3))
            .call(() => { if (root.isValid) root.destroy(); })
            .start();
    }

    // ---------- Efeitos ----------

    private static makeSprite(parent: Node, name: string, frame: SpriteFrame, size: number, color: Color, order: number): Node {
        const n = new Node(name);
        n.layer = parent.layer;
        n.parent = parent;
        n.addComponent(UITransform).setContentSize(size, size);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = frame;
        sp.color = color;
        n.addComponent(Sorting2D).sortingOrder = order;
        return n;
    }

    /** Relampago em zigue-zague entre dois pontos (locais ao `parent`), que piscar e some. */
    private static bolt(parent: Node, from: Vec3, to: Vec3, color: Color, width: number, life: number) {
        const frame = PowerupManager.instance ? PowerupManager.instance.dimFrame : null;
        if (!frame || !parent.isValid) return;
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len < 4) return;
        const segs = Math.max(3, Math.min(9, Math.round(len / 55)));
        const nx = -dy / len, ny = dx / len; // normal
        const pts: Vec3[] = [from.clone()];
        for (let i = 1; i < segs; i++) {
            const t = i / segs, jitter = (Math.random() - 0.5) * Math.min(70, len * 0.35);
            pts.push(new Vec3(from.x + dx * t + nx * jitter, from.y + dy * t + ny * jitter, 0));
        }
        pts.push(to.clone());

        const holder = new Node('Bolt');
        holder.layer = parent.layer;
        holder.parent = parent;
        const op = holder.addComponent(UIOpacity);
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const sx = b.x - a.x, sy = b.y - a.y, sl = Math.hypot(sx, sy);
            const seg = new Node('Seg');
            seg.layer = parent.layer;
            seg.parent = holder;
            seg.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
            seg.setRotationFromEuler(0, 0, Math.atan2(sy, sx) * 180 / Math.PI);
            seg.addComponent(UITransform).setContentSize(sl + width * 0.6, width);
            const sp = seg.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frame;
            sp.color = color;
            seg.addComponent(Sorting2D).sortingOrder = 9;
        }
        tween(op).to(life * 0.4, { opacity: 255 }).to(life * 0.6, { opacity: 0 }).call(() => { if (holder.isValid) holder.destroy(); }).start();
    }

    /** Estouro de particulas amarelas (reaproveita o efeito de merge). */
    private static burst(parent: Node, at: Vec3, scale: number) {
        const gm = GameManager.instance;
        const prefab = gm ? gm.timeEffectPrefab : null;
        if (!prefab || !parent.isValid) return;
        const fx = instantiate(prefab);
        fx.parent = parent;
        fx.setPosition(at.x, at.y, 0);
        fx.setScale(scale, scale, 1);
        const tint = new Color(this.YELLOW.r, this.YELLOW.g, this.YELLOW.b, 255);
        const fade = new Color(this.CYAN.r, this.CYAN.g, this.CYAN.b, 0);
        fx.getComponentsInChildren(ParticleSystem2D).forEach(ps => { ps.startColor = tint; ps.endColor = fade; ps.resetSystem(); });
        fx.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingOrder = 440; });
    }
}
