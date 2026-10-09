import { director, AudioSource, Node, UITransform, BlockInputEvents, find } from 'cc';
import { PREVIEW } from 'cc/env';

/**
 * Integracao com o Poki SDK (carregado pela tag <script> do index.html: build-templates/web-mobile/index.ejs).
 * Todas as chamadas sao seguras: sem o SDK (preview local, bloqueador de anuncios, outro dominio) o jogo
 * segue normalmente e os intervalos comerciais terminam na hora.
 *
 * Fluxo usado no jogo:
 *   init -> gameLoadingFinished -> gameplayStart (ao comecar o nivel) -> gameplayStop (vitoria/derrota)
 *   -> commercialBreak (ao tocar em Restart/Levels depois de um nivel).
 */
export class PokiService {

    private static initPromise: Promise<boolean> | null = null;
    private static loadingFinished: boolean = false;
    private static playing: boolean = false;
    private static savedVolumes: Map<AudioSource, number> = new Map();

    private static get sdk(): any {
        return (globalThis as any).PokiSDK || null;
    }

    /** Inicializa o SDK uma unica vez. Resolve true se o SDK esta disponivel. */
    public static init(): Promise<boolean> {
        this.installPageGuards();
        this.installFocusTracking();
        if (this.initPromise) return this.initPromise;

        const sdk = this.sdk;
        if (!sdk) {
            this.initPromise = Promise.resolve(false);
            return this.initPromise;
        }

        this.initPromise = Promise.resolve(sdk.init())
            .then(() => true)
            .catch(() => false); // bloqueador de anuncios etc.: o jogo continua mesmo assim
        return this.initPromise;
    }

    /**
     * Espera o `init` do SDK (que injeta o save da nuvem do jogador logado), com um limite de tempo para o jogo
     * nunca ficar preso se o SDK demorar ou estiver bloqueado.
     */
    public static ready(timeoutMs: number = 2500): Promise<void> {
        return Promise.race([
            this.init().then(() => undefined),
            new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
        ]);
    }

    private static userCache: { available: boolean, user: { username: string, avatarUrl: string } | null } | null = null;

    /**
     * Contas da Poki: `available` = o recurso existe para este jogo; `user` = jogador logado (ou null).
     * (getUser lanca erro se as contas nao estao habilitadas ou o jogador optou por sair.)
     */
    public static async getUser(): Promise<{ available: boolean, user: { username: string, avatarUrl: string } | null }> {
        if (this.userCache) return this.userCache;
        const ready = await this.init();
        if (!ready || !this.sdk || typeof this.sdk.getUser !== 'function') return { available: false, user: null };
        try {
            const user = await this.sdk.getUser();
            this.userCache = { available: true, user: user || null };
        } catch (e) {
            this.userCache = { available: false, user: null };
        }
        return this.userCache;
    }

    /**
     * Abre o login da Poki. So chame a partir de um toque do jogador. Se o login der certo a pagina recarrega;
     * resolve false se o jogador fechou o painel ou demorou demais.
     */
    public static async login(): Promise<boolean> {
        if (!this.sdk || typeof this.sdk.login !== 'function') return false;
        try {
            await this.sdk.login();
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Avisa a Poki que o carregamento terminou (uma vez por sessao). */
    public static gameLoadingFinished() {
        if (this.loadingFinished) return;
        this.loadingFinished = true;
        this.init().then(ready => {
            if (ready) this.safe(() => this.sdk.gameLoadingFinished());
        });
    }

    /** O jogador comecou a jogar. */
    public static gameplayStart() {
        if (this.playing) return;
        this.playing = true;
        this.init().then(ready => {
            if (ready) this.safe(() => this.sdk.gameplayStart());
        });
    }

    /** O jogador parou de jogar (fim de nivel, menu, anuncio). */
    public static gameplayStop() {
        if (!this.playing) return;
        this.playing = false;
        this.init().then(ready => {
            if (ready) this.safe(() => this.sdk.gameplayStop());
        });
    }

    /**
     * Apenas no PREVIEW do editor do Cocos (compilado fora do build final) a recompensa e concedida direto, para os
     * recursos poderem ser testados sem anuncio. No build publicado e SEMPRE false: sem anuncio (ou com bloqueador de
     * anuncios) nao ha recompensa.
     */
    public static devRewardBypass: boolean = PREVIEW;

    /** Registrado pelo GameManager: diz se o jogador esta de fato em partida (para retomar o gameplayStart ao voltar). */
    public static isGameplayActive: (() => boolean) | null = null;

    private static focusInstalled: boolean = false;
    private static stoppedByFocus: boolean = false;

    /**
     * Preferencia da Poki: perder o foco e uma interrupcao. O jogo continua rodando (decisao do projeto), mas a Poki
     * e avisada com gameplayStop ao perder o foco e gameplayStart ao voltar (se ainda estiver em partida).
     */
    private static installFocusTracking() {
        if (this.focusInstalled) return;
        this.focusInstalled = true;
        try {
            const lost = () => {
                if (this.playing) {
                    this.stoppedByFocus = true;
                    this.gameplayStop();
                }
            };
            const back = () => {
                if (!this.stoppedByFocus) return;
                this.stoppedByFocus = false;
                if (this.isGameplayActive ? this.isGameplayActive() : true) this.gameplayStart();
            };
            document.addEventListener('visibilitychange', () => (document.hidden ? lost() : back()));
            window.addEventListener('blur', lost);
            window.addEventListener('focus', back);
        } catch (e) { }
    }

    private static guardsInstalled: boolean = false;
    private static blocker: Node | null = null;

    /**
     * Requisito da Poki: o jogo roda dentro de uma pagina que rola. Espaco, setas e a roda do mouse nao podem rolar
     * a pagina (o proprio jogo continua recebendo esses eventos).
     */
    private static installPageGuards() {
        if (this.guardsInstalled) return;
        this.guardsInstalled = true;
        try {
            window.addEventListener('keydown', ev => {
                // Campos de texto (apelido) precisam receber espaco e setas normalmente.
                const t = ev.target as HTMLElement | null;
                if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
                if (['ArrowDown', 'ArrowUp', ' '].includes(ev.key)) ev.preventDefault();
            });
            window.addEventListener('wheel', ev => ev.preventDefault(), { passive: false });
        } catch (e) { }
    }

    /** Requisito da Poki: sem input no jogo durante anuncios. Uma camada transparente por cima absorve os toques. */
    private static setInputBlocked(blocked: boolean) {
        try {
            if (!blocked) {
                if (this.blocker && this.blocker.isValid) this.blocker.destroy();
                this.blocker = null;
                return;
            }
            if (this.blocker && this.blocker.isValid) return;
            const canvas = find('GameCanvas') || find('Canvas');
            if (!canvas) return;
            const node = new Node('AdInputBlocker');
            node.layer = canvas.layer;
            node.parent = canvas;
            node.addComponent(UITransform).setContentSize(3000, 3000);
            node.addComponent(BlockInputEvents);
            node.setSiblingIndex(canvas.children.length - 1);
            this.blocker = node;
        } catch (e) { }
    }

    /** Teto de seguranca para um anuncio que nunca termina. */
    private static readonly AD_MAX_WAIT_MS = 90000;

    /**
     * Anuncios so fazem sentido dentro da Poki (o jogo roda num iframe da plataforma).
     * Em outros hospedeiros (preview local, GitHub Pages) o SDK tentaria carregar anuncios "house" e a pausa
     * demoraria sem mostrar nada; ali o jogo segue direto.
     */
    private static get adsEnabled(): boolean {
        try {
            const w: any = globalThis;
            if (w.self !== w.top) return true; // embutido pela Poki
            return /poki/i.test(w.location?.hostname || '');
        } catch (e) {
            return true; // iframe de outra origem: provavelmente a Poki
        }
    }

    /** Executa uma pausa da Poki (com silenciamento durante o anuncio). Sempre resolve. */
    private static runBreak(call: (onStart: () => void) => any): Promise<any> {
        return new Promise(resolve => {
            let finished = false;
            this.setInputBlocked(true);
            const finish = (value: any) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                this.setMuted(false);
                this.setInputBlocked(false);
                resolve(value);
            };
            const timer = setTimeout(() => finish(undefined), this.AD_MAX_WAIT_MS);

            Promise.resolve()
                .then(() => call(() => this.setMuted(true)))
                .then(result => finish(result), () => finish(undefined));
        });
    }

    /** Anuncio entre niveis. Silencia o jogo durante o anuncio. Sempre resolve. */
    public static commercialBreak(): Promise<void> {
        this.gameplayStop();
        return this.init().then(ready => {
            if (!ready || !this.adsEnabled) return;
            return this.runBreak(onStart => this.sdk.commercialBreak(onStart)).then(() => undefined);
        });
    }

    /** Anuncio com recompensa. Resolve true se o jogador assistiu ate o fim. */
    public static rewardedBreak(): Promise<boolean> {
        this.gameplayStop();
        return this.init().then(ready => {
            if (!this.sdk) return this.devRewardBypass;
            if (!ready) return false; // bloqueador de anuncios: sem anuncio, sem recompensa
            if (!this.adsEnabled) return this.devRewardBypass;
            return this.runBreak(onStart => this.sdk.rewardedBreak(onStart)).then(ok => !!ok);
        });
    }

    /** Silencia / restaura todos os AudioSource da cena durante os anuncios. */
    private static setMuted(muted: boolean) {
        const scene = director.getScene();
        if (!scene) return;
        if (muted) {
            this.savedVolumes.clear();
            scene.getComponentsInChildren(AudioSource).forEach(a => {
                this.savedVolumes.set(a, a.volume);
                a.volume = 0;
            });
        } else {
            this.savedVolumes.forEach((volume, a) => { if (a.isValid) a.volume = volume; });
            this.savedVolumes.clear();
        }
    }

    private static safe(fn: () => void) {
        try { fn(); } catch (e) { console.warn('[PokiService]', e); }
    }
}
