import { tr } from './I18n';
import { SpriteFrame, Rect, Size, Vec2, Sprite, UITransform, Enum } from 'cc';

export enum PowerupType {
    FreezeTimer,
    FreezeOrders,
    TimeBonus,
    ReduceQuantity,
    AutoSelect,
    Highlight,
    MaxCombo,
    DoublePoints,
}

Enum(PowerupType);

export interface PowerupDef {
    type: PowerupType;
    name: string;
    description: string;
    /** Icone no powerups-sheet.png: x, y, largura, altura (origem no topo esquerdo). */
    rect: [number, number, number, number];
    /** Duracao em segundos (efeitos temporizados) ou valor do efeito (segundos de bonus de tempo). */
    seconds: number;
    /** Custo em pontos para comprar 1 unidade. */
    cost: number;
}

/**
 * Catalogo dos power-ups. Para balancear, edite `seconds` e `cost` abaixo.
 *
 * Custos: o jogador ganha em media algumas centenas de pontos no primeiro nivel e alguns milhares nos
 * niveis avancados (pontos de merges e combos). Os mais baratos sao os de ajuda leve; os caros mudam
 * a partida (combo maximo e pontos em dobro).
 */
export class PowerupCatalog {

    public static readonly defs: PowerupDef[] = [
        { type: PowerupType.FreezeTimer,    get name() { return tr('Freeze Time'); },   get description() { return tr('Stops the level timer for 10s'); },          rect: [22, 37, 92, 121],   seconds: 10, cost: 600 },
        { type: PowerupType.FreezeOrders,   get name() { return tr('Freeze Orders'); }, get description() { return tr('Stops all order timers for 10s'); },         rect: [134, 36, 116, 118], seconds: 10, cost: 600 },
        { type: PowerupType.TimeBonus,      get name() { return tr('+15 Seconds'); },   get description() { return tr('Adds 15s to the level timer'); },            rect: [269, 42, 92, 111],  seconds: 15, cost: 500 },
        { type: PowerupType.ReduceQuantity, get name() { return tr('Less Items'); },    get description() { return tr('Every product in every order drops to 1'); }, rect: [392, 40, 92, 119], seconds: 0,  cost: 800 },
        { type: PowerupType.AutoSelect,     get name() { return tr('Auto Select'); },   get description() { return tr('Selects the foods of the next order'); },    rect: [14, 208, 107, 111], seconds: 0,  cost: 700 },
        { type: PowerupType.Highlight,      get name() { return tr('Focus'); },         get description() { return tr('Highlights the foods of the next order'); }, rect: [135, 203, 113, 114], seconds: 8, cost: 400 },
        { type: PowerupType.MaxCombo,       get name() { return tr('Max Combo'); },     get description() { return tr('Max combo for 10s'); },                      rect: [261, 191, 104, 132], seconds: 10, cost: 1000 },
        { type: PowerupType.DoublePoints,   get name() { return tr('Double Coins'); },  get description() { return tr('Coins x2 for 10s'); },                       rect: [377, 209, 113, 110], seconds: 10, cost: 1200 },
    ];

    private static frames: SpriteFrame[] = [];
    private static builtFrom: SpriteFrame | null = null;

    /** Cria os recortes dos icones a partir do sheet inteiro (idempotente). */
    public static init(sheet: SpriteFrame | null) {
        if (!sheet || !sheet.texture || this.builtFrom === sheet) return;
        this.builtFrom = sheet;
        this.frames = this.defs.map(def => {
            const [x, y, w, h] = def.rect;
            const frame = new SpriteFrame();
            frame.reset({
                texture: sheet.texture,
                rect: new Rect(x, y, w, h),
                originalSize: new Size(w, h),
                offset: new Vec2(0, 0),
                isRotate: false,
            });
            return frame;
        });
    }

    public static getDef(type: PowerupType): PowerupDef {
        return this.defs[type];
    }

    public static getFrame(type: PowerupType): SpriteFrame | null {
        return this.frames[type] || null;
    }

    /** Aplica o icone mantendo a proporcao, cabendo em `maxSize` x `maxSize`. */
    public static applyFitted(sprite: Sprite, type: PowerupType, maxSize: number) {
        const frame = this.getFrame(type);
        if (!frame) return;
        const [, , w, h] = this.defs[type].rect;
        const scale = maxSize / Math.max(w, h);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        sprite.node.getComponent(UITransform)?.setContentSize(w * scale, h * scale);
    }
}
