import { Camera, Canvas, director, Node, ResolutionPolicy, SafeArea, screen, UITransform, view, Widget } from 'cc';

/**
 * Layout responsivo. O jogo e desenhado em duas "areas seguras" (todo o conteudo importante cabe nelas):
 *  - paisagem: 1280x720   - retrato: 720x1280
 * A area segura e sempre mostrada inteira e centralizada; o espaco que sobra (telas mais largas ou mais altas) e
 * preenchido pelo fundo, sem barras pretas. `width`/`height` sao o tamanho VISIVEL (>= area segura), em unidades do
 * canvas, com a origem no centro. Quem posiciona UI deve usar `top/bottom/left/right` e `portrait`.
 */
export class Responsive {
    public static readonly LAND_W = 1280;
    public static readonly LAND_H = 720;
    public static readonly PORT_W = 720;
    public static readonly PORT_H = 1280;

    public static portrait: boolean = false;
    public static width: number = 1280;
    public static height: number = 720;
    /** Area segura atual (1280x720 ou 720x1280). */
    public static safeW: number = 1280;
    public static safeH: number = 720;

    private static listeners: Array<() => void> = [];
    private static installed: boolean = false;
    private static canvasNode: Node | null = null;

    /**
     * Toques (`getUILocation`) vem relativos ao canto inferior esquerdo da area VISIVEL; o centro do canvas/camera
     * fica no centro da area segura. Esta soma leva a posicao do toque para o espaco de mundo do canvas.
     */
    public static uiToWorld(x: number, y: number): { x: number, y: number } {
        return { x: x + this.safeW / 2 - this.width / 2, y: y + this.safeH / 2 - this.height / 2 };
    }

    public static get top() { return this.height / 2; }
    public static get bottom() { return -this.height / 2; }
    public static get left() { return -this.width / 2; }
    public static get right() { return this.width / 2; }

    /** Escala para um fundo de 1280x720 (paisagem) ou 720x1280 (retrato) cobrir toda a tela visivel. */
    public static get coverScale(): number {
        return Math.max(this.width / this.safeW, this.height / this.safeH);
    }

    /**
     * Medidas do layout em RETRATO (coordenadas do canvas, origem no centro). Ancoradas nas bordas VISIVEIS: o HUD
     * cola no topo, prateleira e barra de power-ups colam na base e o tabuleiro ocupa o espaco do meio.
     */
    public static portraitMetrics() {
        const H = this.height;
        const topY = H / 2 - 30;
        const bottomY = -H / 2 + 20;
        const extra = Math.max(0, H - this.PORT_H);
        const ordersH = 190 + Math.min(70, extra * 0.25);
        const ordersTitleY = topY - 285;
        const ordersTop = ordersTitleY - 25;
        const ordersBottom = ordersTop - ordersH;
        const barY = bottomY + 40;
        const shelfScale = 1.3;
        const shelfY = bottomY + 148;
        const shelfTop = shelfY + 56;
        const boardTop = ordersBottom - 15;
        const boardBottom = shelfTop + 15;
        const region = boardTop - boardBottom;
        // Tabuleiro: largura quase total; a altura acompanha o espaco livre (os itens se espalham por toda a area).
        let boardScale = 0.97;
        let boardH = region / boardScale;
        if (boardH < 500) { boardScale = Math.max(0.8, region / 500); boardH = region / boardScale; }
        boardH = Math.max(300, Math.min(boardH, 1000));
        return {
            topY, bottomY, ordersH, ordersTitleY, ordersTop, barY, shelfScale, shelfY,
            logoY: topY - 70, timerY: topY - 55, timerBarY: topY - 108, comboY: topY - 205,
            boardY: (boardTop + boardBottom) / 2, boardScale, boardH,
        };
    }

    /** Roda no carregamento do modulo (antes do Canvas da cena alinhar a camera) e escuta mudancas de tamanho/orientacao. */
    public static install() {
        if (this.installed) return;
        this.installed = true;
        this.applyPolicy();
        const handler = () => { this.applyPolicy(); this.syncCanvas(); this.emit(); };
        // O tamanho confiavel e o que o MOTOR ja atualizou: por isso escutamos os eventos dele (disparam depois que
        // ele leu o novo tamanho) e reaplicamos de novo logo depois, porque no celular o resize chega em varias etapas.
        view.on('canvas-resize', handler);
        screen.on('window-resize', handler);
        screen.on('orientation-change', handler);
        if (typeof window !== 'undefined') {
            const later = () => { setTimeout(handler, 80); setTimeout(handler, 350); };
            window.addEventListener('resize', later);
            window.addEventListener('orientationchange', later);
        }
    }

    /** Liga o Canvas da cena: remove Widget/SafeArea (desalinham a camera) e sincroniza tamanho e posicao. */
    public static attach(canvas: Node) {
        this.canvasNode = canvas;
        // Desabilita antes de destruir: o destroy so vale no fim do frame e o Widget ainda alinharia uma vez.
        [canvas.getComponent(Widget), canvas.getComponent(SafeArea)].forEach(c => { if (c) { c.enabled = false; c.destroy(); } });
        // O Canvas alinharia camera e posicao por conta propria (e errado quando a area segura muda): fica manual.
        const cv = canvas.getComponent(Canvas);
        if (cv) cv.alignCanvasWithScreen = false;
        this.applyPolicy();
        this.syncCanvas();
        // Garante o ajuste depois que o Canvas termina de iniciar.
        [0, 150, 600].forEach(ms => setTimeout(() => { this.applyPolicy(); this.syncCanvas(); this.emit(); }, ms));
    }

    public static onChange(cb: () => void) { this.listeners.push(cb); }
    public static offChange(cb: () => void) { this.listeners = this.listeners.filter(l => l !== cb); }

    /** Reaplica o layout (quem criou UI depois do carregamento pode chamar). */
    public static refresh() { this.emit(); }

    private static emit() {
        this.listeners.slice().forEach(cb => { try { cb(); } catch (e) { console.error('[Responsive]', e); } });
    }

    private static applyPolicy() {
        // Tamanho da janela segundo o motor; cai para o do navegador se ainda nao estiver pronto.
        const ws = screen.windowSize;
        const w = ws && ws.width > 0 ? ws.width : (typeof window !== 'undefined' ? window.innerWidth : 1280);
        const h = ws && ws.height > 0 ? ws.height : (typeof window !== 'undefined' ? window.innerHeight : 720);
        if (!(w > 0 && h > 0)) return;
        this.portrait = h > w;
        this.safeW = this.portrait ? this.PORT_W : this.LAND_W;
        this.safeH = this.portrait ? this.PORT_H : this.LAND_H;
        const aspect = w / h;
        const safeAspect = this.safeW / this.safeH;
        // Mais largo que a area segura: altura fixa (sobra largura). Mais estreito: largura fixa (sobra altura).
        const policy = aspect >= safeAspect ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
        view.setDesignResolutionSize(this.safeW, this.safeH, policy);
        // O tamanho visivel e calculado aqui (nao lido do motor, que pode ainda estar com o tamanho antigo):
        // a area segura cobre a tela com a mesma proporcao da janela.
        if (aspect >= safeAspect) { this.height = this.safeH; this.width = this.safeH * aspect; }
        else { this.width = this.safeW; this.height = this.safeW / aspect; }
    }

    /** O centro da area segura e o centro do canvas/camera: com a area segura mudando, move os dois. */
    private static syncCanvas() {
        const canvas = this.canvasNode && this.canvasNode.isValid ? this.canvasNode : null;
        if (!canvas) return;
        canvas.setPosition(this.safeW / 2, this.safeH / 2, 0);
        canvas.getComponent(UITransform)?.setContentSize(this.width, this.height);
        const cam = director.getScene()?.getComponentInChildren(Camera);
        if (cam) cam.node.setPosition(this.safeW / 2, this.safeH / 2, cam.node.position.z);
        if (cam) cam.orthoHeight = this.height / 2;
    }
}
