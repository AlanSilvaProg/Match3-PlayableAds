import { _decorator, Component, Node, Sprite, SpriteFrame, Label, UITransform, Vec3, Color, Sorting2D, UIOpacity, tween, Tween, sys, game } from 'cc';
const { ccclass, property } = _decorator;

import { PowerupManager } from './PowerupManager';
import { LevelProgress } from './LevelProgress';
import { PokiService } from './PokiService';
import { isProfane } from './BadWords';

interface RankEntry {
    id: string;
    name: string;
    stars: number;
}

interface RankRow {
    node: Node;
}

/**
 * Ranking de jogadores por estrelas totais, guardado no AUDS (Arbitrary User Data Store) da Poki.
 *
 * Cada jogador tem UMA entrada na colecao `leaderboard` com values { name, stars }. O id e o secret recebidos ao
 * criar a entrada ficam no cache local e sao usados para atualizar a pontuacao. O AUDS so funciona com o jogo
 * publicado na Poki: preencha `pokiGameId` no inspector.
 */
@ccclass('RankingManager')
export class RankingManager extends Component {

    public static instance: RankingManager = null!;
    private static readonly STORAGE_KEY = 'match3_auds';

    @property({ tooltip: 'ID do jogo na Poki (o <your-poki-game-id> da URL do AUDS). Vazio = ranking indisponivel.' })
    public pokiGameId: string = '';

    @property({ tooltip: 'URL base do AUDS.' })
    public baseUrl: string = 'https://auds.poki.io/v0';

    @property({ tooltip: 'Nome da colecao (freeform-key) usada para o ranking.' })
    public collection: string = 'leaderboard';

    @property({ tooltip: 'Quantos jogadores aparecem no ranking (1 a 100).' })
    public topCount: number = 50;

    @property({ tooltip: 'Segundos que o ranking baixado fica em cache antes de buscar de novo ao reabrir a janela.' })
    public cacheSeconds: number = 30;

    @property({ type: SpriteFrame, tooltip: 'Icone do botao que abre o ranking (temporario).' })
    public openIcon: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Icone da estrela mostrado ao lado da pontuacao.' })
    public starFrame: SpriteFrame | null = null;

    @property({ tooltip: 'Altura (px) de cada linha.' })
    public rowHeight: number = 64;

    @property({ tooltip: 'Espaco (px) entre as linhas.' })
    public rowGap: number = 8;

    @property({ tooltip: 'Largura (px) da area visivel da lista.' })
    public viewportWidth: number = 900;

    @property({ tooltip: 'Altura (px) da area visivel da lista.' })
    public viewportHeight: number = 360;

    private state: { id?: string, secret?: string, name?: string, synced?: number, syncedName?: string, named?: boolean } = {};
    private user: { username: string, avatarUrl: string } | null = null;
    private accountsAvailable: boolean = false;
    private profileRoot: Node | null = null;
    private profileInfo: Label | null = null;
    private profileHint: Label | null = null;
    private loginButton: Node | null = null;
    private inputEl: HTMLInputElement | null = null;
    private profileDone: (() => void) | null = null;
    private syncing: boolean = false;
    private windowRoot: Node | null = null;
    private content: Node | null = null;
    private statusLabel: Label | null = null;
    private myRankLabel: Label | null = null;
    private rows: RankRow[] = [];
    private entries: RankEntry[] = [];
    private lastFetch: number = 0;
    private scroll: number = 0;
    private velocity: number = 0;
    private dragging: boolean = false;
    private lastY: number = 0;
    private lastMove: number = 0;

    protected onLoad() {
        RankingManager.instance = this;
        this.reloadState();
    }

    protected start() {
        // Jogador logado na Poki: o nome da conta vira o apelido (se ele ainda nao escolheu um).
        PokiService.getUser().then(info => {
            if (!this.isValid) return;
            this.accountsAvailable = info.available;
            this.user = info.user;
            if (info.user && !this.state.named) {
                const account = this.sanitize(info.user.username);
                // Nome da conta com palavrao: mantem o apelido gerado (ChefNNNN).
                this.state.name = account && !isProfane(account) ? account : this.state.name;
                this.state.named = true;
                this.saveState();
                this.SyncScore();
            }
        });
    }

    /** Le o estado salvo (de novo): usado depois que o save da nuvem da Poki e injetado no localStorage. */
    public reloadState() {
        this.state = {};
        try {
            const raw = sys.localStorage.getItem(RankingManager.STORAGE_KEY);
            if (raw) this.state = JSON.parse(raw) || {};
        } catch (e) { }
        if (!this.state.name) {
            this.state.name = `Chef${Math.floor(1000 + Math.random() * 9000)}`;
            this.saveState();
        }
    }

    private sanitize(name: string): string {
        return (name || '').replace(/[^\w \-.]/g, '').trim().slice(0, 14);
    }

    protected onDestroy() {
        if (RankingManager.instance === this) RankingManager.instance = null!;
    }

    protected update(dt: number) {
        if (!this.windowRoot || !this.windowRoot.active) return;
        if (!this.dragging && Math.abs(this.velocity) > 1) {
            this.setScroll(this.scroll + this.velocity * dt);
            this.velocity *= Math.max(0, 1 - 4 * dt);
        }
    }

    // ---------- AUDS ----------

    public get available(): boolean {
        return this.pokiGameId.trim().length > 0 && typeof fetch === 'function';
    }

    private url(path: string = ''): string {
        return `${this.baseUrl}/${encodeURIComponent(this.pokiGameId.trim())}/userdata/${encodeURIComponent(this.collection)}${path}`;
    }

    private saveState() {
        try {
            sys.localStorage.setItem(RankingManager.STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) { }
    }

    /**
     * Envia a pontuacao (estrelas totais) do jogador. Cria a entrada na primeira vez e depois so atualiza quando
     * a pontuacao sobe. Seguro de chamar a qualquer momento: sem ID do jogo ou sem rede, nada acontece.
     */
    public async SyncScore(): Promise<void> {
        const stars = LevelProgress.getTotalStars();
        if (!this.available || this.syncing || stars <= 0) return;
        if (this.state.synced === stars && this.state.syncedName === this.state.name) return;
        this.syncing = true;
        try {
            const values = { name: this.state.name || 'Chef', stars };
            if (this.state.id && this.state.secret) {
                const res = await fetch(this.url(`/${this.state.id}`), {
                    method: 'POST',
                    body: JSON.stringify({ secret: this.state.secret, values }),
                });
                if (res.ok) {
                    this.state.synced = stars;
                    this.state.syncedName = this.state.name;
                    this.saveState();
                    return;
                }
                // Entrada expirada/apagada: cria uma nova abaixo.
                this.state.id = undefined;
                this.state.secret = undefined;
            }
            const res = await fetch(this.url(), { method: 'POST', body: JSON.stringify({ data: {}, values }) });
            if (res.ok) {
                const json = await res.json();
                this.state.id = json.id;
                this.state.secret = json.secret;
                this.state.synced = stars;
                this.state.syncedName = this.state.name;
                this.saveState();
            }
        } catch (e) {
            console.warn('[RankingManager] sync falhou:', e);
        } finally {
            this.syncing = false;
        }
    }

    private async fetchTop(): Promise<RankEntry[]> {
        const limit = Math.max(1, Math.min(100, this.topCount));
        const res = await fetch(this.url(`?sort=-stars&limit=${limit}`));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return (json.items || []).map((it: any) => ({
            id: it.id,
            // Nomes enviados por outros jogadores tambem passam pelo filtro antes de aparecer.
            name: isProfane(String(it.values?.name ?? '')) ? 'Player' : String(it.values?.name ?? 'Chef'),
            stars: Number(it.values?.stars ?? 0),
        }));
    }

    /** Posicao do jogador: 1 + quantos jogadores tem MAIS estrelas. Devolve 0 se nao der para calcular. */
    private async fetchMyRank(stars: number): Promise<number> {
        try {
            const q = encodeURIComponent(JSON.stringify({ stars: { $gt: stars } }));
            const res = await fetch(this.url(`?q=${q}&limit=1`));
            if (!res.ok) return 0;
            const json = await res.json();
            return typeof json.total === 'number' ? json.total + 1 : 0;
        } catch (e) {
            return 0;
        }
    }

    private async refresh(force: boolean) {
        if (!this.available) {
            this.showStatus('Ranking unavailable.\nThe game id is not set.');
            this.clearRows();
            return;
        }
        const fresh = performance.now() - this.lastFetch < this.cacheSeconds * 1000;
        if (!force && fresh && this.entries.length > 0) {
            this.buildRows();
            return;
        }
        this.showStatus('Loading...');
        this.clearRows();
        try {
            await this.SyncScore();
            this.entries = await this.fetchTop();
            this.lastFetch = performance.now();
            this.showStatus(this.entries.length === 0 ? 'No players yet. Be the first!' : '');
            this.buildRows();

            const mine = this.entries.findIndex(e => e.id === this.state.id);
            const stars = LevelProgress.getTotalStars();
            const rank = mine !== -1 ? mine + 1 : (stars > 0 ? await this.fetchMyRank(stars) : 0);
            if (this.myRankLabel) {
                this.myRankLabel.string = rank > 0 ? `Your rank: #${rank}   ${stars} stars` : (stars > 0 ? `Your stars: ${stars}` : 'Win a level to join the ranking!');
            }
        } catch (e) {
            console.warn('[RankingManager] ranking falhou:', e);
            this.showStatus('Could not load the ranking.\nTry again later.');
        }
    }

    // ---------- UI helpers ----------

    private get pm(): PowerupManager | null {
        return PowerupManager.instance || null;
    }

    private makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
        const n = new Node(name);
        n.layer = this.node.layer;
        n.parent = parent;
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        return n;
    }

    private makeSprite(n: Node, frame: SpriteFrame | null, order: number, sliced: boolean = false): Sprite {
        const sprite = n.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sliced) sprite.type = Sprite.Type.SLICED;
        sprite.spriteFrame = frame;
        n.addComponent(Sorting2D).sortingOrder = order;
        return sprite;
    }

    private makeLabel(parent: Node, text: string, size: number, w: number, h: number, x: number, y: number, order: number,
        color: Color = Color.WHITE, outline: Color = new Color(10, 20, 40, 255), align: number = Label.HorizontalAlign.CENTER): Label {
        const n = this.makeNode('Text', parent, x, y, w, h);
        const label = n.addComponent(Label);
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = true;
        if (this.pm?.font) {
            label.useSystemFont = false;
            label.font = this.pm.font;
        }
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        label.color = color;
        label.isBold = true;
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = outline;
        label.outlineWidth = Math.max(2, Math.round(size / 10));
        n.getComponent(UITransform)!.setContentSize(w, h);
        n.addComponent(Sorting2D).sortingOrder = order;
        return label;
    }

    // ---------- Botao que abre a janela ----------

    public createOpenButton(parent: Node, x: number, y: number, order: number, size: number = 110): Node | null {
        const pm = this.pm;
        if (!pm) return null;
        const node = this.makeNode('RankingButton', parent, x, y, size, size);
        this.makeSprite(node, pm.holderFrame, order);
        const iconNode = this.makeNode('Icon', node, 0, 3, size * 0.66, size * 0.66);
        const icon = iconNode.addComponent(Sprite);
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.spriteFrame = this.openIcon || this.starFrame;
        iconNode.addComponent(Sorting2D).sortingOrder = order + 1;
        this.makeLabel(node, 'RANKING', 16, size + 20, 22, 0, -size * 0.58, order + 2);

        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.92, 0.92, 1));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); this.openWindow(); });
        return node;
    }

    // ---------- Janela ----------

    public openWindow() {
        // Quem ainda nao escolheu apelido escolhe antes de ver o ranking.
        if (this.NeedsProfile() && !this.profileRoot?.active) {
            this.PromptProfile(() => this.openWindow());
            return;
        }
        if (!this.windowRoot) this.buildWindow();
        const root = this.windowRoot!;
        root.active = true;
        const parent = root.parent;
        if (parent) root.setSiblingIndex(parent.children.length - 1);
        this.scroll = 0;
        this.velocity = 0;
        this.setScroll(0);
        root.setScale(0.85, 0.85, 1);
        Tween.stopAllByTarget(root);
        tween(root).to(0.2, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        this.refresh(false);
    }

    public closeWindow() {
        if (this.windowRoot) this.windowRoot.active = false;
    }

    private buildWindow() {
        const pm = this.pm!;
        const base = pm.windowSortingBase;
        const root = this.makeNode('RankingWindow', this.node.parent || this.node, 0, 0, 1280, 720);
        this.windowRoot = root;

        const dim = this.makeNode('Dim', root, 0, 0, 1400, 800);
        this.makeSprite(dim, pm.dimFrame, base).color = new Color(0, 0, 0, 190);
        dim.on(Node.EventType.TOUCH_END, () => { });

        const W = 1000, H = 600;
        const win = this.makeNode('Window', root, 0, 0, W, H);
        this.makeSprite(win, pm.windowFrame, base + 1, true);
        this.makeLabel(win, 'RANKING', 46, 400, 60, 0, H / 2 - 62, base + 3, Color.WHITE, new Color(20, 70, 120, 255));
        this.myRankLabel = this.makeLabel(win, '', 24, 600, 32, 0, H / 2 - 112, base + 3, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));

        const close = this.makeNode('Close', win, W / 2 - 78, H / 2 - 62, 64, 56);
        this.makeSprite(close, pm.buttonFrame, base + 3, true).color = new Color(255, 120, 120, 255);
        this.makeLabel(close, 'X', 26, 50, 40, 0, 3, base + 4);
        close.on(Node.EventType.TOUCH_END, () => this.closeWindow());

        const prof = this.makeNode('Profile', win, -W / 2 + 120, H / 2 - 62, 150, 52);
        this.makeSprite(prof, pm.buttonFrame, base + 3, true);
        this.makeLabel(prof, 'PROFILE', 24, 130, 36, 0, 3, base + 4);
        prof.on(Node.EventType.TOUCH_END, () => this.PromptProfile(() => this.refresh(true)));

        const viewport = this.makeNode('Viewport', win, 0, -52, this.viewportWidth, this.viewportHeight);
        this.content = this.makeNode('Content', viewport, 0, 0, this.viewportWidth, this.viewportHeight);
        this.statusLabel = this.makeLabel(win, '', 30, 700, 120, 0, -40, base + 4);

        viewport.on(Node.EventType.TOUCH_START, (e: any) => { this.dragging = true; this.velocity = 0; this.lastY = e.getUILocation().y; this.lastMove = performance.now(); });
        viewport.on(Node.EventType.TOUCH_MOVE, (e: any) => {
            if (!this.dragging) return;
            const y = e.getUILocation().y;
            const dy = y - this.lastY;
            this.lastY = y;
            this.setScroll(this.scroll + dy);
            const now = performance.now();
            const dt = Math.max((now - this.lastMove) / 1000, 0.004);
            this.lastMove = now;
            this.velocity = this.velocity * 0.4 + Math.max(-4000, Math.min(4000, dy / dt)) * 0.6;
        });
        const end = () => { this.dragging = false; if (performance.now() - this.lastMove > 80) this.velocity = 0; };
        viewport.on(Node.EventType.TOUCH_END, end);
        viewport.on(Node.EventType.TOUCH_CANCEL, end);
        viewport.on(Node.EventType.MOUSE_WHEEL, (e: any) => { this.velocity = 0; this.setScroll(this.scroll - (e.getScrollY() || 0)); });

        root.active = false;
    }

    private showStatus(text: string) {
        if (this.statusLabel) this.statusLabel.string = text;
        if (text && this.myRankLabel) this.myRankLabel.string = '';
    }

    private clearRows() {
        this.rows.forEach(r => r.node.destroy());
        this.rows = [];
    }

    private buildRows() {
        this.clearRows();
        const pm = this.pm;
        if (!pm || !this.content) return;
        const base = pm.windowSortingBase;
        const rw = this.viewportWidth - 40, rh = this.rowHeight;
        const medal = [new Color(255, 214, 51, 255), new Color(220, 226, 235, 255), new Color(230, 150, 80, 255)];

        this.entries.forEach((e, i) => {
            const y = this.viewportHeight / 2 - rh / 2 - i * (rh + this.rowGap);
            const row = this.makeNode(`Row_${i}`, this.content!, 0, y, rw, rh);
            row.addComponent(UIOpacity);
            const mine = e.id === this.state.id;
            const bg = this.makeSprite(row, pm.pointsFrame, base + 2, true);
            bg.color = mine ? new Color(120, 255, 150, 255) : Color.WHITE;

            const rankColor = i < 3 ? medal[i] : Color.WHITE;
            this.makeLabel(row, `#${i + 1}`, 32, 110, 40, -rw / 2 + 80, 2, base + 4, rankColor, new Color(20, 20, 40, 255));
            this.makeLabel(row, mine ? `${e.name} (you)` : e.name, 28, 420, 36, -60, 2, base + 4, mine ? new Color(160, 255, 180, 255) : Color.WHITE,
                new Color(10, 20, 40, 255), Label.HorizontalAlign.LEFT);

            const starIcon = this.makeNode('Star', row, rw / 2 - 150, 2, 40, 40);
            const s = starIcon.addComponent(Sprite);
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            s.spriteFrame = this.starFrame;
            starIcon.addComponent(Sorting2D).sortingOrder = base + 4;
            this.makeLabel(row, `${e.stars}`, 32, 100, 40, rw / 2 - 70, 2, base + 4, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));

            this.rows.push({ node: row });
        });
        this.setScroll(this.scroll);
    }

    // ---------- Perfil: apelido + login da Poki ----------

    /** Ainda nao escolheu apelido (nem entrou com a conta da Poki)? */
    public NeedsProfile(): boolean {
        return !this.state.named;
    }

    /**
     * Janela de apelido (campo de texto HTML por cima do jogo, pois o EditBox do Cocos nao esta no build) e, se as
     * contas da Poki estiverem disponiveis, botao de login. `onDone` roda ao confirmar.
     */
    public PromptProfile(onDone?: () => void) {
        this.profileDone = onDone || null;
        PokiService.getUser().then(info => {
            this.accountsAvailable = info.available;
            this.user = info.user;
            this.showProfile();
        });
    }

    private showProfile() {
        const pm = this.pm;
        if (!pm) { this.finishProfile(); return; }
        if (!this.profileRoot) this.buildProfile();
        const root = this.profileRoot!;
        const parent = root.parent;
        root.active = true;
        if (parent) root.setSiblingIndex(parent.children.length - 1);

        if (this.profileInfo) {
            this.profileInfo.string = this.user ? `Logged in as ${this.user.username}` : 'Save your progress on any device';
        }
        if (this.loginButton) this.loginButton.active = this.accountsAvailable && !this.user;

        root.setScale(0.85, 0.85, 1);
        Tween.stopAllByTarget(root);
        tween(root).to(0.2, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        this.createInput(this.state.name || '');
    }

    private buildProfile() {
        const pm = this.pm!;
        const base = pm.windowSortingBase + 30;
        const root = this.makeNode('ProfileWindow', this.node.parent || this.node, 0, 0, 1280, 720);
        this.profileRoot = root;

        const dim = this.makeNode('Dim', root, 0, 0, 1400, 800);
        this.makeSprite(dim, pm.dimFrame, base).color = new Color(0, 0, 0, 200);
        dim.on(Node.EventType.TOUCH_END, () => { });

        const win = this.makeNode('Window', root, 0, 0, 640, 520);
        this.makeSprite(win, pm.windowFrame, base + 1, true);
        this.makeLabel(win, 'WELCOME!', 50, 520, 64, 0, 200, base + 3, Color.WHITE, new Color(20, 70, 120, 255));
        this.makeLabel(win, 'Choose your nickname', 30, 520, 40, 0, 135, base + 3, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));

        // (o campo de texto HTML fica em y = +60 no sistema de coordenadas do jogo)
        const hint = this.makeLabel(win, 'Shown in the ranking', 20, 460, 28, 0, 20, base + 3, new Color(200, 210, 235, 255));
        hint.node.name = 'Hint';
        this.profileHint = hint;

        this.profileInfo = this.makeLabel(win, '', 24, 560, 34, 0, -50, base + 3, Color.WHITE);

        const login = this.makeNode('Login', win, 0, -110, 360, 62);
        this.makeSprite(login, pm.buttonFrame, base + 3, true).color = new Color(255, 190, 70, 255);
        this.makeLabel(login, 'LOGIN WITH POKI', 28, 330, 42, 0, 3, base + 4);
        login.on(Node.EventType.TOUCH_END, () => this.onLoginTap());
        this.loginButton = login;

        const ok = this.makeNode('Ok', win, 0, -195, 260, 70);
        this.makeSprite(ok, pm.buttonFrame, base + 3, true);
        this.makeLabel(ok, 'OK', 40, 220, 50, 0, 3, base + 4);
        ok.on(Node.EventType.TOUCH_END, () => this.confirmProfile());

        root.active = false;
    }

    private onLoginTap() {
        this.commitName(false);
        PokiService.login().then(ok => {
            // Se der certo a pagina recarrega sozinha; aqui so tratamos o cancelamento.
            if (!ok) PowerupManager.instance?.showToast('Login cancelled');
        });
    }

    private commitName(markNamed: boolean) {
        const clean = this.sanitize(this.inputEl ? this.inputEl.value : '');
        const raw = this.inputEl ? this.inputEl.value : '';
        if (clean && !isProfane(clean) && !isProfane(raw)) this.state.name = clean;
        if (markNamed) this.state.named = true;
        this.saveState();
    }

    /** Apelido aceito? (nao vazio e sem palavrao). Mostra o aviso e devolve false se for recusado. */
    public isNameAllowed(name: string): boolean {
        const clean = this.sanitize(name);
        // Confere o texto digitado E o limpo (sanitize remove simbolos como ! e @ usados para disfarcar palavroes).
        return clean.length > 0 && !isProfane(name) && !isProfane(clean);
    }

    private confirmProfile() {
        const typed = this.inputEl ? this.inputEl.value : '';
        if (this.sanitize(typed) && (isProfane(typed) || isProfane(this.sanitize(typed)))) {
            // O aviso fica dentro da janela (um toast ficaria atras dela).
            if (this.profileHint) {
                this.profileHint.string = 'Please choose another nickname';
                this.profileHint.color = new Color(255, 90, 80, 255);
            }
            this.inputEl?.focus();
            return;
        }
        this.commitName(true);
        this.SyncScore();
        this.finishProfile();
    }

    private finishProfile() {
        this.destroyInput();
        if (this.profileRoot) this.profileRoot.active = false;
        const done = this.profileDone;
        this.profileDone = null;
        if (done) done();
    }

    // Campo de texto HTML posicionado sobre o canvas.
    private createInput(value: string) {
        this.destroyInput();
        try {
            const el = document.createElement('input');
            el.type = 'text';
            el.maxLength = 14;
            el.value = value;
            el.placeholder = 'Nickname';
            el.autocomplete = 'off';
            el.spellcheck = false;
            el.style.cssText = 'position:fixed;z-index:9999;box-sizing:border-box;text-align:center;font-weight:bold;'
                + 'border:3px solid #e0a030;border-radius:14px;background:#10163a;color:#fff;outline:none;';
            el.addEventListener('input', () => {
                if (this.profileHint) {
                    this.profileHint.string = 'Shown in the ranking';
                    this.profileHint.color = new Color(200, 210, 235, 255);
                }
            });
            el.addEventListener('keydown', ev => {
                ev.stopPropagation();
                if (ev.key === 'Enter') this.confirmProfile();
            });
            document.body.appendChild(el);
            this.inputEl = el;
            this.placeInput();
            window.addEventListener('resize', this.placeInput);
            setTimeout(() => el.focus(), 50);
        } catch (e) { }
    }

    private placeInput = () => {
        const el = this.inputEl;
        const canvas = game.canvas as HTMLCanvasElement | null;
        if (!el || !canvas) return;
        const r = canvas.getBoundingClientRect();
        const sx = r.width / 1280, sy = r.height / 720;
        const w = 420, h = 64, y = 75; // centro do campo em coordenadas do jogo (y para cima)
        el.style.width = `${w * sx}px`;
        el.style.height = `${h * sy}px`;
        el.style.left = `${r.left + r.width / 2 - (w * sx) / 2}px`;
        el.style.top = `${r.top + r.height / 2 - y * sy - (h * sy) / 2}px`;
        el.style.fontSize = `${h * sy * 0.5}px`;
    };

    private destroyInput() {
        window.removeEventListener('resize', this.placeInput);
        if (this.inputEl && this.inputEl.parentNode) this.inputEl.parentNode.removeChild(this.inputEl);
        this.inputEl = null;
    }

    // ---------- Scroll (linhas fora da area visivel esmaecem/somem: o modulo Mask nao esta no build) ----------

    private get maxScroll(): number {
        const total = this.entries.length * (this.rowHeight + this.rowGap) - this.rowGap;
        return Math.max(0, total - this.viewportHeight);
    }

    private setScroll(value: number) {
        this.scroll = Math.max(0, Math.min(this.maxScroll, value));
        if (this.content) this.content.setPosition(0, this.scroll, 0);
        const rh = this.rowHeight, half = this.viewportHeight / 2;
        for (const r of this.rows) {
            const centerY = r.node.position.y + this.scroll;
            const overlap = Math.min(centerY + rh / 2, half) - Math.max(centerY - rh / 2, -half);
            const fraction = Math.max(0, Math.min(1, overlap / rh));
            const visible = fraction >= 0.6;
            if (r.node.active !== visible) r.node.active = visible;
            if (visible) {
                const op = r.node.getComponent(UIOpacity);
                if (op) op.opacity = fraction >= 0.999 ? 255 : Math.round(90 + 165 * (fraction - 0.6) / 0.4);
            }
        }
    }
}
