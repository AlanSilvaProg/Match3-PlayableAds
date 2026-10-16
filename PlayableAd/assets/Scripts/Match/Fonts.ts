import { Font, Label } from 'cc';

/**
 * Fontes do jogo: Fredoka em dois pesos. O peso vem do ARQUIVO da fonte (nao do `isBold`, que engrossaria de novo):
 * Bold na maior parte dos textos e Regular nos textos secundarios (descricoes, dicas). As duas ficam ligadas no
 * OrderManager (propriedades `font` = Bold e `fontRegular` = Regular).
 */
export class Fonts {
    public static bold: Font | null = null;
    public static regular: Font | null = null;

    /** Texto secundario: troca o Label para o peso normal (se a fonte ja estiver carregada). */
    public static regularize(label: Label | null) {
        if (!label || !Fonts.regular) return;
        label.useSystemFont = false;
        label.font = Fonts.regular;
        label.isBold = false;
    }
}
