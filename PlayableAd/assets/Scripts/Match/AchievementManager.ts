import { WindowAnim } from './WindowAnim';
import { SoundManager } from './SoundManager';
import { _decorator, Component, Node, Sprite, SpriteFrame, Label, UITransform, Vec3, Color, Sorting2D, UIOpacity, tween, Tween, Enum, Rect, Size, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

import { AchievementMetric, PlayerStats } from './PlayerStats';
import { PowerupType, PowerupCatalog } from './PowerupCatalog';
import { PowerupInventory, PlayerWallet } from './PlayerInventory';
import { PowerupManager } from './PowerupManager';
import { CoinsHolderView } from './CoinsHolderView';
import { sys } from 'cc';

export enum AchievementRewardType {
    Coins,
    Powerup,
}
Enum(AchievementRewardType);

/** Uma conquista. Adicione, remova e edite na lista `achievements` do componente AchievementManager. */
@ccclass('AchievementDef')
export class AchievementDef {
    @property({ tooltip: 'Identificador UNICO (usado para salvar se o premio ja foi coletado). Nao repita nem mude depois de publicar.' })
    public id: string = '';

    @property({ tooltip: 'Titulo da conquista.' })
    public title: string = '';

    @property({ tooltip: 'Texto que explica o que fazer.' })
    public description: string = '';

    @property({ type: SpriteFrame, tooltip: 'Icone proprio da conquista. Tem prioridade sobre o sheet. Vazio = usa o icone do sheet (veja iconIndex).' })
    public icon: SpriteFrame | null = null;

    @property({ tooltip: 'Posicao do icone no achivements-icon-sheet (0 a 19, esquerda->direita, cima->baixo). -1 = sem icone do sheet.' })
    public iconIndex: number = -1;

    @property({ type: Enum(AchievementMetric), tooltip: 'O que a conquista acompanha.' })
    public metric: AchievementMetric = AchievementMetric.LevelsCompleted;

    @property({ tooltip: 'Valor da metrica necessario para liberar a conquista.' })
    public target: number = 1;

    @property({ type: Enum(AchievementRewardType), tooltip: 'Tipo de premio: coins ou power-up.' })
    public rewardType: AchievementRewardType = AchievementRewardType.Coins;

    @property({ tooltip: 'Quantidade de coins (se o premio for Coins).' })
    public coins: number = 100;

    @property({ type: Enum(PowerupType), tooltip: 'Power-up do premio (se o premio for Powerup).' })
    public powerup: PowerupType = PowerupType.TimeBonus;

    @property({ tooltip: 'Quantidade do power-up (se o premio for Powerup).' })
    public powerupAmount: number = 1;
}

/** Retangulos dos 20 icones no achivements-icon-sheet.png (x, y, largura, altura; origem no topo esquerdo). */
/** Lado (px) do sheet original em que os retangulos abaixo foram medidos. */
const ACHIEVEMENT_SHEET_SIZE = 1024;

const ACHIEVEMENT_ICON_RECTS: number[][] = [[27, 53, 180, 169], [221, 42, 197, 180], [421, 42, 186, 180], [620, 42, 185, 185], [820, 36, 187, 189], [25, 293, 184, 180], [224, 287, 187, 190], [424, 281, 182, 192], [635, 283, 174, 204], [820, 281, 182, 196], [23, 547, 188, 178], [222, 546, 188, 184], [417, 550, 192, 175], [618, 528, 186, 214], [819, 553, 186, 172], [23, 803, 184, 174], [249, 800, 156, 177], [438, 800, 175, 177], [637, 793, 166, 185], [856, 803, 142, 172]];

function def(id: string, title: string, description: string, metric: AchievementMetric, target: number,
    reward: { coins?: number, powerup?: PowerupType, amount?: number }): AchievementDef {
    const d = new AchievementDef();
    d.id = id;
    d.title = title;
    d.description = description;
    d.metric = metric;
    d.target = target;
    if (reward.coins) {
        d.rewardType = AchievementRewardType.Coins;
        d.coins = reward.coins;
    } else {
        d.rewardType = AchievementRewardType.Powerup;
        d.powerup = reward.powerup ?? PowerupType.TimeBonus;
        d.powerupAmount = reward.amount ?? 1;
    }
    return d;
}

interface RowView {
    def: AchievementDef;
    node: Node;
    iconSprite: Sprite;
    lock: Node;
    progress: Label;
    button: Node;
    buttonBg: Sprite;
    buttonLabel: Label;
}

/**
 * Janela de conquistas (aberta pelo botao no seletor de niveis): lista rolavel com icone, texto, cadeado enquanto
 * bloqueada e botao para coletar o premio (coins ou power-up). A lista e configuravel no inspector.
 */
@ccclass('AchievementManager')
export class AchievementManager extends Component {

    public static instance: AchievementManager = null!;
    private static readonly CLAIMED_KEY = 'match3_achievements_claimed';
    private static readonly SEEN_KEY = 'match3_achievements_seen';

    @property({ type: [AchievementDef], tooltip: 'Lista de conquistas: adicione, remova e edite a vontade (icone, texto, meta e premio).' })
    public achievements: AchievementDef[] = AchievementManager.withSheetIcons([
        def('first_steps',   'First Steps',      'Complete 1 level',                     AchievementMetric.LevelsCompleted, 1,   { coins: 150 }),
        def('warming_up',    'Warming Up',       'Complete 5 levels',                    AchievementMetric.LevelsCompleted, 5,   { powerup: PowerupType.TimeBonus, amount: 1 }),
        def('on_a_roll',     'On a Roll',        'Complete 10 levels',                   AchievementMetric.LevelsCompleted, 10,  { coins: 400 }),
        def('veteran',       'Veteran',          'Complete 25 levels',                   AchievementMetric.LevelsCompleted, 25,  { powerup: PowerupType.FreezeTimer, amount: 2 }),
        def('master_chef',   'Master Chef',      'Complete 50 levels',                   AchievementMetric.LevelsCompleted, 50,  { coins: 1500 }),
        def('star_collector','Star Collector',   'Collect 15 stars',                     AchievementMetric.TotalStars,      15,  { coins: 300 }),
        def('star_hoarder',  'Star Hoarder',     'Collect 45 stars',                     AchievementMetric.TotalStars,      45,  { powerup: PowerupType.Highlight, amount: 2 }),
        def('constellation', 'Constellation',    'Collect 100 stars',                    AchievementMetric.TotalStars,      100, { powerup: PowerupType.DoublePoints, amount: 2 }),
        def('perfectionist', 'Perfectionist',    'Finish a level with 3 stars',          AchievementMetric.ThreeStarLevels, 1,   { coins: 200 }),
        def('triple_threat', 'Triple Threat',    'Get 3 stars on 10 different levels',   AchievementMetric.ThreeStarLevels, 10,  { powerup: PowerupType.MaxCombo, amount: 1 }),
        def('climbing',      'Climbing',         'Reach level 10',                       AchievementMetric.HighestLevel,    10,  { coins: 500 }),
        def('summit',        'Summit',           'Reach level 30',                       AchievementMetric.HighestLevel,    30,  { powerup: PowerupType.ReduceQuantity, amount: 2 }),
        def('special_order', 'Special Delivery', 'Finish a special level',               AchievementMetric.SpecialLevelsCompleted, 1, { coins: 400 }),
        def('boss_slayer',   'Boss Slayer',      'Finish 5 special levels',              AchievementMetric.SpecialLevelsCompleted, 5, { powerup: PowerupType.AutoSelect, amount: 3 }),
        def('merge_rookie',  'Merge Rookie',     'Make 50 merges',                       AchievementMetric.Merges,          50,  { coins: 200 }),
        def('merge_master',  'Merge Master',     'Make 500 merges',                      AchievementMetric.Merges,          500, { powerup: PowerupType.FreezeOrders, amount: 2 }),
        def('order_up',      'Order Up!',        'Deliver 25 orders',                    AchievementMetric.OrdersDelivered, 25,  { coins: 250 }),
        def('punctual',      'Punctual',         'Deliver 100 orders on time',           AchievementMetric.OrdersOnTime,    100, { coins: 800 }),
        def('combo_king',    'Combo King',       'Reach the max combo 3 times',          AchievementMetric.MaxComboReached, 3,   { coins: 600 }),
        def('power_player',  'Power Player',     'Use 15 power-ups',                     AchievementMetric.PowerupsUsed,    15,  { powerup: PowerupType.DoublePoints, amount: 1 }),
    ]);

    /** Lista inicial: a conquista de posicao N usa o icone N do sheet (voce pode trocar o iconIndex ou o icon no inspector). */
    private static withSheetIcons(list: AchievementDef[]): AchievementDef[] {
        list.forEach((d, i) => { d.iconIndex = i; });
        return list;
    }

    @property({ type: SpriteFrame, tooltip: 'achivements-icon-sheet.png inteiro (os icones sao recortados dele por iconIndex).' })
    public iconSheet: SpriteFrame | null = null;

    @property({ tooltip: 'Icone do sheet usado no botao que abre a janela (0 a 19). -1 = usa o campo openIcon.' })
    public openIconIndex: number = 4;

    private sheetFrames: SpriteFrame[] = [];

    /** Cria os recortes do sheet (o Cocos nao fatia uma imagem em varios sprite frames). */
    private buildSheetFrames() {
        const sheet = this.iconSheet;
        if (this.sheetFrames.length > 0 || !sheet || !sheet.texture) return;
        // Os retangulos foram medidos no sheet de 1024px; se o sheet for reduzido, as coordenadas acompanham a escala.
        const k = sheet.texture.width / ACHIEVEMENT_SHEET_SIZE;
        this.sheetFrames = ACHIEVEMENT_ICON_RECTS.map(([x, y, w, h]) => {
            const frame = new SpriteFrame();
            frame.reset({ texture: sheet.texture, rect: new Rect(x * k, y * k, w * k, h * k), originalSize: new Size(w * k, h * k), offset: new Vec2(0, 0), isRotate: false });
            return frame;
        });
    }

    /** Aplica o icone da conquista (proprio > sheet > temporario), mantendo a proporcao dentro de `maxSize`. */
    private applyIcon(sprite: Sprite, d: AchievementDef, maxSize: number) {
        this.buildSheetFrames();
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const ut = sprite.node.getComponent(UITransform);
        if (d.icon) {
            sprite.spriteFrame = d.icon;
            ut?.setContentSize(maxSize, maxSize);
            return;
        }
        const frame = d.iconIndex >= 0 ? this.sheetFrames[d.iconIndex] : null;
        if (frame) {
            const [, , w, h] = ACHIEVEMENT_ICON_RECTS[d.iconIndex];
            const scale = maxSize / Math.max(w, h);
            sprite.spriteFrame = frame;
            ut?.setContentSize(w * scale, h * scale);
        } else {
            sprite.spriteFrame = this.placeholderIcon;
            ut?.setContentSize(maxSize, maxSize);
        }
    }

    @property({ type: SpriteFrame, tooltip: 'Icone temporario das conquistas sem icone.' })
    public placeholderIcon: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Cadeado exibido enquanto a conquista esta bloqueada.' })
    public lockFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Icone do botao que abre a janela de conquistas (temporario).' })
    public openIcon: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'moeda-de-dolar-group: icone que indica premios em coins.' })
    public coinGroupFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Altura (px) de cada linha de conquista.' })
    public rowHeight: number = 100;

    @property({ tooltip: 'Espaco (px) entre as linhas.' })
    public rowGap: number = 10;

    @property({ tooltip: 'Largura (px) da area visivel da lista.' })
    public viewportWidth: number = 900;

    @property({ tooltip: 'Altura (px) da area visivel da lista.' })
    public viewportHeight: number = 390;

    private claimed: Set<string> = new Set();
    /** Conquistas cujo desbloqueio ja foi avisado ao jogador. */
    private seen: Set<string> = new Set();
    private windowRoot: Node | null = null;
    private windowBadge: CoinsHolderView | null = null;
    private content: Node | null = null;
    private viewport: Node | null = null;
    private rows: RowView[] = [];
    private openDots: Label[] = [];
    private scroll: number = 0;
    private velocity: number = 0;
    private dragging: boolean = false;
    private lastY: number = 0;
    private dragMoved: number = 0;
    private lastMove: number = 0;

    protected onLoad() {
        AchievementManager.instance = this;
        this.buildSheetFrames();
        this.reloadState();
    }

    /** Le de novo as conquistas coletadas/avisadas (apos o save da nuvem da Poki ser injetado). */
    public reloadState() {
        this.claimed.clear();
        this.seen.clear();
        try {
            const raw = sys.localStorage.getItem(AchievementManager.CLAIMED_KEY);
            if (raw) (JSON.parse(raw) as string[]).forEach(id => this.claimed.add(id));
            const seenRaw = sys.localStorage.getItem(AchievementManager.SEEN_KEY);
            if (seenRaw) (JSON.parse(seenRaw) as string[]).forEach(id => this.seen.add(id));
        } catch (e) { }
    }

    protected onDestroy() {
        if (AchievementManager.instance === this) AchievementManager.instance = null!;
    }

    protected update(dt: number) {
        if (!this.windowRoot || !this.windowRoot.active) return;
        if (!this.dragging && Math.abs(this.velocity) > 1) {
            this.setScroll(this.scroll + this.velocity * dt);
            this.velocity *= Math.max(0, 1 - 4 * dt);
        }
    }

    // ---------- Estado das conquistas ----------

    public progressOf(d: AchievementDef): number {
        return PlayerStats.get(d.metric);
    }

    public isUnlocked(d: AchievementDef): boolean {
        return this.progressOf(d) >= d.target;
    }

    public isClaimed(d: AchievementDef): boolean {
        return this.claimed.has(d.id);
    }

    /** Quantas conquistas estao liberadas e com o premio ainda nao coletado. */
    public get claimableCount(): number {
        return this.achievements.filter(d => this.isUnlocked(d) && !this.isClaimed(d)).length;
    }

    private saveClaimed() {
        try {
            sys.localStorage.setItem(AchievementManager.CLAIMED_KEY, JSON.stringify(Array.from(this.claimed)));
        } catch (e) { }
    }

    private claim(d: AchievementDef) {
        if (!this.isUnlocked(d) || this.isClaimed(d)) return;
        this.claimed.add(d.id);
        this.saveClaimed();

        const pm = PowerupManager.instance;
        let text: string;
        if (d.rewardType === AchievementRewardType.Coins) {
            this.claimCoins(d);
            text = `+${d.coins} coins`;
        } else {
            PowerupInventory.add(d.powerup, d.powerupAmount);
            pm?.refreshBadges();
            text = `+${d.powerupAmount} ${PowerupCatalog.getDef(d.powerup).name}`;
        }
        pm?.showToast(text, true);
        this.refreshRows();
        this.refreshOpenButtons();
    }

    /**
     * Premio em coins: as moedas explodem do botao e voam ate o holder de coins da janela; o valor so sobe
     * conforme elas chegam (o saldo salvo ja e atualizado na hora).
     */
    private claimCoins(d: AchievementDef) {
        const pm = PowerupManager.instance;
        const before = PlayerWallet.getPoints();
        PlayerWallet.addPoints(d.coins);

        const view = this.windowBadge;
        const row = this.rows.find(r => r.def === d);
        if (!pm || !view || !view.coin || !row) {
            pm?.refreshBadges();
            return;
        }

        view.setValue(before); // segura o valor antigo ate as moedas chegarem
        const count = Math.max(6, Math.min(18, 6 + Math.round(d.coins / 80)));
        let shown = before;
        // Parte de cada moeda definida pelo indice (as moedas chegam fora de ordem): a soma e sempre exata.
        const base = Math.floor(d.coins / count);
        pm.FlyCoinsTo(row.button.worldPosition.clone(), count, view.coin, i => {
            const part = i === count - 1 ? d.coins - base * (count - 1) : base;
            shown += part;
            view.setValue(shown);
            pm.punchNode(view.node);
        });
    }

    // ---------- Aviso de conquistas desbloqueadas (tela de vitoria) ----------

    /**
     * Chamado quando o nivel termina com vitoria: mostra um aviso para cada conquista que acabou de ser liberada
     * (e ainda nao tinha sido avisada), empilhados no topo da tela por cima da tela de vitoria.
     */
    public NotifyNewUnlocks() {
        const fresh = this.achievements.filter(d => this.isUnlocked(d) && !this.seen.has(d.id));
        if (fresh.length === 0) return;
        fresh.forEach(d => this.seen.add(d.id));
        try {
            sys.localStorage.setItem(AchievementManager.SEEN_KEY, JSON.stringify(Array.from(this.seen)));
        } catch (e) { }
        this.refreshOpenButtons();

        // Espera a tela de vitoria aparecer; um aviso por vez, em sequencia.
        // Um unico som por lote de conquistas (o SoundManager ainda protege contra toques proximos demais).
        this.scheduleOnce(() => SoundManager.playNotification(), 0.9);
        fresh.slice(0, 4).forEach((d, i) => {
            this.scheduleOnce(() => this.showUnlockBanner(d, i), 0.9 + i * 0.7);
        });
    }

    private rewardText(d: AchievementDef): string {
        return d.rewardType === AchievementRewardType.Coins
            ? `+${d.coins} coins`
            : `+${d.powerupAmount} ${PowerupCatalog.getDef(d.powerup).name}`;
    }

    /** Avisos de conquista desbloqueada (reaproveitados; criados uma vez ao iniciar a cena). */
    private bannerPool: { node: Node, icon: Sprite, title: Label, reward: Label, rewardIcon: Sprite }[] = [];

    protected start() {
        this.buildBannerPool();
    }

    private buildBannerPool() {
        const pm = this.pm;
        const parent = this.node.parent;
        if (!pm || !parent || this.bannerPool.length > 0) return;
        const base = pm.windowSortingBase + 80;
        const w = 560, h = 96;

        for (let i = 0; i < 4; i++) {
            const banner = this.makeNode('AchievementBanner', parent, 0, 300 - i * (h + 10), w, h);
            this.makeSprite(banner, pm.pointsFrame, base, true);

            const iconHolder = this.makeNode('IconHolder', banner, -w / 2 + 62, 0, 70, 70);
            this.makeSprite(iconHolder, pm.holderFrame, base + 1);
            const iconNode = this.makeNode('Icon', iconHolder, 0, 2, 52, 52);
            const icon = iconNode.addComponent(Sprite);
            icon.sizeMode = Sprite.SizeMode.CUSTOM;
            iconNode.addComponent(Sorting2D).sortingOrder = base + 2;

            const left = -w / 2 + 112;
            this.makeLabel(banner, 'ACHIEVEMENT UNLOCKED!', 20, 400, 24, left, 24, base + 2, new Color(255, 214, 51, 255), new Color(60, 40, 0, 255), true);
            const title = this.makeLabel(banner, '', 30, 400, 34, left, -2, base + 2, Color.WHITE, new Color(10, 20, 40, 255), true);
            const reward = this.makeLabel(banner, '', 20, 370, 24, left + 34, -28, base + 2, new Color(120, 255, 140, 255), new Color(10, 60, 20, 255), true);
            // Icone do premio (moedas ou power-up) ao lado do texto.
            const rewardIconNode = this.makeNode('RewardIcon', banner, left + 14, -28, 30, 30);
            const rewardIcon = rewardIconNode.addComponent(Sprite);
            rewardIcon.sizeMode = Sprite.SizeMode.CUSTOM;
            rewardIconNode.addComponent(Sorting2D).sortingOrder = base + 2;

            // As telas de vitoria/derrota desenham no sorting layer 1: o aviso precisa estar no mesmo layer (e com ordem
            // maior), senao e desenhado por baixo delas (layer 0) mesmo com ordem alta.
            banner.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingLayer = 1; });
            banner.active = false;
            this.bannerPool.push({ node: banner, icon, title, reward, rewardIcon });
        }
    }

    private showUnlockBanner(d: AchievementDef, index: number) {
        if (this.bannerPool.length === 0) this.buildBannerPool();
        const entry = this.bannerPool[index];
        if (!entry) return;
        const h = 96;
        const targetY = 300 - index * (h + 10);

        this.applyIcon(entry.icon, d, 52);
        entry.title.string = d.title;
        entry.reward.string = this.rewardText(d);
        if (d.rewardType === AchievementRewardType.Coins) {
            entry.rewardIcon.spriteFrame = this.coinGroupFrame || this.pm?.coinFrame || null;
            entry.rewardIcon.trim = false;
            entry.rewardIcon.node.getComponent(UITransform)?.setContentSize(34, 34);
        } else {
            entry.rewardIcon.trim = true;
            PowerupCatalog.applyFitted(entry.rewardIcon, d.powerup, 30);
        }

        const banner = entry.node;
        Tween.stopAllByTarget(banner);
        banner.active = true;
        banner.setPosition(0, targetY + 160, 0);
        banner.setScale(0.8, 0.8, 1);
        tween(banner)
            .to(0.3, { position: new Vec3(0, targetY, 0), scale: Vec3.ONE }, { easing: 'backOut' })
            .delay(2.6)
            .to(0.3, { position: new Vec3(0, targetY + 160, 0), scale: new Vec3(0.8, 0.8, 1) })
            .call(() => { banner.active = false; })
            .start();
    }

    // ---------- UI helpers ----------

    private get pm(): PowerupManager | null {
        return PowerupManager.instance || null;
    }

    private makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private makeSprite(n: Node, frame: SpriteFrame | null, order: number, sliced: boolean = false): Sprite {
        const sprite = n.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sliced) sprite.type = Sprite.Type.SLICED;
        sprite.spriteFrame = frame;
        n.addComponent(Sorting2D).sortingOrder = order;
        return sprite;
    }

    private makeLabel(parent: Node, text: string, size: number, w: number, h: number, x: number, y: number, order: number,
        color: Color = Color.WHITE, outline: Color = new Color(10, 20, 40, 255), left: boolean = false): Label {
        const n = this.makeNode('Text', parent, left ? x : x, y, w, h);
        const label = n.addComponent(Label);
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        if (this.pm?.font) {
            label.useSystemFont = false;
            label.font = this.pm.font;
        }
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.color = color;
        label.isBold = true;
        label.horizontalAlign = left ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 10));
        const ut = n.getComponent(UITransform)!;
        ut.setContentSize(w, h);
        if (left) { ut.anchorX = 0; }
        n.addComponent(Sorting2D).sortingOrder = order;
        return label;
    }

    // ---------- Botao que abre a janela ----------

    /** Botao "ACHIEVEMENTS" (holder + icone + bolinha com premios a coletar). */
    public createOpenButton(parent: Node, x: number, y: number, order: number, size: number = 110): Node | null {
        const pm = this.pm;
        if (!pm) return null;
        const node = this.makeNode('AchievementsButton', parent, x, y, size, size);
        this.makeSprite(node, pm.holderFrame, order);
        const iconNode = this.makeNode('Icon', node, 0, 3, size * 0.66, size * 0.66);
        const icon = iconNode.addComponent(Sprite);
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        this.buildSheetFrames();
        // openIconIndex >= 0 usa o icone do sheet; -1 usa o openIcon (ou o temporario).
        const sheetFrame = this.openIconIndex >= 0 ? this.sheetFrames[this.openIconIndex] : null;
        icon.spriteFrame = sheetFrame || this.openIcon || this.placeholderIcon;
        if (sheetFrame) {
            const [, , rw, rh] = ACHIEVEMENT_ICON_RECTS[this.openIconIndex];
            const sc = (size * 0.66) / Math.max(rw, rh);
            iconNode.getComponent(UITransform)!.setContentSize(rw * sc, rh * sc);
        }
        iconNode.addComponent(Sorting2D).sortingOrder = order + 1;
        this.makeLabel(node, 'ACHIEVEMENTS', 14, size + 40, 22, 0, -size * 0.58, order + 2);

        // Bolinha vermelha com a quantidade de premios prontos para coletar.
        const dot = this.makeNode('Dot', node, size * 0.4, size * 0.4, 34, 34);
        const dotBg = this.makeSprite(dot, pm.pointsFrame, order + 3, true);
        dotBg.color = new Color(230, 40, 40, 255);
        const dotLabel = this.makeLabel(dot, '0', 22, 30, 28, 0, 0, order + 4);
        this.openDots.push(dotLabel);
        this.refreshOpenButtons();

        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.92, 0.92, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); this.openWindow(); });
        return node;
    }

    public refreshOpenButtons() {
        const count = this.claimableCount;
        this.openDots = this.openDots.filter(l => l && l.isValid);
        this.openDots.forEach(l => {
            l.string = `${count}`;
            l.node.parent!.active = count > 0;
        });
    }

    // ---------- Janela ----------

    public openWindow() {
        if (!this.windowRoot) this.buildWindow();
        const root = this.windowRoot!;
        const parent = root.parent;
        if (parent) root.setSiblingIndex(parent.children.length - 1);
        this.scroll = 0;
        this.velocity = 0;
        this.setScroll(0);
        this.refreshRows();
        PowerupManager.instance?.refreshBadges();
        SoundManager.playOpenMenu();
        WindowAnim.open(root);
    }

    public closeWindow() {
        if (!this.windowRoot || !this.windowRoot.active) return;
        SoundManager.playOpenMenu();
        WindowAnim.close(this.windowRoot, () => this.refreshOpenButtons());
    }

    private buildWindow() {
        const pm = this.pm!;
        const base = pm.windowSortingBase;
        const root = this.makeNode('AchievementWindow', this.node.parent || this.node, 0, 0, 1280, 720);
        this.windowRoot = root;

        const dim = this.makeNode('Dim', root, 0, 0, 1400, 800);
        const dimSprite = this.makeSprite(dim, pm.dimFrame, base);
        dimSprite.color = new Color(0, 0, 0, 190);
        dim.on(Node.EventType.TOUCH_END, () => { });

        const W = 1000, H = 600;
        const win = this.makeNode('Window', root, 0, 0, W, H);
        this.makeSprite(win, pm.windowFrame, base + 1, true);
        this.makeLabel(win, 'ACHIEVEMENTS', 46, 480, 60, 0, H / 2 - 62, base + 3, Color.WHITE, new Color(20, 70, 120, 255));
        this.windowBadge = pm.createPointsBadgeView(win, -W / 2 + 190, H / 2 - 62, base + 3, false);
        this.makeButton(win, 'X', W / 2 - 78, H / 2 - 62, 64, 56, base + 3, new Color(255, 120, 120, 255), () => this.closeWindow(), true);

        // Area visivel (com mascara): a lista rola dentro dela.
        const vw = this.viewportWidth, vh = this.viewportHeight;
        // (O modulo Mask do engine nao esta incluido neste build: as linhas que cruzam a borda da area visivel
        // somem/esmaecem em vez de serem cortadas, veja updateRowVisibility.)
        const viewport = this.makeNode('Viewport', win, 0, -22, vw, vh);
        this.viewport = viewport;
        this.content = this.makeNode('Content', viewport, 0, 0, vw, vh);

        this.rows = this.achievements.map((d, i) => this.buildRow(d, i, base));
        this.updateRowVisibility();

        viewport.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        viewport.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        viewport.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        viewport.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        viewport.on(Node.EventType.MOUSE_WHEEL, this.onWheel, this);

        root.active = false;
    }

    private makeButton(parent: Node, text: string, x: number, y: number, w: number, h: number, order: number, tint: Color,
        onTap: () => void, silent: boolean = false): { node: Node, label: Label, bg: Sprite } {
        const node = this.makeNode('Button', parent, x, y, w, h);
        const bg = this.makeSprite(node, this.pm!.buttonFrame, order, true);
        bg.color = tint;
        const label = this.makeLabel(node, text, Math.round(h * 0.45), w - 16, h - 10, 0, 3, order + 1);
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.93, 0.93, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); if (!silent) SoundManager.playMenuClick(); onTap(); });
        return { node, label, bg };
    }

    private buildRow(d: AchievementDef, index: number, base: number): RowView {
        const pm = this.pm!;
        const rw = this.viewportWidth - 40, rh = this.rowHeight;
        const y = this.viewportHeight / 2 - rh / 2 - index * (rh + this.rowGap);
        const row = this.makeNode(`Row_${d.id}`, this.content!, 0, y, rw, rh);
        row.addComponent(UIOpacity);

        // Holder de tudo (fundo da linha).
        this.makeSprite(row, pm.pointsFrame, base + 2, true);

        // Icone da conquista dentro do holder de icone; o cadeado fica por cima enquanto bloqueada.
        const iconHolder = this.makeNode('IconHolder', row, -rw / 2 + 62, 0, 78, 78);
        this.makeSprite(iconHolder, pm.holderFrame, base + 3);
        const iconNode = this.makeNode('Icon', iconHolder, 0, 2, 58, 58);
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.applyIcon(iconSprite, d, 58);
        iconNode.addComponent(Sorting2D).sortingOrder = base + 4;
        const lock = this.makeNode('Lock', iconHolder, 24, -24, 36, 36);
        const lockSprite = lock.addComponent(Sprite);
        lockSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        lockSprite.spriteFrame = this.lockFrame;
        lockSprite.trim = false; // sem trim: nao estica o cadeado
        lock.addComponent(Sorting2D).sortingOrder = base + 7;

        // Textos (alinhados a esquerda).
        const textLeft = -rw / 2 + 120;
        this.makeLabel(row, d.title, 28, 360, 32, textLeft, 17, base + 4, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255), true);
        this.makeLabel(row, d.description, 20, 380, 28, textLeft, -17, base + 4, Color.WHITE, new Color(10, 20, 40, 255), true);
        const progress = this.makeLabel(row, '', 24, 110, 34, 90, 0, base + 4);

        // Premio: icone da moeda ou do power-up + quantidade.
        const rewardIcon = this.makeNode('RewardIcon', row, 195, 6, 44, 44);
        const rewardSprite = rewardIcon.addComponent(Sprite);
        rewardSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        rewardIcon.addComponent(Sorting2D).sortingOrder = base + 4;
        let rewardText: string;
        if (d.rewardType === AchievementRewardType.Coins) {
            rewardSprite.spriteFrame = this.coinGroupFrame || pm.coinFrame;
            rewardSprite.trim = false; // sem trim: o frame inteiro (quadrado) preenche o no sem esticar
            rewardIcon.getComponent(UITransform)!.setContentSize(56, 56);
            rewardText = `+${d.coins}`;
        } else {
            PowerupCatalog.applyFitted(rewardSprite, d.powerup, 46);
            rewardText = `x${d.powerupAmount}`;
        }
        this.makeLabel(row, rewardText, 24, 100, 28, 195, -26, base + 5);

        const btn = this.makeButton(row, 'CLAIM', rw / 2 - 90, 0, 150, 56, base + 4, Color.WHITE, () => this.claim(d));

        return { def: d, node: row, iconSprite, lock, progress, button: btn.node, buttonBg: btn.bg, buttonLabel: btn.label };
    }

    private refreshRows() {
        for (const r of this.rows) {
            const unlocked = this.isUnlocked(r.def);
            const claimed = this.isClaimed(r.def);
            const value = Math.min(this.progressOf(r.def), r.def.target);

            r.lock.active = !unlocked;
            r.iconSprite.color = unlocked ? Color.WHITE : new Color(110, 110, 110, 255);

            r.progress.string = claimed ? '' : `${value}/${r.def.target}`;
            r.progress.color = unlocked ? new Color(120, 255, 140, 255) : Color.WHITE;

            // Botao: so aparece com a conquista liberada; depois de coletar vira "DONE" apagado.
            r.button.active = unlocked;
            r.buttonLabel.string = claimed ? 'DONE' : 'CLAIM';
            r.buttonBg.color = claimed ? new Color(110, 110, 110, 255) : Color.WHITE;
            r.buttonLabel.color = claimed ? new Color(190, 190, 190, 255) : Color.WHITE;
        }
    }

    // ---------- Scroll ----------

    private get maxScroll(): number {
        const total = this.achievements.length * (this.rowHeight + this.rowGap) - this.rowGap;
        return Math.max(0, total - this.viewportHeight);
    }

    private setScroll(value: number) {
        this.scroll = Math.max(0, Math.min(this.maxScroll, value));
        if (this.content) this.content.setPosition(0, this.scroll, 0);
        this.updateRowVisibility();
    }

    /** Linhas fora da area visivel somem; as que cruzam a borda esmaecem (nao ha mascara de corte). */
    private updateRowVisibility() {
        const rh = this.rowHeight, half = this.viewportHeight / 2;
        for (const r of this.rows) {
            const centerY = r.node.position.y + this.scroll;
            const overlap = Math.min(centerY + rh / 2, half) - Math.max(centerY - rh / 2, -half);
            const fraction = Math.max(0, Math.min(1, overlap / rh));
            const visible = fraction >= 0.6;
            if (r.node.active !== visible) r.node.active = visible;
            if (visible) {
                const op = r.node.getComponent(UIOpacity);
                if (op) op.opacity = fraction >= 0.999 ? 255 : Math.round(90 + 165 * (fraction - 0.6) / 0.4);
            }
        }
    }

    private onTouchStart(event: any) {
        this.dragging = true;
        this.velocity = 0;
        this.lastY = event.getUILocation().y;
        this.lastMove = performance.now();
        this.dragMoved = 0;
    }

    private onTouchMove(event: any) {
        if (!this.dragging) return;
        const y = event.getUILocation().y;
        const dy = y - this.lastY;
        this.lastY = y;
        this.dragMoved += Math.abs(dy);
        this.setScroll(this.scroll + dy);
        const now = performance.now();
        const dt = Math.max((now - this.lastMove) / 1000, 0.004);
        this.lastMove = now;
        this.velocity = this.velocity * 0.4 + Math.max(-4000, Math.min(4000, dy / dt)) * 0.6;
    }

    private onTouchEnd() {
        this.dragging = false;
        if (performance.now() - this.lastMove > 80) this.velocity = 0;
    }

    private onWheel(event: any) {
        this.velocity = 0;
        // Roda para cima = lista sobe (como em qualquer lista).
        this.setScroll(this.scroll - (event.getScrollY() || 0));
    }
}
