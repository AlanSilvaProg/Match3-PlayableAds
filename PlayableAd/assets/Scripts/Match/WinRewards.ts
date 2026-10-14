import { Button, instantiate, Label, Node, Sprite, Sorting2D, tween, UITransform, Vec3, Color, Tween } from 'cc';
import { GameManager } from './GameManager';
import { PowerupManager } from './PowerupManager';
import { PokiService } from './PokiService';
import { PlayerWallet } from './PlayerInventory';
import { PlayerStats, AchievementMetric } from './PlayerStats';
import { SoundManager } from './SoundManager';
import { RestartGame } from './RestartGame';
import { ReturnToLevels } from './ReturnToLevels';
import { ScaleSequence } from './ScaleSequence';
import { Responsive } from './Responsive';
import { RankingManager } from './RankingManager';

/**
 * Tela de vitoria: o botao RESTART vira NEXT (proximo nivel direto), as moedas da rodada aparecem abaixo das estrelas
 * e um botao vermelho (anuncio com recompensa) dobra essas moedas. Montado em codigo sobre o prefab WinnerScreen.
 */
export class WinRewards {
    /** Escala dos botoes da tela de vitoria (0,72 anterior menos 10%). */
    private static readonly BUTTON_SCALE = 0.648;
    private static readonly FAIL_BUTTON_SCALE = 0.9;
    private static readonly GOLD = new Color(255, 214, 51, 255);

    public static setup(screen: Node, levelsOnly: boolean = false) {
        const nextBtn = screen.getChildByName('RestartBtn');
        const levelsBtn = screen.getChildByName('LevelsBtn');
        const pm = PowerupManager.instance;
        if (!nextBtn || !levelsBtn) return;

        // Os botoes entram com animacao propria (o ScaleSequence do prefab animaria todos para escala 1).
        const seq = screen.getComponent(ScaleSequence);
        if (seq) seq.nodes = seq.nodes.filter(n => n !== nextBtn && n !== levelsBtn);

        // ---- NEXT (ou RESTART se o proximo nivel ainda esta bloqueado) ----
        const next = nextBtn.getComponent(RestartGame);
        const nextButton = nextBtn.getComponent(Button);
        const selector = GameManager.instance?.levelSelector?.getComponent('LevelSelector') as any;
        const nextUnlocked = !!selector && selector.isUnlocked(GameManager.currentLevel + 1);
        const nextLabel = nextBtn.getComponentInChildren(Label);
        if (nextLabel) nextLabel.string = nextUnlocked ? 'NEXT' : 'RESTART';
        if (nextButton) nextButton.clickEvents = [];
        nextBtn.on(Button.EventType.CLICK, () => next?.NextLevel());

        // ---- Moedas da rodada + dobrar ----
        const coins = Math.max(0, Math.round(GameManager.lastRoundCoins));
        const row = new Node('CoinsRow');
        row.layer = screen.layer;
        row.parent = screen;
        row.addComponent(UITransform).setContentSize(360, 70);
        const rowLabel = this.makeLabel(screen, levelsBtn, row, `+${coins}`, 52, 230, 66, 34, 0);
        rowLabel.color = this.GOLD;
        if (pm && pm.coinFrame) {
            const icon = new Node('Coin');
            icon.layer = screen.layer;
            icon.parent = row;
            icon.setPosition(-80, 0, 0);
            icon.addComponent(UITransform).setContentSize(92, 92);
            const sp = icon.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = pm.coinFrame; // o mesmo icone de moeda da gameplay
            sp.trim = false;
            const so = icon.addComponent(Sorting2D);
            so.sortingLayer = 1;
            so.sortingOrder = 2;
        }

        // Apos o tutorial so resta o botao LEVELS: o jogador vai ao menu de selecao de fases.
        if (levelsOnly) nextBtn.active = false;

        let doubleBtn: Node | null = null;
        if (coins > 0 && !levelsOnly) {
            doubleBtn = instantiate(levelsBtn);
            doubleBtn.name = 'DoubleBtn';
            doubleBtn.parent = screen;
            doubleBtn.getComponent(ReturnToLevels)?.destroy();
            const btn = doubleBtn.getComponent(Button);
            if (btn) btn.clickEvents = [];
            const sprite = doubleBtn.getComponent(Sprite);
            const label = doubleBtn.getComponentInChildren(Label);
            if (label) {
                label.string = 'x2 COINS';
                label.node.setPosition(-45, label.node.position.y, 0);
                label.node.getComponent(UITransform)?.setContentSize(220, 110);
            }
            if (pm && pm.adFrame) {
                const iconNode = new Node('AdIcon');
                iconNode.layer = screen.layer;
                iconNode.parent = doubleBtn;
                iconNode.setPosition(120, 0, 0);
                iconNode.addComponent(UITransform).setContentSize(62, 62);
                const sp = iconNode.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = pm.adFrame;
                const so = iconNode.addComponent(Sorting2D);
                so.sortingLayer = 1;
                so.sortingOrder = 2;
            }
            let used = false;
            const onDouble = () => {
                if (used) return;
                if (RankingManager.gate(onDouble)) return; // 1o fim de rodada: pede o login antes
                SoundManager.playMenuClick();
                PokiService.rewardedBreak().then(ok => {
                    if (!ok || used || !screen.isValid) return; // sem anuncio/recompensa: nada acontece
                    used = true;
                    PlayerWallet.addPoints(coins);
                    PlayerStats.increment(AchievementMetric.CoinsEarned, coins);
                    rowLabel.string = `+${coins * 2}`;
                    SoundManager.playCoin();
                    Tween.stopAllByTarget(row);
                    row.setScale(1, 1, 1);
                    tween(row).to(0.12, { scale: new Vec3(1.35, 1.35, 1) }).to(0.2, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
                    if (label) {
                        label.string = 'DOUBLED!';
                        // Sem o icone de anuncio, o texto volta ao centro do botao.
                        label.node.setPosition(0, label.node.position.y, 0);
                        label.node.getComponent(UITransform)?.setContentSize(330, 110);
                    }
                    if (btn) btn.interactable = false;
                    if (sprite) sprite.color = new Color(150, 150, 150, 255);
                    iconOff(doubleBtn!);
                });
            };
            doubleBtn.on(Button.EventType.CLICK, onDouble);
        }

        // Entrada dos botoes (depois da animacao de logo/estrelas do prefab).
        [nextBtn, doubleBtn, levelsBtn].forEach((b, i) => {
            if (!b || !b.active) return;
            b.setScale(0, 0, 1);
            tween(b).delay(0.75 + i * 0.12)
                .to(0.2, { scale: new Vec3(this.BUTTON_SCALE, this.BUTTON_SCALE, 1) }, { easing: 'backOut' })
                .start();
        });

        (screen as any).__winLayout = () => this.layout(screen);
        this.layout(screen);
    }

    /** Tela de derrota: os botoes ficam 10% menores (animam ate FAIL_BUTTON_SCALE em vez de 1). */
    public static setupFail(screen: Node) {
        const buttons = ['RestartBtn', 'ContinueBtn', 'LevelsBtn']
            .map(n => screen.getChildByName(n)).filter(n => !!n) as Node[];
        const seq = screen.getComponent(ScaleSequence);
        if (seq) seq.nodes = seq.nodes.filter(n => buttons.indexOf(n) === -1);
        buttons.forEach((b, i) => {
            b.setScale(0, 0, 1);
            tween(b).delay(0.75 + i * 0.12)
                .to(0.2, { scale: new Vec3(this.FAIL_BUTTON_SCALE, this.FAIL_BUTTON_SCALE, 1) }, { easing: 'backOut' })
                .start();
        });

        // Botao do anuncio: 1a fase = CONTINUE (segue de onde parou); 2a fase em diante = volta ao CHECKPOINT da fase.
        const gm = GameManager.instance;
        const cont = screen.getChildByName('ContinueBtn');
        const contLabel = cont?.getComponentInChildren(Label);
        if (gm && cont && contLabel && !gm.hasRevived) {
            const checkpoint = gm.phaseIndex > 0;
            contLabel.string = checkpoint ? 'CHECKPOINT' : 'CONTINUE';
            const text = checkpoint
                ? `Watch an ad to restart ${gm.checkpointMeal} from the beginning!`
                : 'Watch an ad to keep playing from where you stopped!';
            // A legenda fica logo abaixo do botao; o LEVELS desce para abrir espaco.
            const levels = screen.getChildByName('LevelsBtn');
            if (levels) levels.setPosition(levels.position.x, levels.position.y - 50, levels.position.z);
            const caption = this.makeLabel(screen, cont, screen, text, 26, 520, 64, -265, cont.position.y - 62);
            caption.node.name = 'ReviveCaption';
            caption.overflow = Label.Overflow.SHRINK;
            caption.enableWrapText = true;
            caption.color = this.GOLD;
        }
    }

    /** Coluna (esquerda em paisagem, central em retrato): estrelas, moedas, NEXT, x2 COINS, LEVELS. */
    private static layout(screen: Node) {
        if (!screen.isValid) return;
        const x = Responsive.portrait ? 0 : -265;
        const place = (name: string, y: number) => {
            const n = screen.getChildByName(name);
            if (n) n.setPosition(x, y, n.position.z);
        };
        place('CoinsRow', 15);
        if (!screen.getChildByName('RestartBtn')?.active) {
            place('LevelsBtn', -100); // so o LEVELS (apos o tutorial)
            return;
        }
        place('RestartBtn', -80);
        place('DoubleBtn', -180);
        place('LevelsBtn', -280);
    }

    /** Clona o texto de um botao existente (mesma fonte e contorno do prefab) como rotulo solto. */
    private static makeLabel(screen: Node, source: Node, parent: Node, text: string, size: number, w: number, h: number, x: number, y: number): Label {
        const srcLabel = source.getComponentInChildren(Label)!;
        const node = instantiate(srcLabel.node);
        node.name = 'Text';
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.setScale(1, 1, 1);
        node.getComponent(UITransform)?.setContentSize(w, h);
        const label = node.getComponent(Label)!;
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size;
        return label;
    }
}

function iconOff(btn: Node) {
    const icon = btn.getChildByName('AdIcon');
    if (icon) icon.active = false;
}
