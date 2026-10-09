import { SoundManager } from './SoundManager';
import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Font, UITransform, Vec3, Color, Sorting2D, EventTouch, EventMouse, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;
import { GameManager } from './GameManager';
import { LevelProgress } from './LevelProgress';
import { LevelConfig } from './LevelConfig';
import { PowerupManager } from './PowerupManager';
import { AchievementManager } from './AchievementManager';
import { PokiService } from './PokiService';
import { RankingManager } from './RankingManager';

interface LevelItem {
    node: Node;
    bg: Sprite;
    levelLabel: Label;
    lock: Node;
    starsRoot: Node;
    stars: Sprite[];
    costRoot: Node;
    costLabel: Label;
    index: number;
}

/**
 * Seletor de niveis: trilha procedural infinita com scroll horizontal (arrastar / roda do mouse).
 * Apenas os itens visiveis existem na tela: ao rolar, itens que saem voltam para um pool e sao reaproveitados.
 */
@ccclass('LevelSelector')
export class LevelSelector extends Component {

    // ---------- Referencias ----------
    @property({ type: Node, tooltip: 'Container onde os itens do pool sao criados (rola com a trilha).' })
    public content: Node | null = null;

    @property({ type: Label, tooltip: 'Texto com o total de estrelas do jogador.' })
    public totalStarsLabel: Label | null = null;

    // ---------- Assets ----------
    @property({ type: SpriteFrame, tooltip: 'enabled-button-level' })
    public enabledFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'enabled-button-level-special: botao dos niveis especiais (mais dificeis, a cada 10 niveis).' })
    public specialFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'disabled-button-level-special: botao dos niveis especiais ainda bloqueados.' })
    public disabledSpecialFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Tamanho do botao especial em relacao ao botao normal (a arte especial e maior).' })
    public specialScale: number = 1.26;

    @property({ type: SpriteFrame, tooltip: 'disabled-button-level' })
    public disabledFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'locked-icon' })
    public lockFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Icone de estrela.' })
    public starFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Sprite dos pontos que ligam os niveis na trilha.' })
    public dotFrame: SpriteFrame | null = null;

    @property({ type: Font, tooltip: 'Fonte dos textos (vazio = fonte do sistema).' })
    public font: Font | null = null;

    // ---------- Niveis e desbloqueio ----------
    @property({ tooltip: 'Niveis liberados desde o inicio.' })
    public freeLevels: number = 3;

    @property({ tooltip: 'Estrelas necessarias para liberar o primeiro nivel bloqueado.' })
    public firstUnlockCost: number = 3;

    @property({ tooltip: 'Estrelas adicionais exigidas a cada nivel bloqueado seguinte (max. 3 por nivel jogado).' })
    public costPerLevel: number = 2;

    @property({ type: [Number], tooltip: 'Opcional: custo em estrelas por nivel (indice = nivel, 0 = primeiro). Valores preenchidos substituem a formula.' })
    public customUnlockCosts: number[] = [];

    // ---------- Trilha ----------
    @property({ tooltip: 'Distancia horizontal (px) entre niveis.' })
    public spacingX: number = 230;

    @property({ tooltip: 'Margem (px) antes do primeiro e depois do ultimo nivel.' })
    public padding: number = 200;

    @property({ tooltip: 'Amplitude vertical (px) da curva da trilha.' })
    public amplitude: number = 110;

    @property({ tooltip: 'Frequencia da curva.' })
    public waveFrequency: number = 0.8;

    @property({ tooltip: 'Variacao pseudo-aleatoria (px) somada a curva.' })
    public noise: number = 40;

    @property({ tooltip: 'Semente da trilha procedural (mesma semente = mesma trilha).' })
    public seed: number = 7;

    @property({ tooltip: 'Escala dos botoes de nivel.' })
    public itemScale: number = 0.7;

    @property({ tooltip: 'Pontos desenhados entre dois niveis.' })
    public dotsPerLink: number = 4;

    @property({ tooltip: 'Tamanho (px) dos pontos da trilha.' })
    public dotSize: number = 16;

    // ---------- Scroll ----------
    @property({ tooltip: 'Distancia (px) de arraste a partir da qual o toque deixa de ser um clique.' })
    public dragThreshold: number = 12;

    @property({ tooltip: 'Atrito da inercia (maior = para mais rapido).' })
    public inertiaDamping: number = 4;

    @property({ tooltip: 'Multiplicador da roda do mouse.' })
    public wheelSpeed: number = 1;

    @property({ tooltip: 'Posicao vertical (px) do botao que volta ao nivel atual.' })
    public currentButtonY: number = -300;

    @property({ type: SpriteFrame, tooltip: 'Sprite do botao que volta ao nivel atual (mesmo botao da tela de vitoria).' })
    public currentButtonFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Largura (px) do botao que volta ao nivel atual.' })
    public currentButtonWidth: number = 224;

    @property({ tooltip: 'Altura (px) do botao que volta ao nivel atual.' })
    public currentButtonHeight: number = 90;

    @property({ tooltip: 'Fracao (0..1) do botao ocupada pelo texto.' })
    public currentTextRatio: number = 0.92;

    @property({ tooltip: 'Texto do botao que volta ao nivel atual.' })
    public currentButtonText: string = 'CURRENT';

    @property({ tooltip: 'Velocidade da rolagem suave ate o nivel atual.' })
    public focusScrollSpeed: number = 7;

    @property({ tooltip: 'Sorting order base dos elementos do seletor (acima do gameplay e dos menus).' })
    public sortingBase: number = 60;

    private static readonly ITEM_SIZE = 250;

    private itemPool: LevelItem[] = [];
    private activeItems: Map<number, LevelItem> = new Map();
    private dotPool: Node[] = [];
    private activeDots: Map<number, Node[]> = new Map();

    private scroll: number = 0;
    private scrollTarget: number | null = null;
    private focus: number = 0;
    private currentButton: Node | null = null;
    private pressedCurrentButton: boolean = false;
    private velocity: number = 0;
    private width: number = 1280;

    private dragging: boolean = false;
    private lastX: number = 0;
    private dragDistance: number = 0;
    private pressedIndex: number = -1;
    private touchId: number = -1;
    private lastMoveTime: number = 0;
    private choosing: boolean = false;
    private readonly lockedColor = new Color(120, 120, 120, 255);
    private readonly emptyStarColor = new Color(60, 60, 60, 170);

    protected onLoad() {
        this.createCurrentButton();
        this.createPowerupWidgets();
    }

    /** Botao de power-ups (canto inferior esquerdo) e saldo de pontos (ponta oposta ao total de estrelas). */
    private createPowerupWidgets() {
        const pm = PowerupManager.instance;
        if (!pm) return;
        pm.createOpenButton(this.node, -540, -255, this.sortingBase + 14);
        // Conquistas: ao lado do botao de power-ups, com a contagem de premios a coletar.
        AchievementManager.instance?.createOpenButton(this.node, -410, -255, this.sortingBase + 14);
        // Ranking por estrelas totais (AUDS da Poki).
        RankingManager.instance?.createOpenButton(this.node, -280, -255, this.sortingBase + 14);
        // Alinhado no eixo Y com o holder de estrelas (TotalStars), onde quer que ele esteja.
        const starsY = this.node.getChildByName('TotalStars')?.position.y ?? 310;
        const holder = pm.createPointsBadgeView(this.node, -490, starsY, this.sortingBase + 10);
        // Anuncio de coins logo abaixo do saldo (com espera de 3 minutos).
        pm.createCoinAdButton(this.node, -490, starsY - 70, this.sortingBase + 10, holder);
    }

    protected onEnable() {
        PowerupManager.instance?.refreshBadges();
        AchievementManager.instance?.refreshOpenButtons();
        this.width = this.node.getComponent(UITransform)?.width || 1280;
        this.choosing = false;
        this.dragging = false;
        this.velocity = 0;

        this.releaseAll();
        this.refreshHeader();
        this.focus = this.focusIndex();
        this.scrollTarget = null;
        this.scroll = this.clampScroll(this.positionOf(this.focus).x - this.width / 2);
        this.refreshVisible();

        // Eventos NO PROPRIO NO (nao no `input` global): o dispatcher de UI entrega primeiro e, quando um Button
        // (ex.: os elementos do jogo por baixo) captura o toque, os eventos globais nunca chegam. Como este no e o
        // ultimo filho do canvas e cobre a tela inteira, ele captura o toque antes de qualquer outro.
        this.node.setSiblingIndex(this.node.parent ? this.node.parent.children.length - 1 : 0);
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.on(Node.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    protected onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.off(Node.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    protected update(dt: number) {
        if (this.scrollTarget !== null && !this.dragging) {
            const diff = this.scrollTarget - this.scroll;
            if (Math.abs(diff) < 1) {
                this.scroll = this.scrollTarget;
                this.scrollTarget = null;
            } else {
                this.scroll += diff * Math.min(1, dt * this.focusScrollSpeed);
            }
            this.velocity = 0;
            this.refreshVisible();
            return;
        }

        if (!this.dragging && Math.abs(this.velocity) > 1) {
            this.scroll = this.clampScroll(this.scroll + this.velocity * dt);
            this.velocity *= Math.max(0, 1 - this.inertiaDamping * dt);
            this.refreshVisible();
        }
    }

    // ---------- Regras de desbloqueio ----------

    public getUnlockCost(level: number): number {
        if (level < this.freeLevels) return 0;
        const custom = this.customUnlockCosts[level];
        if (custom !== undefined && custom > 0) return custom;
        return this.firstUnlockCost + (level - this.freeLevels) * this.costPerLevel;
    }

    public isUnlocked(level: number): boolean {
        return LevelProgress.getTotalStars() >= this.getUnlockCost(level);
    }

    /** Primeiro nivel liberado ainda sem estrelas; se todos os liberados foram jogados, o ultimo liberado. */
    private focusIndex(): number {
        let last = 0;
        // O custo cresce a cada nivel, entao o laco sempre termina.
        for (let i = 0; this.isUnlocked(i); i++) {
            last = i;
            if (LevelProgress.getStars(i) === 0) return i;
        }
        return last;
    }

    // ---------- Trilha procedural ----------

    /** Posicao de um nivel na trilha: calculada sob demanda (deterministica), sem limite de niveis. */
    private positionOf(i: number): Vec3 {
        const maxY = this.amplitude + this.noise;
        const x = this.padding + i * this.spacingX;
        const wave = Math.sin(i * this.waveFrequency) * this.amplitude;
        const jitter = (this.hash(i) - 0.5) * 2 * this.noise;
        const y = Math.max(-maxY, Math.min(maxY, wave + jitter));
        return new Vec3(x, y - 10, 0);
    }

    private hash(i: number): number {
        const v = Math.sin(i * 12.9898 + this.seed * 78.233) * 43758.5453;
        return v - Math.floor(v);
    }

    private clampScroll(value: number): number {
        return Math.max(0, value);
    }

    // ---------- Pool / visibilidade ----------

    private refreshHeader() {
        if (this.totalStarsLabel) {
            this.totalStarsLabel.string = `${LevelProgress.getTotalStars()}`;
        }
    }

    private refreshVisible() {
        if (!this.content) return;
        this.content.setPosition(-this.width / 2 - this.scroll, 0, 0);

        const margin = LevelSelector.ITEM_SIZE * this.itemScale + this.spacingX;
        const left = this.scroll - margin;
        const right = this.scroll + this.width + margin;
        const first = Math.max(0, Math.floor((left - this.padding) / this.spacingX));
        const last = Math.ceil((right - this.padding) / this.spacingX);

        // O botao "nivel atual" so aparece quando o nivel atual esta fora da tela.
        if (this.currentButton) {
            const focusX = this.positionOf(this.focus).x - this.scroll - this.width / 2;
            this.currentButton.active = Math.abs(focusX) > this.width / 2 - 80;
        }

        this.activeItems.forEach((item, index) => {
            if (index < first || index > last) this.releaseItem(index);
        });
        for (let i = first; i <= last; i++) {
            if (!this.activeItems.has(i)) this.acquireItem(i);
        }

        this.activeDots.forEach((_, link) => {
            if (link < first - 1 || link > last) this.releaseDots(link);
        });
        for (let l = Math.max(0, first - 1); l <= last; l++) {
            if (!this.activeDots.has(l)) this.acquireDots(l);
        }
    }

    private releaseAll() {
        Array.from(this.activeItems.keys()).forEach(i => this.releaseItem(i));
        Array.from(this.activeDots.keys()).forEach(l => this.releaseDots(l));
    }

    private acquireItem(index: number) {
        const item = this.itemPool.pop() || this.createItem();
        item.index = index;
        item.node.parent = this.content;
        item.node.setPosition(this.positionOf(index));
        item.node.setRotationFromEuler(0, 0, 0);
        item.node.active = true;
        this.bindItem(item);
        this.activeItems.set(index, item);

        Tween.stopAllByTarget(item.node);
        item.node.setScale(this.itemScale * 0.8, this.itemScale * 0.8, 1);
        tween(item.node)
            .to(0.15, { scale: new Vec3(this.itemScale, this.itemScale, 1) }, { easing: 'backOut' })
            .start();
    }

    private releaseItem(index: number) {
        const item = this.activeItems.get(index);
        if (!item) return;
        Tween.stopAllByTarget(item.node);
        item.node.active = false;
        this.activeItems.delete(index);
        this.itemPool.push(item);
    }

    private acquireDots(link: number) {
        const a = this.positionOf(link);
        const b = this.positionOf(link + 1);
        const dots: Node[] = [];
        for (let k = 1; k <= this.dotsPerLink; k++) {
            const t = k / (this.dotsPerLink + 1);
            const dot = this.dotPool.pop() || this.createDot();
            dot.parent = this.content;
            dot.setPosition(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0);
            dot.active = true;
            dots.push(dot);
        }
        this.activeDots.set(link, dots);
    }

    private releaseDots(link: number) {
        const dots = this.activeDots.get(link);
        if (!dots) return;
        dots.forEach(d => { d.active = false; this.dotPool.push(d); });
        this.activeDots.delete(link);
    }

    // ---------- Criacao dos nos (feita uma unica vez por item do pool) ----------

    private makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private makeSprite(n: Node, frame: SpriteFrame | null, order: number): Sprite {
        const sprite = n.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        n.addComponent(Sorting2D).sortingOrder = this.sortingBase + order;
        return sprite;
    }

    private makeLabel(n: Node, size: number, order: number, outline: Color): Label {
        const label = n.addComponent(Label);
        if (this.font) {
            label.useSystemFont = false;
            label.font = this.font;
        }
        label.fontSize = size;
        label.lineHeight = size;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.NONE;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 14));
        n.addComponent(Sorting2D).sortingOrder = this.sortingBase + order;
        return label;
    }

    private createCurrentButton() {
        const w = this.currentButtonWidth, h = this.currentButtonHeight;
        const btn = this.makeNode('CurrentLevelButton', this.node, 0, this.currentButtonY, w, h);
        const sprite = this.makeSprite(btn, this.currentButtonFrame || this.enabledFrame, 12);
        sprite.type = Sprite.Type.SLICED;

        // O texto ocupa `currentTextRatio` do botao: a fonte parte da altura util e o SHRINK ajusta a largura.
        const tw = w * this.currentTextRatio, th = h * this.currentTextRatio;
        const label = this.makeLabel(this.makeNode('Text', btn, 0, 4, tw, th), Math.round(th), 13, new Color(30, 150, 30, 255));
        label.string = this.currentButtonText;
        label.isBold = true;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false; // uma linha so: o SHRINK reduz a fonte para caber no botao
        this.currentButton = btn;
    }

    private isOverCurrentButton(local: Vec3): boolean {
        const btn = this.currentButton;
        if (!btn || !btn.active) return false;
        return Math.abs(local.x - btn.position.x) <= this.currentButtonWidth / 2
            && Math.abs(local.y - btn.position.y) <= this.currentButtonHeight / 2;
    }

    private scrollToCurrent() {
        this.scrollTarget = this.clampScroll(this.positionOf(this.focus).x - this.width / 2);
        this.velocity = 0;
    }

    private createItem(): LevelItem {
        const S = LevelSelector.ITEM_SIZE;
        const root = this.makeNode('LevelItem', this.content!, 0, 0, S, S);
        const bg = this.makeSprite(root, this.enabledFrame, 2);

        const lock = this.makeNode('Lock', root, 0, 78, 70, 70);
        // Sem trim: o icone usa o tamanho completo da imagem, sem cortar a area transparente.
        this.makeSprite(lock, this.lockFrame, 4).trim = false;

        const levelLabel = this.makeLabel(this.makeNode('Level', root, 0, 0, 160, 110), 96, 4, new Color(20, 70, 120, 255));

        const starsRoot = this.makeNode('Stars', root, 0, -78, 170, 56);
        const stars: Sprite[] = [];
        for (let i = 0; i < 3; i++) {
            const star = this.makeNode(`Star${i}`, starsRoot, (i - 1) * 56, i === 1 ? 6 : 0, 52, 52);
            stars.push(this.makeSprite(star, this.starFrame, 4));
        }

        const costRoot = this.makeNode('Cost', root, 0, -S / 2 - 26, 150, 46);
        const costIcon = this.makeNode('Icon', costRoot, -34, 0, 42, 42);
        this.makeSprite(costIcon, this.starFrame, 4);
        const costLabel = this.makeLabel(this.makeNode('Text', costRoot, 18, 0, 70, 46), 40, 4, new Color(60, 50, 20, 255));

        return { node: root, bg, levelLabel, lock, starsRoot, stars, costRoot, costLabel, index: -1 };
    }

    private createDot(): Node {
        const dot = this.makeNode('Dot', this.content!, 0, 0, this.dotSize, this.dotSize);
        const sprite = this.makeSprite(dot, this.dotFrame, 1);
        sprite.color = new Color(255, 255, 255, 170);
        return dot;
    }

    private bindItem(item: LevelItem) {
        const level = item.index;
        const unlocked = this.isUnlocked(level);
        const stars = LevelProgress.getStars(level);

        const special = LevelConfig.isSpecial(level);
        const scale = special ? this.specialScale : 1;
        const size = LevelSelector.ITEM_SIZE * scale;
        const enabled = special && this.specialFrame ? this.specialFrame : this.enabledFrame;
        const disabled = special && this.disabledSpecialFrame ? this.disabledSpecialFrame : this.disabledFrame;
        item.bg.spriteFrame = unlocked ? enabled : disabled;
        item.node.getComponent(UITransform)?.setContentSize(size, size);
        // Os elementos internos acompanham o tamanho do botao (o especial e maior).
        item.lock.setPosition(0, 78 * scale, 0);
        item.starsRoot.setPosition(0, -78 * scale, 0);
        item.costRoot.setPosition(0, -size / 2 - 26, 0);
        item.levelLabel.string = `${level + 1}`;
        item.levelLabel.color = unlocked ? Color.WHITE : this.lockedColor;

        item.lock.active = !unlocked;
        item.starsRoot.active = unlocked && stars > 0;
        item.stars.forEach((s, i) => { s.color = i < stars ? Color.WHITE : this.emptyStarColor; });

        item.costRoot.active = !unlocked;
        item.costLabel.string = `${this.getUnlockCost(level)}`;
    }

    // ---------- Input ----------

    private toLocal(event: EventTouch): Vec3 {
        const ui = event.getUILocation();
        const ut = this.node.getComponent(UITransform)!;
        return ut.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    }

    private itemAt(local: Vec3): LevelItem | null {
        const cx = this.content ? this.content.position.x : 0;
        let found: LevelItem | null = null;
        this.activeItems.forEach(item => {
            const p = this.positionOf(item.index);
            const half = (item.node.getComponent(UITransform)?.width ?? LevelSelector.ITEM_SIZE) / 2 * this.itemScale;
            if (Math.abs(local.x - (cx + p.x)) <= half && Math.abs(local.y - p.y) <= half) found = item;
        });
        return found;
    }

    private onTouchStart(event: EventTouch) {
        if (this.choosing) return;
        const local = this.toLocal(event);
        this.dragging = true;
        this.touchId = event.getID();
        this.lastX = local.x;
        this.lastMoveTime = performance.now();
        this.dragDistance = 0;
        this.velocity = 0;
        this.scrollTarget = null;

        this.pressedCurrentButton = this.isOverCurrentButton(local);
        if (this.pressedCurrentButton && this.currentButton) {
            Tween.stopAllByTarget(this.currentButton);
            tween(this.currentButton).to(0.08, { scale: new Vec3(0.92, 0.92, 1) }).start();
        }

        const item = this.itemAt(local);
        this.pressedIndex = item ? item.index : -1;
        if (item && this.isUnlocked(item.index)) {
            Tween.stopAllByTarget(item.node);
            tween(item.node).to(0.08, { scale: new Vec3(this.itemScale * 0.92, this.itemScale * 0.92, 1) }).start();
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!this.dragging || this.choosing || event.getID() !== this.touchId) return;
        const local = this.toLocal(event);
        const dx = local.x - this.lastX;
        this.lastX = local.x;
        this.dragDistance += Math.abs(dx);

        // O conteudo acompanha o dedo desde o primeiro pixel; o limite so decide se o toque ainda conta como clique.
        if (this.dragDistance > this.dragThreshold) this.releasePress();
        this.scroll = this.clampScroll(this.scroll - dx);

        const now = performance.now();
        const dt = Math.max((now - this.lastMoveTime) / 1000, 0.004);
        this.lastMoveTime = now;
        const instant = Math.max(-5000, Math.min(5000, -dx / dt));
        this.velocity = this.velocity * 0.4 + instant * 0.6;

        this.refreshVisible();
    }

    private onTouchEnd(event: EventTouch) {
        if (!this.dragging || event.getID() !== this.touchId) return;
        this.dragging = false;
        this.touchId = -1;

        // Dedo parado antes de soltar: sem inercia.
        if (performance.now() - this.lastMoveTime > 80) this.velocity = 0;

        if (this.pressedCurrentButton && this.currentButton) {
            this.pressedCurrentButton = false;
            Tween.stopAllByTarget(this.currentButton);
            tween(this.currentButton).to(0.08, { scale: Vec3.ONE }).start();
            if (this.dragDistance <= this.dragThreshold && event.type !== Node.EventType.TOUCH_CANCEL) {
                SoundManager.playMenuClick();
                this.scrollToCurrent();
            }
            return;
        }

        const index = this.pressedIndex;
        this.releasePress();
        if (this.choosing || this.dragDistance > this.dragThreshold || index < 0) return;

        const item = this.activeItems.get(index);
        if (!item) return;
        if (this.isUnlocked(index)) this.chooseLevel(item);
        else this.rejectLevel(item);
    }

    private onWheel(event: EventMouse) {
        if (this.choosing) return;
        this.velocity = 0;
        this.scrollTarget = null;
        const delta = (event.getScrollY() || event.getScrollX()) * this.wheelSpeed;
        this.scroll = this.clampScroll(this.scroll - delta);
        this.refreshVisible();
    }

    private releasePress() {
        const item = this.activeItems.get(this.pressedIndex);
        if (item && this.isUnlocked(item.index)) {
            Tween.stopAllByTarget(item.node);
            tween(item.node).to(0.08, { scale: new Vec3(this.itemScale, this.itemScale, 1) }).start();
        }
        if (this.dragDistance > this.dragThreshold) this.pressedIndex = -1;
    }

    // ---------- Selecao ----------

    private chooseLevel(item: LevelItem) {
        this.choosing = true;
        SoundManager.playMenuClick();
        const s = this.itemScale;
        Tween.stopAllByTarget(item.node);
        tween(item.node)
            .to(0.1, { scale: new Vec3(s * 1.15, s * 1.15, 1) })
            .to(0.08, { scale: new Vec3(s, s, 1) })
            .call(() => {
                GameManager.currentLevel = item.index;
                // Intervalo comercial da Poki antes de comecar a jogar (so roda dentro da Poki; senao segue direto).
                PokiService.commercialBreak().then(() => {
                    this.node.active = false;
                    if (GameManager.instance) GameManager.instance.BeginPlay();
                });
            })
            .start();
    }

    private rejectLevel(item: LevelItem) {
        SoundManager.playBlocked();
        Tween.stopAllByTarget(item.node);
        item.node.setRotationFromEuler(0, 0, 0);
        tween(item.node)
            .to(0.05, { eulerAngles: new Vec3(0, 0, 8) })
            .to(0.1, { eulerAngles: new Vec3(0, 0, -8) })
            .to(0.05, { eulerAngles: new Vec3(0, 0, 0) })
            .start();
    }
}
