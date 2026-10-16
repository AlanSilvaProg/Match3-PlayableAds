import { Color, instantiate, Node, ParticleSystem2D, Sorting2D, Sprite, tween, Tween, UIOpacity, UITransform, Vec3, director, Prefab } from 'cc';
import { tr } from './I18n';
import { GameManager } from './GameManager';
import { MatchElement } from './MatchElement';
import { LevelPlan, Meal } from './LevelConfig';
import { CelebrationFx } from './CelebrationFx';
import { RayPickup } from './RayPickup';
import { GoldenTime } from './GoldenTime';
import { SoundManager } from './SoundManager';
import { Responsive } from './Responsive';

export interface PhaseChangeOptions {
    /** Varre os itens que estao na tela antes da nova leva. */
    sweep: boolean;
    /** Mostra a faixa com o nome da refeicao. */
    banner: boolean;
    /** Troca o fundo conforme a refeicao (jantar = noite). */
    background: boolean;
}

/**
 * Troca de fase do nivel (cafe da manha -> almoco -> jantar): os itens atuais sao varridos da tela com uma onda
 * animada, o nome da refeicao aparece numa faixa (e o fundo vira noite no jantar) e a nova leva de alimentos entra
 * num burst com particulas. Tambem usado para recomecar uma fase do checkpoint.
 */
export class PhaseFlow {
    private static readonly BANNER_ORDER = 470;
    private static readonly SWEEP_TIME = 1.0;
    private static readonly BURST_SPREAD = 0.55;
    private static readonly BURST_ITEM_TIME = 0.5;

    private static readonly MEAL_STYLE: { [m: number]: { text: string, color: Color, outline: Color, burst: Color } } = {
        [Meal.Breakfast]: { text: 'BREAKFAST TIME!', color: new Color(255, 214, 70, 255), outline: new Color(130, 70, 0, 255), burst: new Color(255, 200, 60, 255) },
        [Meal.Lunch]: { text: 'LUNCH TIME!', color: new Color(120, 255, 110, 255), outline: new Color(10, 90, 30, 255), burst: new Color(120, 255, 100, 255) },
        [Meal.Dinner]: { text: 'DINNER TIME!', color: new Color(190, 150, 255, 255), outline: new Color(50, 20, 120, 255), burst: new Color(170, 130, 255, 255) },
    };

    private static banner: Node | null = null;

    // ---------- API ----------

    /** Faixa de abertura do nivel (so aparece com a partida ja rodando, sem prompts por cima). */
    public static introBanner(gm: GameManager, plan: LevelPlan) {
        if (plan.phaseIndex !== 0) return;
        const canvas = gm.node.parent;
        if (!canvas) return;
        // Pequena espera: o jogo pode ainda estar no apelido/tutorial; nesse caso a faixa nao aparece.
        tween(canvas).delay(0.5).call(() => {
            if (gm.isValid && gm.IsRunning()) this.showBanner(canvas, plan.meal, plan.level, plan.phases.length > 1 ? tr('PART {0} OF {1}', 1, plan.phases.length) : '');
        }).start();
    }

    /**
     * Executa a troca: varre -> faixa/fundo -> burst da nova leva. `done` roda quando os itens ja estao no tabuleiro
     * (o chamador entao liga o cronometro e os pedidos).
     */
    public static change(gm: GameManager, plan: LevelPlan, opts: PhaseChangeOptions, done: () => void) {
        const canvas = gm.node.parent;
        const scene = director.getScene();
        const initializer: any = scene ? scene.getComponentInChildren('MatchInitializer') : null;
        if (!canvas || !initializer) { done(); return; }

        RayPickup.clear();
        GoldenTime.abort();
        const sweepTime = opts.sweep ? this.sweep(gm, canvas) : 0;
        tween(canvas).delay(sweepTime).call(() => {
            this.resetBoardState(scene);
            if (opts.background) this.setBackground(gm, canvas, plan.meal);
            if (opts.banner) {
                const sub = plan.phaseIndex > 0 ? tr('PART {0} OF {1} - NEW FOODS!', plan.phaseIndex + 1, plan.phases.length) : '';
                this.showBanner(canvas, plan.meal, plan.level, sub);
            }
            const created: MatchElement[] = initializer.BuildPhase(plan);
            const total = this.burstIn(gm, initializer.node as Node, created, plan.meal);
            tween(canvas).delay(total).call(() => done()).start();
        }).start();
    }

    // ---------- Varrer ----------

    /** Todos os itens (tabuleiro e prateleira) saem numa onda, girando. Devolve a duracao. */
    private static sweep(gm: GameManager, canvas: Node): number {
        const scene = director.getScene();
        const items = (scene ? scene.getComponentsInChildren(MatchElement) : []).filter(e => e.isValid && e.node && e.node.isValid);
        if (items.length === 0) return 0.1;
        SoundManager.playDropToOne();

        // A onda atravessa a tela da esquerda para a direita (ordem pela posicao no mundo).
        const xs = items.map(e => e.node.worldPosition.x);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const span = Math.max(1, maxX - minX);
        const waveTime = this.SWEEP_TIME * 0.5;
        const flyTime = this.SWEEP_TIME * 0.5;

        items.forEach(el => {
            const node = el.node;
            Tween.stopAllByTarget(node);
            const k = (node.worldPosition.x - minX) / span;
            const wp = node.worldPosition;
            const flyTo = new Vec3(wp.x + Responsive.width * 0.9 + Math.random() * 120, wp.y + (Math.random() - 0.5) * 260, wp.z);
            const local = new Vec3();
            const parent = node.parent;
            if (parent) parent.inverseTransformPoint(local, flyTo); else local.set(flyTo);
            const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360);
            const base = node.scale.clone();
            node.setSiblingIndex(node.parent ? node.parent.children.length - 1 : 0);
            el.SetSortingOrder(7);
            tween(node)
                .delay(k * waveTime)
                // Recua e infla (animacao de "preparar") antes de disparar.
                .to(0.12, { scale: new Vec3(base.x * 1.25, base.y * 1.25, 1) }, { easing: 'quadOut' })
                .to(flyTime, { position: local, scale: new Vec3(0.3, 0.3, 1), eulerAngles: new Vec3(0, 0, spin) }, { easing: 'quadIn' })
                .call(() => { if (node.isValid) node.destroy(); })
                .start();
        });
        return this.SWEEP_TIME + 0.2;
    }

    private static resetBoardState(scene: Node | null) {
        if (!scene) return;
        const controller: any = scene.getComponentInChildren('MatchController');
        controller?.ResetState();
    }

    // ---------- Burst da nova leva ----------

    /** Os itens nascem no centro do tabuleiro e espirram para os lugares, com particulas. Devolve a duracao. */
    private static burstIn(gm: GameManager, board: Node, items: MatchElement[], meal: Meal): number {
        if (items.length === 0) return 0.1;
        items.forEach(el => { el.spawnAnimated = true; });
        const n = items.length;
        const spread = Math.min(this.BURST_SPREAD, 0.012 * n + 0.2);
        const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);

        items.forEach((el, idx) => {
            const node = el.node;
            const target = node.position.clone();
            const scale = el.availableScale.clone();
            node.setPosition(0, 0, 0);
            node.setScale(0, 0, 1);
            node.setRotationFromEuler(0, 0, (Math.random() - 0.5) * 360);
            const delay = (order[idx] / n) * spread;
            tween(node)
                .delay(delay)
                .to(this.BURST_ITEM_TIME, { position: target, scale, eulerAngles: new Vec3(0, 0, 0) }, { easing: 'backOut' })
                .start();
        });

        // Particulas: estouros em leque a partir do centro, tingidos pela refeicao.
        const prefab: Prefab | null = gm.timeEffectPrefab;
        if (prefab) {
            const bursts = 5;
            const style = this.MEAL_STYLE[meal];
            for (let i = 0; i < bursts; i++) {
                tween(board).delay(i * (spread / bursts)).call(() => {
                    if (!board.isValid) return;
                    const fx = instantiate(prefab);
                    fx.parent = board;
                    fx.setPosition((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 0);
                    const k = 1.8 + Math.random() * 0.6;
                    fx.setScale(k, k, 1);
                    const tint = new Color(style.burst.r, style.burst.g, style.burst.b, 255);
                    const fade = new Color(style.burst.r, style.burst.g, style.burst.b, 0);
                    fx.getComponentsInChildren(ParticleSystem2D).forEach(ps => { ps.startColor = tint; ps.endColor = fade; ps.resetSystem(); });
                    fx.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingOrder = 440; });
                }).start();
            }
        }
        SoundManager.playComboChanged();
        return spread + this.BURST_ITEM_TIME + 0.15;
    }

    // ---------- Fundo ----------

    /** Jantar = background_night; cafe da manha e almoco = fundo original. Troca com fade cruzado. */
    private static setBackground(gm: GameManager, canvas: Node, meal: Meal) {
        const bgNode = canvas.getChildByName('background');
        const sprite = bgNode?.getComponent(Sprite);
        if (!bgNode || !sprite) return;
        const original: any = (bgNode as any).__dayFrame ?? ((bgNode as any).__dayFrame = sprite.spriteFrame);
        const wanted = meal === Meal.Dinner && gm.nightBackground ? gm.nightBackground : original;
        if (!wanted || sprite.spriteFrame === wanted) return;

        // Copia do fundo antigo fica por cima e esmaece, revelando o novo por baixo.
        const old = new Node('BackgroundFade');
        old.layer = bgNode.layer;
        old.parent = bgNode.parent;
        old.setSiblingIndex(bgNode.getSiblingIndex() + 1);
        old.setPosition(bgNode.position);
        const ut = old.addComponent(UITransform);
        const src = bgNode.getComponent(UITransform)!;
        ut.setContentSize(src.contentSize);
        ut.anchorPoint = src.anchorPoint;
        const sp = old.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sprite.spriteFrame;
        sp.color = sprite.color;
        const oldSort = bgNode.getComponent(Sorting2D);
        old.addComponent(Sorting2D).sortingOrder = (oldSort ? oldSort.sortingOrder : -1) + 0; // mesma camada, acima na hierarquia
        const op = old.addComponent(UIOpacity);
        sprite.spriteFrame = wanted;
        tween(op).to(1.0, { opacity: 0 }).call(() => old.destroy()).start();
    }

    // ---------- Faixa ----------

    private static showBanner(canvas: Node, meal: Meal, level: number, subtitle: string) {
        SoundManager.playMeal(meal);
        if (this.banner && this.banner.isValid) { Tween.stopAllByTarget(this.banner); this.banner.destroy(); }
        const style = this.MEAL_STYLE[meal];
        const root = new Node('PhaseBanner');
        root.layer = canvas.layer;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(10, 10);
        const board = canvas.getChildByName('MatchSpace');
        const at = board ? new Vec3(board.position.x, board.position.y + 20, 0) : new Vec3(0, 60, 0);
        root.setPosition(at);
        const op = root.addComponent(UIOpacity);
        this.banner = root;
        void level;

        const size = Responsive.portrait ? 74 : 92;
        CelebrationFx.makeLabel(root, tr(style.text), size, 0, 0, style.color, style.outline, 3);
        if (subtitle) CelebrationFx.makeLabel(root, subtitle, Math.round(size * 0.36), 0, -size * 0.85, Color.WHITE, new Color(20, 30, 60, 255), 2);

        SoundManager.playSuccessOrder();
        root.setScale(0.2, 0.2, 1);
        tween(root)
            .to(0.28, { scale: new Vec3(1.18, 1.18, 1) }, { easing: 'backOut' })
            .to(0.12, { scale: Vec3.ONE })
            .delay(1.0)
            .to(0.4, { position: new Vec3(at.x, at.y + 90, 0) })
            .call(() => { if (this.banner === root) this.banner = null; root.destroy(); })
            .start();
        tween(op).delay(1.35).to(0.35, { opacity: 0 }).start();
    }
}
