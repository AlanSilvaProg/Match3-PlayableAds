import { Node, UITransform, Vec3, Label, Color, Sorting2D } from 'cc';
import { Responsive } from './Responsive';
import { tr } from './I18n';
import { OrderManager } from './OrderManager';

interface Saved { pos: Vec3; scale: Vec3; euler: Vec3; size: { w: number, h: number } | null; }

/**
 * Posiciona os nos fixos da cena de jogo conforme a orientacao (veja Responsive). Em paisagem restaura as posicoes
 * originais do editor; em retrato monta o HUD em cima, pedidos em faixa horizontal, tabuleiro no meio e prateleira +
 * power-ups embaixo. Fundos e telas escuras sempre cobrem a tela inteira.
 */
export class GameLayout {
    private static saved: Map<Node, Saved> = new Map();
    /** Faixa no topo do tabuleiro reservada ao texto-guia (os alimentos nao entram nela). */
    private static readonly HINT_BAND = 40;

    /** Texto-guia na faixa reservada: "escolha aqui as comidas dos pedidos". Cria uma vez e so reposiciona depois. */
    private static placeBoardHint(canvas: Node, x: number, y: number, width: number) {
        let n = canvas.getChildByName('BoardHint');
        if (!n) {
            n = new Node('BoardHint');
            n.layer = canvas.layer;
            n.parent = canvas;
            n.addComponent(UITransform).setContentSize(width, 34);
            const label = n.addComponent(Label);
            const font = OrderManager.instance ? OrderManager.instance.font : null;
            if (font) { label.useSystemFont = false; label.font = font; }
            label.string = tr('Pick the foods for your orders here!');
            label.fontSize = 24;
            label.lineHeight = 26;
            label.isBold = true;
            label.color = new Color(255, 236, 170, 235);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.SHRINK;
            label.enableWrapText = false;
            label.enableOutline = true;
            label.outlineColor = new Color(40, 25, 0, 255);
            label.outlineWidth = 3;
            n.addComponent(Sorting2D).sortingOrder = 1;
        }
        n.getComponent(UITransform)!.setContentSize(width, 34);
        n.setPosition(x, y, 0);
    }

    public static apply(canvas: Node) {
        const find = (path: string) => canvas.getChildByPath(path);
        const gm = find('GameManager');
        const nodes = {
            timer: find('GameManager/Timer'),
            timerBg: find('GameManager/TimerBG'),
            combo: find('GameManager/Combo'),
            warning: find('GameManager/WarningEffect'),
            slots: find('SelectedSlots'),
            anchors: find('SelectedSlots/SelectedSlotAnchors'),
            board: find('MatchSpace'),
            orders: find('RemainingElementsArea'),
            logo: find('Logo'),
            ordersBg: find('RemainingElementsArea/RemainingElementsAreaBG'),
        };
        const all = Object.values(nodes).filter(n => !!n) as Node[];
        all.forEach(n => this.save(n));

        // Fundos e camadas escuras: sempre cobrem a tela visivel.
        this.cover(find('background'), 1280, 720);
        this.cover(nodes.warning, 1280, 720);
        this.cover(find('Tutorial/Fade'), 1280, 720);
        this.cover(find('StartScreen/Fade'), 1920, 1124);
        this.cover(find('LevelSelector/Background'), 1280, 720);

        if (!Responsive.portrait) {
            all.forEach(n => this.restore(n));
            const bgSaved = nodes.ordersBg ? this.saved.get(nodes.ordersBg) : null;
            if (nodes.ordersBg && bgSaved && bgSaved.size) {
                nodes.ordersBg.getComponent(UITransform)?.setContentSize(bgSaved.size.w, bgSaved.size.h);
            }
            if (nodes.combo) {
                // ComboIcon/ComboBarBG/ComboScore voltam para o empilhamento vertical da paisagem.
                // O placar de moedas (CoinsHolder) e criado depois do primeiro layout: vai para onde o texto original ficava.
                const scoreOrig = this.saved.get(nodes.combo.getChildByName('ComboScore') as Node)?.pos;
                nodes.combo.children.forEach(c => {
                    if (this.saved.has(c) && (c.name === 'ComboIcon' || c.name === 'ComboBarBG' || c.name === 'ComboScore')) this.restore(c);
                    else if (c.name !== 'ComboIcon' && c.name !== 'ComboBarBG' && scoreOrig) c.setPosition(scoreOrig);
                });
            }
            this.stretchLandscape(nodes);
            this.refreshShelf(canvas);
            return;
        }

        const m = Responsive.portraitMetrics();
        const set = (n: Node | null, x: number, y: number) => { if (n) n.setPosition(x, y, n.position.z); };

        set(nodes.logo, -250, m.logoY);
        set(nodes.timer, 40, m.timerY);
        set(nodes.timerBg, 40, m.timerBarY);

        // Combo em linha: icone a esquerda, barra no meio, placar (moedas) a direita.
        if (nodes.combo) {
            set(nodes.combo, 0, m.comboY);
            const byName = (name: string) => nodes.combo!.getChildByName(name);
            [byName('ComboIcon'), byName('ComboBarBG')].forEach(n => n && this.save(n));
            set(byName('ComboIcon'), -250, 0);
            set(byName('ComboBarBG'), -35, -6);
            nodes.combo.children.filter(c => c.name !== 'ComboIcon' && c.name !== 'ComboBarBG').forEach(c => {
                this.save(c);
                set(c, 235, 0);
            });
        }

        // Fundo da faixa de pedidos: horizontal (sem a rotacao da coluna da paisagem).
        if (nodes.ordersBg) {
            const bgH = m.ordersH + 65;
            nodes.ordersBg.setRotationFromEuler(0, 0, 0);
            // Largura = a tela visivel inteira (em celulares com barras do navegador ela passa de 720).
            nodes.ordersBg.getComponent(UITransform)?.setContentSize(Math.max(Responsive.PORT_W, Responsive.width) + 40, bgH);
            nodes.ordersBg.setPosition(0, -(m.ordersH + 15) / 2, 0);
        }

        // Pedidos: o no do OrderManager fica no topo da faixa (o OrderManager organiza os cartoes em linhas).
        set(nodes.orders, 0, m.ordersTitleY);

        // Tabuleiro.
        if (nodes.board) {
            const band = this.HINT_BAND;
            this.setBoardSize(nodes.board, 700, m.boardH - band / m.boardScale);
            nodes.board.setPosition(0, m.boardY - band / 2, 0);
            nodes.board.setScale(m.boardScale, m.boardScale, 1);
            const fullTop = m.boardY + (m.boardH * m.boardScale) / 2;
            this.placeBoardHint(canvas, 0, fullTop - band / 2, 700 * m.boardScale - 40);
        }

        // Prateleira na horizontal, abaixo do tabuleiro.
        if (nodes.slots) nodes.slots.setPosition(0, m.shelfY, 0);
        if (nodes.anchors) {
            nodes.anchors.setRotationFromEuler(0, 0, 0);
            nodes.anchors.setScale(m.shelfScale, m.shelfScale, 1);
        }
        void gm;
        this.refreshShelf(canvas);
    }

    /**
     * Paisagem em telas maiores que 1280x720: a coluna do HUD e dos pedidos vai para a borda esquerda, a prateleira
     * para a direita e o tabuleiro cresce para ocupar o espaco; embaixo, a barra de power-ups desce para a base.
     */
    private static stretchLandscape(nodes: { [k: string]: Node | null }) {
        const extraW = Math.max(0, Responsive.width - Responsive.LAND_W);
        const extraH = Math.max(0, Responsive.height - Responsive.LAND_H);
        const shift = (n: Node | null | undefined, dx: number) => { if (n) n.setPosition(n.position.x + dx, n.position.y, n.position.z); };
        const left = -extraW / 2;
        [nodes.timer, nodes.timerBg, nodes.combo, nodes.logo, nodes.orders].forEach(n => shift(n, left));
        shift(nodes.slots, extraW / 2);
        if (nodes.board) {
            const saved = this.saved.get(nodes.board);
            const w = (saved?.size?.w ?? 700) + Math.min(extraW * 0.8, 600);
            const h = (saved?.size?.h ?? 510) + Math.min(extraH * 0.8, 400);
            const band = this.HINT_BAND;
            this.setBoardSize(nodes.board, w, h - band);
            const bp = nodes.board.position;
            nodes.board.setPosition(bp.x, bp.y - band / 2, bp.z);
            this.placeBoardHint(nodes.board.parent!, bp.x, bp.y + h / 2 - band / 2, w - 40);
        }
        // Coluna de pedidos: o fundo (sprite girado 90 graus) acompanha a altura visivel.
        const bg = nodes.ordersBg?.getComponent(UITransform);
        if (bg && nodes.ordersBg) {
            const saved = this.saved.get(nodes.ordersBg);
            bg.setContentSize(Math.max(saved?.size?.w ?? 720, Responsive.height), saved?.size?.h ?? 140);
        }
    }

    /** Muda o tamanho da area do tabuleiro e acompanha os itens que ja estao nela (posicao proporcional). */
    private static setBoardSize(board: Node, w: number, h: number) {
        const ut = board.getComponent(UITransform);
        // Valores invalidos (resize em transicao) nunca podem tocar nos itens: x/y viraria 0/NaN e eles se alinhariam.
        if (!ut || !(h >= 100) || !(w >= 100) || !(ut.height >= 100) || !(ut.width >= 100)) return;
        if (Math.abs(ut.height - h) < 0.5 && Math.abs(ut.width - w) < 0.5) return;
        const kx = w / ut.width, ky = h / ut.height;
        board.children.forEach(c => c.setPosition(c.position.x * kx, c.position.y * ky, c.position.z));
        ut.setContentSize(w, h);
    }

    /** Itens na prateleira voltam a seguir os encaixes (que mudaram de lugar com a orientacao). */
    private static refreshShelf(canvas: Node) {
        const slots: any = canvas.scene?.getComponentInChildren('MatchSlots');
        if (slots && slots.CompactSlots) slots.CompactSlots();
    }

    private static save(n: Node) {
        if (this.saved.has(n)) return;
        const ut = n.getComponent(UITransform);
        this.saved.set(n, {
            pos: n.position.clone(), scale: n.scale.clone(), euler: n.eulerAngles.clone(),
            size: ut ? { w: ut.width, h: ut.height } : null,
        });
    }

    private static restore(n: Node) {
        const s = this.saved.get(n);
        if (!s) return;
        if (n.name === 'MatchSpace' && s.size) this.setBoardSize(n, s.size.w, s.size.h);
        n.setPosition(s.pos);
        n.setScale(s.scale);
        n.setRotationFromEuler(s.euler.x, s.euler.y, s.euler.z);
    }

    /** Faz um sprite de `w`x`h` cobrir a tela visivel (proporcao mantida, sobra cortada). */
    private static cover(n: Node | null, w: number, h: number) {
        const ut = n?.getComponent(UITransform);
        if (!n || !ut) return;
        const k = Math.max(Responsive.width / w, Responsive.height / h);
        ut.setContentSize(w * k, h * k);
    }
}
