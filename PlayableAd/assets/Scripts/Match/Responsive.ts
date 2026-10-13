import { Camera, Canvas, director, Input, input, Node, ResolutionPolicy, SafeArea, screen, UITransform, view, Widget } from 'cc';

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
        // Reaplica e AVISA os layouts apenas se algo mudou de fato (orientacao/tamanho visivel): reorganizar a UI
        // a cada evento atrapalha toques e animacoes (no celular o resize chega varias vezes seguidas).
        const handler = () => {
            this.applyPolicy();
            const sig = `${this.portrait}|${Math.round(this.width)}|${Math.round(this.height)}`;
            if (sig === this.lastSignature) return;
            this.lastSignature = sig;
            this.syncCanvas();
            this.emit();
        };
        this.handler = handler;
        // O que e desenhado e o tamanho que o MOTOR mede: seguimos os eventos dele e reaplicamos logo depois,
        // porque no celular o resize chega em etapas.
        view.on('canvas-resize', handler);
        screen.on('window-resize', handler);
        screen.on('orientation-change', handler);
        this.installDebug();
        if (typeof window !== 'undefined') {
            const later = () => { setTimeout(handler, 80); setTimeout(handler, 350); };
            window.addEventListener('resize', later);
            window.addEventListener('orientationchange', later);
            // Vigia (so ajuda o motor): se o DOM mudou de proporcao e o motor continua medindo outra, pede uma nova
            // medicao (no maximo 3 vezes por mudanca, para nunca ficar disparando resize em loop).
            let lastW = window.innerWidth, lastH = window.innerHeight, tries = 0;
            setInterval(() => {
                const w = window.innerWidth, h = window.innerHeight;
                if (w !== lastW || h !== lastH) { lastW = w; lastH = h; tries = 0; handler(); }
                const ws = screen.windowSize;
                const off = !!ws && ws.width > 0 && ws.height > 0 && Math.abs((ws.width / ws.height) / (w / h) - 1) > 0.05;
                this.engineStale = off;
                if (off && tries < 3) {
                    tries++;
                    window.dispatchEvent(new Event('resize'));
                    setTimeout(handler, 80);
                }
            }, 500);
        }
    }

    private static lastSignature: string = '';
    private static handler: (() => void) | null = null;

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
        // (o primeiro emit e sempre feito, mesmo que o tamanho nao tenha mudado, para posicionar a cena recem-carregada)
        setTimeout(() => { this.applyPolicy(); this.syncCanvas(); this.emit(); }, 0);
        [150, 600].forEach(ms => setTimeout(() => this.handler?.(), ms));
    }

    /** Com `?debug` na URL mostra no canto da tela as medidas usadas pelo layout (para diagnosticar celulares). */
    private static installDebug() {
        if (typeof window === 'undefined' || typeof document === 'undefined' || !/[?&]debug\b/.test(window.location.search)) return;
        const el = document.createElement('pre');
        el.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;margin:0;padding:4px 6px;font:10px/12px monospace;color:#0f0;background:rgba(0,0,0,.65);pointer-events:none;white-space:pre';
        document.body.appendChild(el);

        // Contadores de toque em tres niveis: DOM (o navegador entregou?), motor (`input`) e ultimo ponto convertido.
        const errors: string[] = [];
        const addErr = (m: string) => { errors.push(m.slice(0, 90)); if (errors.length > 3) errors.shift(); };
        window.addEventListener('error', (e: ErrorEvent) => addErr(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
        window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => addErr(`promise: ${String((e.reason && e.reason.message) || e.reason)}`));
        const c = { domStart: 0, domEnd: 0, domCancel: 0, start: 0, end: 0, cancel: 0, target: '-', client: '-', loc: '-', ui: '-', near: '-' };
        const tn = (t: any) => (t && t.tagName ? `${t.tagName}${t.id ? '#' + t.id : ''}` : '-');
        window.addEventListener('touchstart', (e: TouchEvent) => { c.domStart++; c.target = tn(e.target); const t = e.changedTouches[0]; if (t) c.client = `${Math.round(t.clientX)},${Math.round(t.clientY)}`; }, true);
        window.addEventListener('touchend', () => { c.domEnd++; }, true);
        window.addEventListener('touchcancel', () => { c.domCancel++; }, true);
        input.on(Input.EventType.TOUCH_START, (e: any) => {
            c.start++;
            const l = e.getLocation(), u = e.getUILocation();
            c.loc = `${Math.round(l.x)},${Math.round(l.y)}`;
            c.ui = `${Math.round(u.x)},${Math.round(u.y)}`;
            // Elemento do jogo mais proximo do toque (em unidades do canvas): confere o mapeamento tela -> mundo.
            try {
                const cam = director.getScene()?.getComponentInChildren(Camera);
                if (cam) {
                    const w = this.uiToWorld(u.x, u.y);
                    let best = '-', bd = 1e9;
                    director.getScene()!.getComponentsInChildren('MatchElement').forEach((m: any) => {
                        const p = m.node.worldPosition; const d = Math.hypot(p.x - w.x, p.y - w.y);
                        if (d < bd) { bd = d; best = `${Math.round(d)}u`; }
                    });
                    c.near = `${best} world ${Math.round(w.x)},${Math.round(w.y)}`;
                }
            } catch (err) { /* so diagnostico */ }
        });
        input.on(Input.EventType.TOUCH_END, () => { c.end++; });
        input.on(Input.EventType.TOUCH_CANCEL, () => { c.cancel++; });

        setInterval(() => {
            const ws = screen.windowSize;
            const v = view.getVisibleSize();
            const cv = (document.querySelector('canvas') as HTMLCanvasElement | null)?.getBoundingClientRect();
            el.textContent = [
                `dom   ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio}`,
                `engine ${ws ? Math.round(ws.width) + 'x' + Math.round(ws.height) : '-'} vis ${Math.round(v.width)}x${Math.round(v.height)}`,
                `canvas ${cv ? Math.round(cv.left) + ',' + Math.round(cv.top) + ' ' + Math.round(cv.width) + 'x' + Math.round(cv.height) : '-'}`,
                `layout ${this.portrait ? 'PORTRAIT' : 'LANDSCAPE'} ${Math.round(this.width)}x${Math.round(this.height)} stale=${this.engineStale}`,
                `DOM touch s/e/c ${c.domStart}/${c.domEnd}/${c.domCancel} target ${c.target} client ${c.client}`,
                `ENGINE touch s/e/c ${c.start}/${c.end}/${c.cancel} loc ${c.loc} ui ${c.ui}`,
                `nearest element ${c.near}`,
                ...errors.map(e => `ERR ${e}`),
            ].join('\n');
        }, 400);
    }

    public static onChange(cb: () => void) { this.listeners.push(cb); }
    public static offChange(cb: () => void) { this.listeners = this.listeners.filter(l => l !== cb); }

    /** Reaplica o layout (quem criou UI depois do carregamento pode chamar). */
    public static refresh() { this.emit(); }

    private static emit() {
        this.listeners.slice().forEach(cb => { try { cb(); } catch (e) { console.error('[Responsive]', e); } });
    }

    /** true enquanto o motor mede a tela com outra proporcao que o DOM (so informativo/diagnostico). */
    public static engineStale: boolean = false;

    /**
     * Aplica a politica de resolucao. A orientacao e o tamanho visivel vem do MOTOR (`screen.windowSize` e
     * `view.getVisibleSize()`): e com eles que a tela e desenhada e que os toques sao convertidos, entao layout,
     * render e toque nunca se desencontram. O DOM so e usado se o motor ainda nao mediu nada.
     */
    private static applyPolicy() {
        const ws = screen.windowSize;
        const engineOk = !!ws && ws.width > 0 && ws.height > 0;
        const w = engineOk ? ws.width : (typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1280);
        const h = engineOk ? ws.height : (typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 720);
        this.portrait = h > w;
        this.safeW = this.portrait ? this.PORT_W : this.LAND_W;
        this.safeH = this.portrait ? this.PORT_H : this.LAND_H;
        const policy = w / h >= this.safeW / this.safeH ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
        view.setDesignResolutionSize(this.safeW, this.safeH, policy);
        const vis = view.getVisibleSize();
        this.width = vis.width;
        this.height = vis.height;
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
