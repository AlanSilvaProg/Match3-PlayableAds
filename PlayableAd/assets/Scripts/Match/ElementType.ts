import { Enum } from 'cc';

/** Ordem = ordem dos itens no sheet food-elements-sheet.png (esquerda->direita, cima->baixo). */
export enum ElementType {
    Fries,
    Burger,
    IceCream,
    Soda,
    Chicken,
    Pizza,
    HotDog,
    Donut,
    Taco,
    Popcorn,
    OnionRings,
    Sandwich,
    Muffin,
    Cupcake,
    Milkshake
}

Enum(ElementType);
