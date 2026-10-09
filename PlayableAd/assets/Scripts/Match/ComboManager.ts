import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Prefab, instantiate, tween, Tween, Vec3, math, Color } from 'cc';
import { GameManager } from './GameManager';
import { PlayerStats, AchievementMetric } from './PlayerStats';
const { ccclass, property } = _decorator;

@ccclass('ComboLevel')
export class ComboLevel {
    @property({ tooltip: 'Multiplicador exibido e somado aos pontos de cada match neste nivel.' })
    public multiplier: number = 2;

    @property({ type: SpriteFrame, tooltip: 'Imagem do combo neste nivel (UI/Combo).' })
    public icon: SpriteFrame | null = null;

    @property({ tooltip: 'Pontos de combo necessarios para encher a barra e subir para o proximo nivel.' })
    public pointsToFill: number = 300;

    @property({ tooltip: 'Multiplicador da velocidade de drenagem da barra neste nivel (1 = base).' })
    public drainMultiplier: number = 1;
}

@ccclass('ComboManager')
export class ComboManager extends Component {

    public static instance: ComboManager = null!;

    // ---------- Pontuacao / niveis ----------
    @property({ tooltip: 'Pontos fixos por match (n). Pontos finais = n + multiplicador atual.' })
    public basePointsPerMatch: number = 100;

    @property({ type: [ComboLevel], tooltip: 'Niveis do combo, em ordem. Edite aqui pontos, imagens e dificuldade de cada nivel.' })
    public levels: ComboLevel[] = [
        ComboManager.makeLevel(2, 300, 1),
        ComboManager.makeLevel(4, 450, 1.25),
        ComboManager.makeLevel(6, 600, 1.5),
        ComboManager.makeLevel(8, 600, 1.8),
    ];

    // ---------- Barra ----------
    @property({ tooltip: 'Drenagem da barra por segundo (0..1) no nivel base.' })
    public baseDrainPerSecond: number = 0.12;

    @property({ tooltip: 'Janela (s) apos o ultimo match em que o bonus de velocidade e aplicado.' })
    public speedBonusWindow: number = 2.0;

    @property({ tooltip: 'Bonus maximo no enchimento da barra para matches instantaneos (0.5 = +50%).' })
    public maxSpeedBonus: number = 0.5;

    @property({ tooltip: 'Fracao da barra mantida ao subir de nivel (0..1).' })
    public carryOverOnLevelUp: number = 0.2;

    @property({ tooltip: 'Abaixo desta fracao da barra o icone treme e a barra fica vermelha.' })
    public dangerThreshold: number = 0.25;

    // ---------- Referencias de cena ----------
    @property(Node)
    public root: Node | null = null;

    @property(Sprite)
    public iconSprite: Sprite | null = null;

    @property(Sprite)
    public barFill: Sprite | null = null;

    @property(Label)
    public scoreLabel: Label | null = null;

    // ---------- Efeito de transicao ----------
    @property({ type: Prefab, tooltip: 'Efeito tocado ao subir de nivel (reaproveita MergeEffect).' })
    public levelUpEffectPrefab: Prefab | null = null;

    @property({ tooltip: 'Escala do efeito de transicao.' })
    public levelUpEffectScale: number = 1.5;

    @property({ tooltip: 'Duracao (s) da animacao de transicao do icone.' })
    public levelUpDuration: number = 0.45;

    @property({ tooltip: 'Escala maxima (overshoot) do icone na transicao.' })
    public levelUpOvershoot: number = 1.5;

    @property({ tooltip: 'Escala de pulso do icone a cada match.' })
    public matchPunchScale: number = 1.18;

    @property({ tooltip: 'Amplitude da pulsacao idle do icone (0 desliga).' })
    public idlePulseAmount: number = 0.05;

    @property({ tooltip: 'Velocidade da pulsacao idle.' })
    public idlePulseSpeed: number = 4;

    @property({ type: SpriteFrame, tooltip: 'Imagem do estado sem combo (UI/Combo/without_combo).' })
    public noComboIcon: SpriteFrame | null = null;

    @property({ tooltip: 'Cor (tint) do icone no estado sem combo, para parecer apagado.' })
    public noComboColor: Color = new Color(150, 150, 150, 200);

    @property({ tooltip: 'Amplitude do balanco neutro (graus) no estado sem combo.' })
    public noComboSwayDegrees: number = 4;

    @property({ tooltip: 'Velocidade do balanco neutro no estado sem combo.' })
    public noComboSwaySpeed: number = 1.5;

    public score: number = 0;

    private static makeLevel(multiplier: number, pointsToFill: number, drainMultiplier: number): ComboLevel {
        const l = new ComboLevel();
        l.multiplier = multiplier;
        l.pointsToFill = pointsToFill;
        l.drainMultiplier = drainMultiplier;
        return l;
    }

    private levelIndex: number = 0;
    private bar: number = 0;
    private comboActive: boolean = false;
    private sinceLastMatch: number = 999;
    private displayedScore: number = 0;
    private time: number = 0;
    private busyTween: boolean = false;
    private baseScale: number = 1;
    /** Pontos ja somados ao placar, mas ainda nao mostrados: so aparecem quando as moedas chegam ao holder. */
    private hiddenPoints: number = 0;
    private maxComboRemaining: number = 0;
    private scoreMultiplier: number = 1;
    private scoreMultiplierRemaining: number = 0;

    private readonly colorSafe = new Color(255, 214, 51, 255);
    private readonly colorDanger = new Color(255, 70, 50, 255);

    onLoad() {
        ComboManager.instance = this;
    }

    start() {
        // O tamanho base e o definido no editor (escala do no do icone).
        if (this.iconSprite) this.baseScale = this.iconSprite.node.scale.x || 1;
        this.applyLevelVisual();
        this.refreshBar();
        this.refreshScore(true);
    }

    onDestroy() {
        if (ComboManager.instance === this) ComboManager.instance = null!;
    }

    public get currentMultiplier(): number {
        return this.levels.length > 0 ? this.levels[this.levelIndex].multiplier : 1;
    }

    /** Chamado pelo MatchController a cada match concluido. */
    /** Power-up: combo no maximo (nivel e barra cheios, sem drenar) durante `seconds`. */
    public ForceMax(seconds: number) {
        this.maxComboRemaining = Math.max(this.maxComboRemaining, seconds);
        const wasMax = this.comboActive && this.levelIndex === this.levels.length - 1;
        this.comboActive = true;
        this.levelIndex = this.levels.length - 1;
        this.bar = 1;
        this.sinceLastMatch = 0;
        if (!wasMax) this.playLevelUp();
        this.refreshBar();
    }

    /** Power-up: multiplica os pontos ganhos durante `seconds`. */
    public SetScoreMultiplier(multiplier: number, seconds: number) {
        this.scoreMultiplier = multiplier;
        this.scoreMultiplierRemaining = Math.max(this.scoreMultiplierRemaining, seconds);
    }

    public get maxComboSecondsLeft(): number { return this.maxComboRemaining; }
    public get scoreMultiplierSecondsLeft(): number { return this.scoreMultiplierRemaining; }

    /** Registra um merge e devolve os pontos ganhos. */
    public RegisterMatch(weight: number = 1, quantity: number = 1): number {
        const gm = GameManager.instance;
        if (gm && !gm.IsRunning()) return 0;
        if (this.levels.length === 0) return 0;

        const level = this.levels[this.levelIndex];
        // O peso do item (ElementCatalog.comboWeight) escala os pontos e, com eles, o enchimento da barra.
        // Pedidos maiores valem mais: +20% por item alem do primeiro.
        const gained = Math.round((this.basePointsPerMatch + level.multiplier) * weight * (1 + 0.2 * (quantity - 1))
            * (this.scoreMultiplierRemaining > 0 ? this.scoreMultiplier : 1));
        this.score += gained;

        const speed = this.comboActive
            ? math.clamp01(1 - this.sinceLastMatch / Math.max(0.01, this.speedBonusWindow))
            : 0;
        const fill = (gained / Math.max(1, level.pointsToFill)) * (1 + this.maxSpeedBonus * speed);

        const wasActive = this.comboActive;
        this.comboActive = true;
        this.sinceLastMatch = 0;
        this.bar += fill;

        const isLast = this.levelIndex >= this.levels.length - 1;
        if (!wasActive) {
            this.playLevelUp();
        } else if (this.bar >= 1) {
            if (!isLast) {
                this.bar = Math.min(1, this.carryOverOnLevelUp + (this.bar - 1));
                this.levelIndex++;
                if (this.levelIndex === this.levels.length - 1) PlayerStats.increment(AchievementMetric.MaxComboReached);
                this.playLevelUp();
            } else {
                this.bar = 1;
                this.playPunch();
            }
        } else {
            this.playPunch();
        }

        this.refreshBar();
        this.refreshScore(false);
        return gained;
    }

    /** Segura `points` fora do texto do placar ate as moedas chegarem (veja ReleaseDisplay). */
    public HoldDisplay(points: number) {
        this.hiddenPoints += points;
    }

    /** Libera pontos para o texto do placar (chamado quando uma moeda chega ao holder). */
    public ReleaseDisplay(points: number) {
        this.hiddenPoints = Math.max(0, this.hiddenPoints - points);
    }

    update(dt: number) {
        this.time += dt;
        const gm = GameManager.instance;
        if (gm && !gm.IsRunning()) return;

        this.sinceLastMatch += dt;

        if (this.scoreMultiplierRemaining > 0) {
            this.scoreMultiplierRemaining = Math.max(0, this.scoreMultiplierRemaining - dt);
            if (this.scoreMultiplierRemaining === 0) this.scoreMultiplier = 1;
        }

        if (this.maxComboRemaining > 0) {
            // Combo maximo: nivel e barra travados no topo; ao acabar a barra segue drenando normalmente.
            this.maxComboRemaining = Math.max(0, this.maxComboRemaining - dt);
            this.bar = 1;
            this.sinceLastMatch = 0;
            this.refreshBar();
            this.animateIdle();
            this.tickScore(dt);
            return;
        }

        if (this.comboActive) {
            const drain = this.baseDrainPerSecond * this.levels[this.levelIndex].drainMultiplier;
            this.bar -= drain * dt;
            if (this.bar <= 0) {
                this.bar = 0;
                this.dropCombo();
            }
            this.refreshBar();
        }

        this.animateIdle();
        this.tickScore(dt);
    }

    // ---------- Estado ----------

    private dropCombo() {
        this.comboActive = false;
        this.levelIndex = 0;
        this.applyLevelVisual();
        this.playDrop();
    }

    // ---------- Visual ----------

    private applyLevelVisual() {
        if (!this.iconSprite || this.levels.length === 0) return;
        if (!this.comboActive) {
            if (this.noComboIcon) this.iconSprite.spriteFrame = this.noComboIcon;
            this.iconSprite.color = this.noComboColor;
        } else {
            const icon = this.levels[this.levelIndex].icon;
            if (icon) this.iconSprite.spriteFrame = icon;
            this.iconSprite.color = Color.WHITE;
        }
    }

    private refreshBar() {
        if (!this.barFill) return;
        this.barFill.fillRange = this.bar;
        const danger = this.comboActive && this.bar < this.dangerThreshold;
        this.barFill.color = danger ? this.colorDanger : this.colorSafe;
    }

    private refreshScore(instant: boolean) {
        if (instant) this.displayedScore = this.score;
        if (this.scoreLabel) this.scoreLabel.string = Math.round(this.displayedScore).toString();
    }

    private tickScore(dt: number) {
        const target = this.score - this.hiddenPoints;
        if (this.displayedScore === target) return;
        const diff = target - this.displayedScore;
        this.displayedScore += Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 10));
        if (Math.abs(target - this.displayedScore) < 1) this.displayedScore = target;
        this.refreshScore(false);
    }

    private animateIdle() {
        const icon = this.iconSprite?.node;
        if (!icon || this.busyTween) return;

        const s = this.baseScale;

        if (!this.comboActive) {
            // Estado neutro: respiracao lenta e balanco suave, sem energia.
            const breath = 1 + Math.sin(this.time * this.noComboSwaySpeed) * 0.03;
            icon.setScale(s * 0.9 * breath, s * 0.9 * breath, 1);
            icon.setRotationFromEuler(0, 0, Math.sin(this.time * this.noComboSwaySpeed * 0.7) * this.noComboSwayDegrees);
            return;
        }

        const pulse = 1 + Math.sin(this.time * this.idlePulseSpeed) * this.idlePulseAmount;
        icon.setScale(s * pulse, s * pulse, 1);

        const danger = this.comboActive && this.bar < this.dangerThreshold;
        icon.setRotationFromEuler(0, 0, danger ? Math.sin(this.time * 40) * 4 : 0);
    }

    private playPunch() {
        const icon = this.iconSprite?.node;
        if (icon) {
            this.busyTween = true;
            Tween.stopAllByTarget(icon);
            const s = this.baseScale;
            tween(icon)
                .to(0.08, { scale: new Vec3(s * this.matchPunchScale, s * this.matchPunchScale, 1) })
                .to(0.12, { scale: new Vec3(s, s, 1) })
                .call(() => { this.busyTween = false; })
                .start();
        }
        // O pulso do placar acontece quando as moedas chegam ao holder (PowerupManager).
    }

    private punchLabel() {
        const n = this.scoreLabel?.node;
        if (!n) return;
        Tween.stopAllByTarget(n);
        n.setScale(1, 1, 1);
        tween(n)
            .to(0.08, { scale: new Vec3(1.25, 1.25, 1) })
            .to(0.12, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private playLevelUp() {
        this.applyLevelVisual();

        const icon = this.iconSprite?.node;
        if (icon) {
            this.busyTween = true;
            Tween.stopAllByTarget(icon);
            const s = this.baseScale;
            const o = s * this.levelUpOvershoot;
            icon.setScale(0, 0, 1);
            icon.setRotationFromEuler(0, 0, -25);
            const d = this.levelUpDuration;
            tween(icon)
                .to(d * 0.55, { scale: new Vec3(o, o, 1), eulerAngles: new Vec3(0, 0, 10) }, { easing: 'quadOut' })
                .to(d * 0.45, { scale: new Vec3(s, s, 1), eulerAngles: new Vec3(0, 0, 0) }, { easing: 'backOut' })
                .call(() => { this.busyTween = false; })
                .start();

            if (this.levelUpEffectPrefab) {
                const fx = instantiate(this.levelUpEffectPrefab);
                fx.parent = icon.parent;
                fx.setPosition(icon.position);
                fx.setScale(this.levelUpEffectScale, this.levelUpEffectScale, 1);
            }
        }
        // O pulso do placar acontece quando as moedas chegam ao holder (PowerupManager).
    }

    private playDrop() {
        const icon = this.iconSprite?.node;
        if (!icon) return;
        this.busyTween = true;
        Tween.stopAllByTarget(icon);
        const s = this.baseScale;
        tween(icon)
            .to(0.12, { scale: new Vec3(s * 0.7, s * 0.7, 1) })
            .to(0.18, { scale: new Vec3(s * 0.9, s * 0.9, 1) }, { easing: 'backOut' })
            .call(() => { this.busyTween = false; })
            .start();
    }
}
