import { Color, instantiate, Label, Node, ParticleSystem2D, Sorting2D, Sprite, tween, Tween, UIOpacity, UITransform, Vec3, director } from 'cc';
import { tr } from './I18n';
import { GameManager } from './GameManager';
import { MatchElement } from './MatchElement';
import { OrderManager } from './OrderManager';
import { ComboManager } from './ComboManager';
import { PowerupManager } from './PowerupManager';
import { SoundManager } from './SoundManager';
import { ElementCatalog } from './ElementCatalog';
import { ElementType } from './ElementType';
import { CelebrationFx } from './CelebrationFx';
import { Responsive } from './Responsive';

/**
 * Golden Time: entregar um pedido de OURO no prazo faz todos os alimentos do tabuleiro virarem moedas por alguns
 * segundos. Tocar numa moeda a coleta (moedas em dobro); isso NAO conclui pedidos, e so para ganhar moedas. Ao acabar,
 * os itens voltam a ser alimentos e sao redistribuidos para repor o que foi coletado e manter os pedidos concluiveis.
 * Todo o Golden Time (anuncio, tutorial e contagem) segura o tempo (cronometro, prazos, combo) e a fase nao muda
 * ate ele acabar (veja GameManager.CompleteLevel).
 */
export class GoldenTime {
    /** Os alimentos estao virando/sao moedas e podem ser coletados (a contagem comecou ou esta por comecar). */
    public static active: boolean = false;
    private static counting: boolean = false;
    private static remaining: number = 0;
    private static hud: Node | null = null;
    private static hudLabel: Label | null = null;
    private static collected: number = 0;
    private static epoch: number = 0;

    private static readonly GOLD = new Color(255, 214, 51, 255);
    private static readonly GOLD_OUT = new Color(130, 70, 0, 255);
    private static readonly ORDER_FX = 480;

    // ---------- Ciclo ----------

    /** Chamado pelo OrderManager ao entregar um pedido de ouro no prazo. */
    public static start() {
        const gm = GameManager.instance;
        const canvas = gm ? gm.node.parent : null;
        if (!gm || !canvas || this.active) return;
        // Nunca por cima de outro tutorial/dica (1o Golden Time tem o proprio tutorial, aberto depois do anuncio).
        const busy: any = director.getScene()?.getComponentInChildren('TutorialManager');
        if (busy && typeof busy.isBusy === 'function' && busy.isBusy()) return;
        this.active = true;
        this.counting = false;
        this.collected = 0;
        const my = ++this.epoch;
        gm.timeHeld = true; // tempo parado desde o anuncio ate o fim (reafirmado a cada quadro em tick)

        SoundManager.playGoldenTime();
        this.explosion(canvas);
        this.banner(canvas);
        this.transformToCoins();

        // 1a vez: explica (para o tempo) ate o jogador tocar; depois a contagem comeca. Nas demais, comeca logo.
        const tm: any = director.getScene()?.getComponentInChildren('TutorialManager');
        const begin = () => { if (my === this.epoch && this.active) this.beginCountdown(); };
        // O anuncio fica na tela por ~2,7s (tempo de ler) antes da contagem/tutorial.
        tween(canvas).delay(2.7).call(() => {
            if (my !== this.epoch || !this.active) return;
            if (tm && typeof tm.showGoldenIntro === 'function') tm.showGoldenIntro(begin); else begin();
        }).start();
    }

    private static beginCountdown() {
        const gm = GameManager.instance;
        if (!gm) return;
        this.counting = true;
        this.remaining = gm.goldenSeconds;
        this.showHud();
    }

    public static tick(dt: number) {
        if (!this.active) return;
        const gm = GameManager.instance;
        if (!gm || !gm.IsRunning()) return;
        gm.timeHeld = true; // (o tutorial do 1o Golden Time solta o tempo ao fechar: reafirma)
        if (!this.counting) return;
        this.remaining -= dt;
        if (this.hudLabel && this.hudLabel.isValid) this.hudLabel.string = `${tr('GOLDEN TIME')}  ${Math.max(0, this.remaining).toFixed(1)}s   x${this.collected}`;
        if (this.remaining <= 0) this.end();
    }

    /** Interrompe sem animacao (troca de fase / fim de nivel): os itens ja serao varridos. */
    public static abort() {
        if (!this.active) return;
        this.epoch++;
        this.active = false;
        this.counting = false;
        this.hideHud();
        const gm = GameManager.instance;
        if (gm) gm.timeHeld = false;
    }

    private static end() {
        this.epoch++;
        this.counting = false;
        this.hideHud();
        const gm = GameManager.instance;
        const mc: any = gm && gm.node.parent ? gm.node.parent.getComponentInChildren('MatchController') : null;
        const initializer: any = director.getScene()?.getComponentInChildren('MatchInitializer');
        const els = this.boardElements();

        // Redistribui os alimentos para que os pedidos que sobraram ainda possam ser concluidos.
        const created = this.redistribute(els, mc, initializer);
        this.transformBack(els, created);
        // Pedidos e cronometro voltam logo depois da volta suave.
        tween(gm!.node).delay(0.55).call(() => {
            this.active = false;
            if (GameManager.instance) GameManager.instance.timeHeld = false; // pedidos, cronometro e fase seguem
        }).start();
    }

    // ---------- Coletar ----------

    public static collect(el: MatchElement) {
        const gm = GameManager.instance;
        if (!this.active || !this.counting || !gm || !gm.IsRunning() || !el.isValid || !el.isAvailable) return;
        el.isAvailable = false;
        this.collected++;

        // Moedas em dobro voam ate o placar.
        const cm = ComboManager.instance, pm = PowerupManager.instance;
        const wp = el.node.worldPosition.clone();
        const gained = cm ? cm.RegisterGoldenItem() : 0;
        if (gained > 0 && cm && pm && pm.canFlyCoins) {
            cm.HoldDisplay(gained);
            pm.FlyCoins(wp, 4, gained);
        }
        SoundManager.playCoin();

        const node = el.node;
        Tween.stopAllByTarget(node);
        const parent = node.parent;
        if (parent) this.burst(parent, node.position, 0.8, 1);
        tween(node).to(0.16, { scale: new Vec3(1.7, 1.7, 1) }, { easing: 'quadOut' })
            .to(0.14, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .call(() => { if (node.isValid) node.destroy(); }).start();
    }

    // ---------- Visual: virar moedas e voltar ----------

    private static boardElements(): MatchElement[] {
        const scene = director.getScene();
        const gm = GameManager.instance;
        const board = gm && gm.node.parent ? gm.node.parent.getChildByName('MatchSpace') : null;
        if (!scene || !board) return [];
        return board.getComponentsInChildren(MatchElement).filter(e => e.isValid && e.isAvailable);
    }

    private static transformToCoins() {
        SoundManager.playCoinSwitch();
        const pm = PowerupManager.instance;
        const frame = pm ? pm.coinFrame : null;
        const els = this.boardElements();
        if (els.length === 0) return;
        const cx = els.reduce((s, e) => s + e.node.position.x, 0) / els.length;
        const cy = els.reduce((s, e) => s + e.node.position.y, 0) / els.length;
        let maxD = 1;
        els.forEach(e => { maxD = Math.max(maxD, Math.hypot(e.node.position.x - cx, e.node.position.y - cy)); });

        els.forEach(el => {
            const node = el.node;
            const sprite = el.spriteComponent || el.getComponent(Sprite);
            if (!sprite) return;
            Tween.stopAllByTarget(node);
            node.setRotationFromEuler(0, 0, 0);
            const base = el.availableScale.clone();
            const d = Math.hypot(node.position.x - cx, node.position.y - cy) / maxD;
            // Onda do centro para fora: gira (vira de lado), troca para a moeda e volta brilhando.
            tween(node)
                .delay(d * 0.4)
                .to(0.1, { scale: new Vec3(base.x * 1.5, base.y * 1.5, 1) }, { easing: 'quadOut' })
                .to(0.1, { scale: new Vec3(0.02, base.y * 1.5, 1) })
                .call(() => {
                    if (!node.isValid) return;
                    if (frame) {
                        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                        sprite.spriteFrame = frame;
                        sprite.trim = false;
                        node.getComponent(UITransform)?.setContentSize(86, 86);
                    }
                    sprite.color = new Color(255, 245, 190, 255);
                })
                .to(0.18, { scale: new Vec3(base.x * 1.3, base.y * 1.3, 1) }, { easing: 'backOut' })
                .call(() => this.shimmer(node, sprite, base))
                .start();
        });
    }

    /** Moeda reluzente: pulsa e pisca em tons de ouro ate o fim do Golden Time. */
    private static shimmer(node: Node, sprite: Sprite, base: Vec3) {
        if (!node.isValid) return;
        const k = 1.3, big = 1.42;
        tween(node)
            .delay(Math.random() * 0.3)
            .to(0.32, { scale: new Vec3(base.x * big, base.y * big, 1) }, { easing: 'sineInOut' })
            .to(0.32, { scale: new Vec3(base.x * k, base.y * k, 1) }, { easing: 'sineInOut' })
            .union().repeatForever().start();
        tween(sprite)
            .delay(Math.random() * 0.3)
            .to(0.3, { color: new Color(255, 255, 255, 255) })
            .to(0.3, { color: new Color(255, 215, 90, 255) })
            .union().repeatForever().start();
    }

    /** Volta rapida e suave: a moeda vira de lado e reaparece como alimento (ja redistribuido). */
    private static transformBack(els: MatchElement[], created: MatchElement[]) {
        SoundManager.playCoinSwitch();
        els.forEach((el, i) => {
            if (!el.isValid || !el.node || !el.isAvailable) return;
            const node = el.node;
            const sprite = el.spriteComponent || el.getComponent(Sprite);
            Tween.stopAllByTarget(node);
            if (sprite) Tween.stopAllByTarget(sprite);
            const base = el.availableScale.clone();
            tween(node)
                .delay((i % 12) * 0.015)
                .to(0.1, { scale: new Vec3(0.02, base.y * 1.2, 1) }, { easing: 'sineIn' })
                .call(() => {
                    if (!node.isValid) return;
                    if (sprite) { sprite.color = Color.WHITE; ElementCatalog.applyFitted(sprite, el.type, 90); }
                })
                .to(0.2, { scale: base }, { easing: 'backOut' })
                .start();
        });
        // Itens novos (reposicao) entram com um pulo.
        created.forEach((el, i) => {
            const node = el.node, base = el.availableScale.clone();
            node.setScale(0, 0, 1);
            tween(node).delay(0.12 + i * 0.03).to(0.25, { scale: base }, { easing: 'backOut' }).start();
        });
    }

    /** Ajusta os tipos dos itens do tabuleiro ao que ainda falta nos pedidos (cria itens se faltar). Devolve os criados. */
    private static redistribute(els: MatchElement[], mc: any, initializer: any): MatchElement[] {
        const orders = OrderManager.instance;
        if (!orders) return [];
        const demand = orders.RemainingDemand();
        // (RemainingDemand ja desconta o que os pedidos receberam.)

        const alive = els.filter(e => e.isValid && e.isAvailable);
        const spare: MatchElement[] = [];
        alive.forEach(e => {
            const need = demand.get(e.type) || 0;
            if (need > 0) demand.set(e.type, need - 1); else spare.push(e);
        });

        const missing: ElementType[] = [];
        demand.forEach((n, t) => { for (let i = 0; i < n; i++) missing.push(t); });
        const created: MatchElement[] = [];
        missing.forEach(t => {
            const el = spare.pop();
            if (el) {
                el.type = t; // o sprite e aplicado na volta (transformBack)
            } else if (initializer) {
                const made: MatchElement | null = initializer.CreateMatchElement(t, true);
                if (made) { made.spawnAnimated = true; created.push(made); }
            }
        });
        return created;
    }

    // ---------- Efeitos de abertura ----------

    /** Explosao de particulas douradas pela tela inteira + clarao dourado. */
    private static explosion(canvas: Node) {
        const gm = GameManager.instance;
        const prefab = gm ? gm.timeEffectPrefab : null;
        const w = Responsive.width, h = Responsive.height;
        const spots: [number, number][] = [];
        for (let ix = -1; ix <= 1; ix++) for (let iy = -2; iy <= 2; iy++) spots.push([ix * w * 0.33, iy * h * 0.2]);
        const tint = new Color(this.GOLD.r, this.GOLD.g, this.GOLD.b, 255);
        const fade = new Color(255, 170, 30, 0);
        if (prefab) {
            spots.forEach(([x, y], i) => {
                tween(canvas).delay(i * 0.03).call(() => {
                    if (!canvas.isValid) return;
                    const fx = instantiate(prefab);
                    fx.parent = canvas;
                    fx.setPosition(x, y, 0);
                    const k = 2.6 + Math.random() * 0.8;
                    fx.setScale(k, k, 1);
                    fx.getComponentsInChildren(ParticleSystem2D).forEach(ps => { ps.startColor = tint; ps.endColor = fade; ps.resetSystem(); });
                    fx.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingOrder = this.ORDER_FX; });
                }).start();
            });
        }
        // Clarao dourado na tela inteira.
        const frame = PowerupManager.instance ? PowerupManager.instance.dimFrame : null;
        if (frame) {
            const flash = new Node('GoldenFlash');
            flash.layer = canvas.layer;
            flash.parent = canvas;
            flash.addComponent(UITransform).setContentSize(w + 100, h + 100);
            const sp = flash.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frame;
            sp.color = new Color(255, 205, 50, 255);
            flash.addComponent(Sorting2D).sortingOrder = this.ORDER_FX - 5;
            const op = flash.addComponent(UIOpacity);
            op.opacity = 150;
            tween(op).to(0.7, { opacity: 0 }).call(() => { if (flash.isValid) flash.destroy(); }).start();
        }
    }

    /** Texto "GOLDEN TIME!" ao mesmo tempo que as particulas. */
    private static banner(canvas: Node) {
        const root = new Node('GoldenBanner');
        root.layer = canvas.layer;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(10, 10);
        const board = canvas.getChildByName('MatchSpace');
        const at = board ? new Vec3(board.position.x, board.position.y + 30, 0) : new Vec3(0, 60, 0);
        root.setPosition(at);
        const op = root.addComponent(UIOpacity);
        const size = Responsive.portrait ? 84 : 104;
        CelebrationFx.makeLabel(root, tr('GOLDEN TIME!'), size, 0, 0, this.GOLD, this.GOLD_OUT, 6);
        CelebrationFx.makeLabel(root, tr('x2 COINS - GRAB THEM ALL!'), Math.round(size * 0.34), 0, -size * 0.85, Color.WHITE, new Color(90, 50, 0, 255), 5);
        root.setScale(0.15, 0.15, 1);
        tween(root)
            .to(0.22, { scale: new Vec3(1.35, 1.35, 1), eulerAngles: new Vec3(0, 0, 5) }, { easing: 'quadOut' })
            .to(0.15, { scale: Vec3.ONE, eulerAngles: new Vec3(0, 0, -3) }, { easing: 'backOut' })
            .to(0.1, { eulerAngles: new Vec3(0, 0, 0) })
            .delay(1.9)
            .to(0.4, { position: new Vec3(at.x, at.y + 120, 0), scale: new Vec3(1.1, 1.1, 1) })
            .call(() => root.destroy())
            .start();
        tween(op).delay(2.3).to(0.4, { opacity: 0 }).start();
    }

    private static burst(parent: Node, at: Vec3, scale: number, order: number) {
        const gm = GameManager.instance;
        const prefab = gm ? gm.timeEffectPrefab : null;
        if (!prefab || !parent.isValid) return;
        const fx = instantiate(prefab);
        fx.parent = parent;
        fx.setPosition(at.x, at.y, 0);
        fx.setScale(scale, scale, 1);
        const tint = new Color(this.GOLD.r, this.GOLD.g, this.GOLD.b, 255);
        fx.getComponentsInChildren(ParticleSystem2D).forEach(ps => { ps.startColor = tint; ps.endColor = new Color(255, 170, 30, 0); ps.resetSystem(); });
        fx.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingOrder = 440 + order; });
    }

    // ---------- HUD ----------

    private static showHud() {
        const gm = GameManager.instance;
        const canvas = gm ? gm.node.parent : null;
        if (!canvas) return;
        this.hideHud();
        const root = new Node('GoldenHud');
        root.layer = canvas.layer;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(10, 10);
        const board = canvas.getChildByName('MatchSpace');
        const ut = board ? board.getComponent(UITransform) : null;
        const y = board && ut ? board.position.y + ut.height * 0.5 * board.scale.y + 24 : 260;
        root.setPosition(board ? board.position.x : 0, y, 0);
        this.hudLabel = CelebrationFx.makeLabel(root, tr('GOLDEN TIME'), Responsive.portrait ? 42 : 48, 0, 0, this.GOLD, this.GOLD_OUT, 4);
        this.hud = root;
        tween(root).by(0.35, { position: new Vec3(0, 6, 0) }, { easing: 'sineInOut' })
            .by(0.35, { position: new Vec3(0, -6, 0) }, { easing: 'sineInOut' }).union().repeatForever().start();
    }

    private static hideHud() {
        if (this.hud && this.hud.isValid) { Tween.stopAllByTarget(this.hud); this.hud.destroy(); }
        this.hud = null;
        this.hudLabel = null;
    }
}
