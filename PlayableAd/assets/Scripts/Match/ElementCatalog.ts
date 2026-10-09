import { SpriteFrame, Rect, Size, Vec2, Sprite, UITransform } from 'cc';
import { ElementType } from './ElementType';

export interface ElementDef {
    type: ElementType;
    name: string;
    /** Retangulo do item no sheet (x, y, largura, altura) em pixels, origem no topo esquerdo. */
    rect: [number, number, number, number];
    /** Multiplicador dos pontos que o merge entrega ao combo (barra e pontuacao). */
    comboWeight: number;
    /** Primeiro nivel (indice, 0 = nivel 1) em que o item pode aparecer. */
    unlockLevel: number;
}

/**
 * Catalogo dos itens de merge. Os sprites sao recortes do food-elements-sheet.png criados em runtime
 * (o Cocos nao fatia uma imagem em varios sprite frames). A quantidade necessaria para o merge vem dos pedidos (OrderManager).
 */
export class ElementCatalog {

    public static readonly defs: ElementDef[] = [
        { type: ElementType.Fries,      name: 'Fries',       rect: [6, 24, 114, 136],   comboWeight: 1.0, unlockLevel: 0 },
        { type: ElementType.Burger,     name: 'Burger',      rect: [132, 34, 110, 125], comboWeight: 1.0, unlockLevel: 0 },
        { type: ElementType.IceCream,   name: 'Ice Cream',   rect: [273, 17, 79, 149],  comboWeight: 1.0, unlockLevel: 0 },
        { type: ElementType.Soda,       name: 'Soda',        rect: [397, 12, 81, 156],  comboWeight: 1.0, unlockLevel: 2 },
        { type: ElementType.Chicken,    name: 'Chicken',     rect: [505, 30, 115, 130], comboWeight: 1.4, unlockLevel: 4 },
        { type: ElementType.Pizza,      name: 'Pizza',       rect: [5, 255, 116, 116],  comboWeight: 1.2, unlockLevel: 6 },
        { type: ElementType.HotDog,     name: 'Hot Dog',     rect: [130, 256, 115, 119], comboWeight: 1.4, unlockLevel: 8 },
        { type: ElementType.Donut,      name: 'Donut',       rect: [255, 260, 115, 115], comboWeight: 1.2, unlockLevel: 11 },
        { type: ElementType.Taco,       name: 'Taco',        rect: [381, 261, 113, 111], comboWeight: 1.6, unlockLevel: 13 },
        { type: ElementType.Popcorn,    name: 'Popcorn',     rect: [512, 244, 101, 137], comboWeight: 1.3, unlockLevel: 16 },
        { type: ElementType.OnionRings, name: 'Onion Rings', rect: [5, 495, 115, 102],  comboWeight: 1.6, unlockLevel: 18 },
        { type: ElementType.Sandwich,   name: 'Sandwich',    rect: [129, 493, 117, 109], comboWeight: 1.8, unlockLevel: 21 },
        { type: ElementType.Muffin,     name: 'Muffin',      rect: [259, 495, 107, 106], comboWeight: 1.4, unlockLevel: 24 },
        { type: ElementType.Cupcake,    name: 'Cupcake',     rect: [395, 486, 85, 117],  comboWeight: 1.8, unlockLevel: 27 },
        { type: ElementType.Milkshake,  name: 'Milkshake',   rect: [509, 461, 88, 148],  comboWeight: 2.0, unlockLevel: 30 },
    ];

    private static frames: SpriteFrame[] = [];
    private static builtFrom: SpriteFrame | null = null;

    /** Cria os recortes a partir do sheet inteiro (idempotente). */
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

    public static getDef(type: ElementType): ElementDef {
        return this.defs[type];
    }

    public static getFrame(type: ElementType): SpriteFrame | null {
        return this.frames[type] || null;
    }

    public static comboWeight(type: ElementType): number {
        return this.defs[type].comboWeight;
    }

    /** Aplica o frame mantendo a proporcao, cabendo em `maxSize` x `maxSize`. */
    public static applyFitted(sprite: Sprite, type: ElementType, maxSize: number) {
        const frame = this.getFrame(type);
        if (!frame) return;
        const [, , w, h] = this.defs[type].rect;
        const scale = maxSize / Math.max(w, h);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        sprite.node.getComponent(UITransform)?.setContentSize(w * scale, h * scale);
    }
}
