import { I18n } from './I18n';
import { _decorator, Component, AudioClip, AudioSource, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Efeitos sonoros globais de UI (moedas, notificacoes). Usa um AudioSource proprio, entao o PokiService o silencia
 * junto com os demais durante anuncios. Cada som tem um intervalo minimo para nao acumular toques simultaneos.
 */
@ccclass('SoundManager')
export class SoundManager extends Component {
    public static instance: SoundManager | null = null;

    @property({ type: AudioClip, tooltip: 'Som de coleta: toca quando moedas chegam ao saldo.' })
    public coinClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Som de notificacao: toca ao desbloquear conquistas (uma vez por vez).' })
    public notificationClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de moedas.' })
    public coinVolume: number = 0.7;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de notificacao.' })
    public notificationVolume: number = 0.9;

    @property({ tooltip: 'Intervalo minimo (s) entre dois sons de moeda (muitas moedas chegam quase juntas).' })
    public coinMinInterval: number = 0.07;

    @property({ tooltip: 'Intervalo minimo (s) entre dois sons de notificacao (varias conquistas ao mesmo tempo).' })
    public notificationMinInterval: number = 1.5;

    @property({ type: AudioClip, tooltip: 'Alarme em loop enquanto o timer esta na contagem final.' })
    public alarmClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Som do item encaixando na prateleira.' })
    public attachClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Som do power-up que reduz todos os pedidos para 1 unidade por item.' })
    public dropToOneClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Clique de botao de menu.' })
    public menuClickClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Abrir ou fechar uma janela/menu.' })
    public openMenuClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Clique bloqueado (nivel fechado, moedas insuficientes, prateleira cheia...).' })
    public blockedClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Tempo adicionado ao contador (bonus de pedido, +15s, revive).' })
    public timeIncreasingClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de tempo adicionado.' })
    public timeIncreasingVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Congelar tempo/pedidos (power-ups Freeze Time e Freeze Orders).' })
    public timeClockClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de congelar.' })
    public timeClockVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Combo mudou: subiu de nivel, comecou ou foi perdido.' })
    public comboChangedClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de combo.' })
    public comboChangedVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Voz da comemoracao NICE! (combo rapido).' })
    public celebrationNiceClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Voz da comemoracao GREAT! (combo rapido).' })
    public celebrationGreatClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Voz da comemoracao AWESOME! (combo rapido).' })
    public celebrationAwesomeClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Voz da comemoracao AMAZING! (combo rapido).' })
    public celebrationAmazingClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Voz da comemoracao UNSTOPPABLE! (combo rapido).' })
    public celebrationUnstoppableClip: AudioClip | null = null;

    @property({ type: AudioClip, tooltip: 'Voz da comemoracao LEGENDARY! (combo rapido).' })
    public celebrationLegendaryClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume das vozes de comemoracao de combo rapido.' })
    public celebrationVolume: number = 0.9;

    @property({ type: [AudioClip], tooltip: 'Voz do anuncio da refeicao em INGLES: [0] Breakfast time, [1] Lunch time, [2] Dinner time.' })
    public mealClips: AudioClip[] = [];
    @property({ type: [AudioClip], tooltip: 'Anuncio da refeicao em PORTUGUES (mesma ordem: cafe, almoco, janta). Vazio = usa o ingles.' })
    public mealClipsPt: AudioClip[] = [];
    @property({ type: [AudioClip], tooltip: 'Anuncio da refeicao em ESPANHOL (cafe, almoco, janta). Vazio = usa o ingles.' })
    public mealClipsEs: AudioClip[] = [];
    @property({ type: [AudioClip], tooltip: 'Anuncio da refeicao em ALEMAO (cafe, almoco, janta). Vazio = usa o ingles.' })
    public mealClipsDe: AudioClip[] = [];

    @property({ type: [AudioClip], tooltip: 'Vozes dos combos em PORTUGUES: NICE, GREAT, AWESOME, AMAZING, UNSTOPPABLE, LEGENDARY (nessa ordem). Vazio = ingles.' })
    public celebrationClipsPt: AudioClip[] = [];
    @property({ type: [AudioClip], tooltip: 'Vozes dos combos em ESPANHOL (mesma ordem). Vazio = ingles.' })
    public celebrationClipsEs: AudioClip[] = [];
    @property({ type: [AudioClip], tooltip: 'Vozes dos combos em ALEMAO (mesma ordem). Vazio = ingles.' })
    public celebrationClipsDe: AudioClip[] = [];

    @property({ type: AudioClip, tooltip: 'Ativacao do Golden Time (toca com a explosao dourada).' })
    public goldenTimeClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som do Golden Time.' })
    public goldenTimeVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Alimentos virando moedas / moedas voltando a ser alimentos (Golden Time).' })
    public coinSwitchClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de troca alimento <-> moeda.' })
    public coinSwitchVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Raio aparece no tabuleiro (ativo).' })
    public rayEnabledClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som do raio ativo.' })
    public rayEnabledVolume: number = 0.29;

    @property({ type: AudioClip, tooltip: 'O raio acerta um elemento e o seleciona.' })
    public raySelectClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som do raio selecionando um elemento (o arquivo ja foi amplificado em +50%).' })
    public raySelectVolume: number = 1;

    @property({ type: AudioClip, tooltip: 'Item da prateleira devolvido ao tabuleiro.' })
    public removedFromSelectedClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de item devolvido.' })
    public removedFromSelectedVolume: number = 0.8;

    @property({ type: AudioClip, tooltip: 'Pedido entregue com atraso (entrega sem sucesso).' })
    public badResultOrderClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de entrega sem sucesso.' })
    public badResultOrderVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Sucesso: pedido no prazo e gasto de moedas.' })
    public successOrderClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de sucesso.' })
    public successOrderVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Estrelas da vitoria aparecendo (uma por estrela).' })
    public starsWonClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de estrela.' })
    public starsWonVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Apelido proibido recusado.' })
    public badNameClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de apelido proibido.' })
    public badNameVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Avancar um passo do tutorial.' })
    public tutorialStepClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de passo do tutorial.' })
    public tutorialStepVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Power-up Auto Select.' })
    public autoSelectClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do Auto Select.' })
    public autoSelectVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Power-up Double Coins.' })
    public doubleCoinsClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do Double Coins.' })
    public doubleCoinsVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Power-up Focus: batimento durante o efeito.' })
    public heartBeatClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do batimento do Focus.' })
    public heartBeatVolume: number = 0.9;

    @property({ type: AudioClip, tooltip: 'Tempo descontado do contador (pedido entregue com atraso).' })
    public reducingTimeClip: AudioClip | null = null;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de tempo reduzido.' })
    public reducingTimeVolume: number = 0.9;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do clique bloqueado.' })
    public blockedVolume: number = 0.8;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do clique de menu.' })
    public menuClickVolume: number = 0.8;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume de abrir/fechar menu.' })
    public openMenuVolume: number = 0.8;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do alarme do timer.' })
    public alarmVolume: number = 0.6;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de encaixe na prateleira.' })
    public attachVolume: number = 0.6;

    @property({ range: [0, 1, 0.05], tooltip: 'Volume do som de reduzir pedidos.' })
    public dropToOneVolume: number = 0.9;

    private source: AudioSource | null = null;
    private alarmSource: AudioSource | null = null;
    private heartSource: AudioSource | null = null;
    private lastPlayed: Map<string, number> = new Map();

    onLoad() {
        SoundManager.instance = this;
        this.source = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this.source.playOnAwake = false;
        this.source.loop = false;
        // O alarme precisa de um AudioSource separado (loop) para nao ser cortado pelos efeitos pontuais.
        const alarmNode = new Node('AlarmLoop');
        alarmNode.parent = this.node;
        this.alarmSource = alarmNode.addComponent(AudioSource);
        this.alarmSource.playOnAwake = false;
        this.alarmSource.loop = true;
        // Batimento do Focus: AudioSource proprio para poder ser interrompido quando o efeito termina.
        const heartNode = new Node('HeartBeat');
        heartNode.parent = this.node;
        this.heartSource = heartNode.addComponent(AudioSource);
        this.heartSource.playOnAwake = false;
        this.heartSource.loop = false;
    }

    onDestroy() {
        if (SoundManager.instance === this) SoundManager.instance = null;
    }

    public static playCoin() {
        const sm = SoundManager.instance;
        if (sm) sm.play('coin', sm.coinClip, sm.coinVolume, sm.coinMinInterval);
    }

    public static playNotification() {
        const sm = SoundManager.instance;
        if (sm) sm.play('notification', sm.notificationClip, sm.notificationVolume, sm.notificationMinInterval);
    }

    public static playMenuClick() {
        const sm = SoundManager.instance;
        if (sm) sm.play('menuClick', sm.menuClickClip, sm.menuClickVolume, 0.08);
    }

    public static playTimeIncreasing() {
        const sm = SoundManager.instance;
        if (sm) sm.play('timeIncreasing', sm.timeIncreasingClip, sm.timeIncreasingVolume, 0.25);
    }

    public static playTimeClock() {
        const sm = SoundManager.instance;
        if (sm) sm.play('timeClock', sm.timeClockClip, sm.timeClockVolume, 0.3);
    }

    public static playComboChanged() {
        const sm = SoundManager.instance;
        if (sm) sm.play('comboChanged', sm.comboChangedClip, sm.comboChangedVolume, 0.2);
    }

    public static playGoldenTime() {
        const sm = SoundManager.instance;
        if (sm) sm.play('goldenTime', sm.goldenTimeClip, sm.goldenTimeVolume, 1);
    }

    public static playRayEnabled() {
        const sm = SoundManager.instance;
        if (sm) sm.play('rayEnabled', sm.rayEnabledClip, sm.rayEnabledVolume, 0.5);
    }

    public static playRaySelect() {
        const sm = SoundManager.instance;
        if (sm) sm.play('raySelect', sm.raySelectClip, sm.raySelectVolume, 0.05);
    }

    public static playCoinSwitch() {
        const sm = SoundManager.instance;
        if (sm) sm.play('coinSwitch', sm.coinSwitchClip, sm.coinSwitchVolume, 0.3);
    }

    /** Voz do degrau de comemoracao (0 = NICE ... 5 = LEGENDARY). */
    public static playCelebration(tier: number) {
        const sm = SoundManager.instance;
        if (!sm) return;
        const clips = [sm.celebrationNiceClip, sm.celebrationGreatClip, sm.celebrationAwesomeClip,
            sm.celebrationAmazingClip, sm.celebrationUnstoppableClip, sm.celebrationLegendaryClip];
        const i = Math.max(0, Math.min(clips.length - 1, tier));
        const local = sm.langClips(sm.celebrationClipsPt, sm.celebrationClipsEs, sm.celebrationClipsDe)[i];
        sm.play('celebration', local || clips[i], sm.celebrationVolume, 0.3);
    }

    /** Voz do anuncio da refeicao (0 = cafe, 1 = almoco, 2 = janta) no idioma do jogo (cai no ingles). */
    public static playMeal(meal: number) {
        const sm = SoundManager.instance;
        if (!sm) return;
        const local = sm.langClips(sm.mealClipsPt, sm.mealClipsEs, sm.mealClipsDe)[meal];
        sm.play('meal', local || sm.mealClips[meal] || null, sm.celebrationVolume, 0.5);
    }

    private langClips(pt: AudioClip[], es: AudioClip[], de: AudioClip[]): AudioClip[] {
        switch (I18n.lang) {
            case 'pt': return pt;
            case 'es': return es;
            case 'de': return de;
            default: return [];
        }
    }

    public static playRemovedFromSelected() {
        const sm = SoundManager.instance;
        if (sm) sm.play('removedFromSelected', sm.removedFromSelectedClip, sm.removedFromSelectedVolume, 0.08);
    }

    public static playBadResultOrder() {
        const sm = SoundManager.instance;
        if (sm) sm.play('badResultOrder', sm.badResultOrderClip, sm.badResultOrderVolume, 0.2);
    }

    public static playSuccessOrder() {
        const sm = SoundManager.instance;
        if (sm) sm.play('successOrder', sm.successOrderClip, sm.successOrderVolume, 0.1);
    }

    public static playStarsWon() {
        const sm = SoundManager.instance;
        if (sm) sm.play('starsWon', sm.starsWonClip, sm.starsWonVolume, 0.1);
    }

    public static playBadName() {
        const sm = SoundManager.instance;
        if (sm) sm.play('badName', sm.badNameClip, sm.badNameVolume, 0.3);
    }

    public static playTutorialStep() {
        const sm = SoundManager.instance;
        if (sm) sm.play('tutorialStep', sm.tutorialStepClip, sm.tutorialStepVolume, 0.15);
    }

    public static playAutoSelect() {
        const sm = SoundManager.instance;
        if (sm) sm.play('autoSelect', sm.autoSelectClip, sm.autoSelectVolume, 0.3);
    }

    public static playDoubleCoins() {
        const sm = SoundManager.instance;
        if (sm) sm.play('doubleCoins', sm.doubleCoinsClip, sm.doubleCoinsVolume, 0.3);
    }

    /** Liga/desliga o batimento do Focus. Ligar reinicia o som. */
    public static setHeartBeat(on: boolean) {
        const sm = SoundManager.instance;
        const a = sm?.heartSource;
        if (!sm || !a || !sm.heartBeatClip) return;
        try {
            if (on) {
                a.stop();
                a.clip = sm.heartBeatClip;
                a.volume = sm.heartBeatVolume;
                a.play();
            } else if (a.playing) {
                a.stop();
            }
        } catch (e) { /* sem som */ }
    }

    public static playReducingTime() {
        const sm = SoundManager.instance;
        if (sm) sm.play('reducingTime', sm.reducingTimeClip, sm.reducingTimeVolume, 0.25);
    }

    public static playBlocked() {
        const sm = SoundManager.instance;
        if (sm) sm.play('blocked', sm.blockedClip, sm.blockedVolume, 0.15);
    }

    public static playOpenMenu() {
        const sm = SoundManager.instance;
        if (sm) sm.play('openMenu', sm.openMenuClip, sm.openMenuVolume, 0.15);
    }

    public static playAttach() {
        const sm = SoundManager.instance;
        if (sm) sm.play('attach', sm.attachClip, sm.attachVolume, 0.05);
    }

    public static playDropToOne() {
        const sm = SoundManager.instance;
        if (sm) sm.play('dropToOne', sm.dropToOneClip, sm.dropToOneVolume, 0.3);
    }

    /** Liga/desliga o alarme em loop (idempotente: pode ser chamado a cada frame). */
    public static setAlarm(on: boolean) {
        const sm = SoundManager.instance;
        if (sm) sm.applyAlarm(on);
    }

    private applyAlarm(on: boolean) {
        const a = this.alarmSource;
        if (!a || !this.alarmClip) return;
        try {
            if (on) {
                if (a.playing) return;
                a.clip = this.alarmClip;
                a.volume = this.alarmVolume;
                a.play();
            } else if (a.playing) {
                a.stop();
            }
        } catch (e) { /* sem som */ }
    }

    private play(key: string, clip: AudioClip | null, volume: number, minInterval: number) {
        if (!this.source || !clip) return;
        const now = performance.now() / 1000;
        const last = this.lastPlayed.get(key);
        if (last !== undefined && now - last < minInterval) return;
        this.lastPlayed.set(key, now);
        // Audio nunca pode quebrar o jogo (ex.: navegadores de celular com o audio ainda bloqueado): erros sao ignorados.
        try {
            const r: any = this.source.playOneShot(clip, volume);
            if (r && typeof r.catch === 'function') r.catch(() => { });
        } catch (e) { /* sem som */ }
    }
}
