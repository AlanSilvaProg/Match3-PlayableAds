import { _decorator, Component, Node, Label, Sorting2D, Sprite } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Exibidor de coins (prefab CoinsHolder): holder nine slice + icone da moeda (esquerda) + texto (direita).
 * Ajuste tamanhos e posicoes direto no prefab; o codigo so escreve o valor e a ordem de desenho.
 */
@ccclass('CoinsHolderView')
export class CoinsHolderView extends Component {

    @property({ type: Label, tooltip: 'Texto com a quantidade de coins.' })
    public label: Label | null = null;

    @property({ type: Node, tooltip: 'Icone da moeda (destino das moedas que voam dos merges).' })
    public coin: Node | null = null;

    /**
     * Mostra/esconde so o fundo (holder). Usa `enabled` e nao alpha 0: o alpha de um Sprite se propaga aos filhos
     * e apagaria tambem a moeda e o texto.
     */
    public setHolderVisible(visible: boolean) {
        const bg = this.node.getComponent(Sprite);
        if (bg) bg.enabled = visible;
    }

    public setValue(value: number) {
        if (this.label) this.label.string = `${value}`;
    }

    /** Soma `base` a ordem de desenho de todos os elementos do holder (mantem a ordem relativa do prefab). */
    public setSortingBase(base: number) {
        this.node.getComponentsInChildren(Sorting2D).forEach(s => { s.sortingOrder += base; });
    }
}
