import { Color, Label, Node, Sorting2D, Sprite, UITransform } from 'cc';
import { tr } from './I18n';
import { UiKit } from './UiKit';
import { Haptics } from './Haptics';
import { SoundManager } from './SoundManager';
import { PowerupManager } from './PowerupManager';
import { PowerupCatalog } from './PowerupCatalog';
import { ALL_CHALLENGES_BONUS, ChallengeState, DAILY_REWARDS, DailyData, DailyReward } from './DailyData';

/**
 * Janela "Diario": presente diario em sequencia de 7 dias + 3 desafios novos por dia (e bonus por completar todos).
 * Botao no menu de niveis com bolinha vermelha quando ha premio para pegar.
 */
export class DailyWindow {
    private static win: ReturnType<typeof UiKit.windowShell> = null;
    private static content: Node | null = null;
    private static dots: Label[] = [];
    private static timerLabel: Label | null = null;
    private static clock: number = 0;

    /** Botao do menu (chamado pelo LevelSelector). */
    public static createOpenButton(parent: Node, x: number, y: number, order: number, size: number = 110): Node | null {
        const pm = PowerupManager.instance;
        const b = UiKit.menuButton(parent, 'DailyButton', x, y, order, size, pm ? pm.dailyGiftIcon : null, tr('DAILY'), () => this.open());
        if (!b) return null;
        this.dots.push(b.dot);
        this.refreshDots();
        return b.node;
    }

    public static refreshDots() {
        const n = DailyData.claimableCount();
        this.dots = this.dots.filter(l => l && l.isValid);
        this.dots.forEach(l => { l.string = `${n}`; l.node.parent!.active = n > 0; });
    }

    public static open() {
        if (!this.win) this.build();
        if (!this.win) return;
        this.render();
        this.win.open();
    }

    private static build() {
        this.win = UiKit.windowShell('DailyWindow', tr('DAILY'));
        if (!this.win) return;
        this.content = UiKit.node(this.win.win, 'Content', 0, 0, 1000, 600);
    }

    private static rewardText(r: DailyReward): string {
        const parts: string[] = [];
        if (r.coins) parts.push(`${r.coins}`);
        if (r.powerup !== undefined && r.amount) parts.push(`x${r.amount} ${PowerupCatalog.getDef(r.powerup).name}`);
        return parts.join(' + ');
    }

    /** Reconstroi o conteudo (barato: poucos nos). */
    private static render() {
        const w = this.win!, base = w.base + 4;
        this.content!.destroy();
        const c = UiKit.node(w.win, 'Content', 0, 0, 1000, 600);
        this.content = c;
        const today = DailyData.todayIndex();
        const claimedToday = !DailyData.canClaimGift();

        // ---- Sequencia de presentes (7 dias) ----
        UiKit.label(c, tr('Daily gift - day {0}', Math.max(1, DailyData.streak() + (claimedToday ? 0 : 1))), 26, 520, 34, 0, 190, base, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));
        const cellW = 118, gap = 10, total = DAILY_REWARDS.length;
        const startX = -((cellW * total + gap * (total - 1)) / 2) + cellW / 2;
        DAILY_REWARDS.forEach((r, i) => {
            const cell = UiKit.node(c, 'Day' + i, startX + i * (cellW + gap), 118, cellW, 110);
            const isToday = i === today;
            const done = claimedToday ? i <= today : i < today;
            const bg = UiKit.sprite(cell, UiKit.pm!.pointsFrame, base, true);
            bg.color = isToday && !claimedToday ? new Color(255, 214, 80, 255) : done ? new Color(70, 140, 90, 255) : new Color(255, 255, 255, 255);
            UiKit.label(cell, tr('Day {0}', i + 1), 20, cellW - 12, 24, 0, 38, base + 1, Color.WHITE, new Color(10, 20, 40, 255), false, true);
            UiKit.label(cell, r.coins ? `${r.coins}` : '', 24, cellW - 12, 28, 0, 8, base + 1, new Color(255, 226, 80, 255), new Color(110, 60, 0, 255));
            if (r.powerup !== undefined) {
                const ic = UiKit.node(cell, 'Pu', 0, r.coins ? -26 : -6, 44, 44);
                const sp = ic.addComponent(Sprite);
                PowerupCatalog.applyFitted(sp, r.powerup, 44);
                ic.addComponent(Sorting2D).sortingOrder = base + 2;
            }
            if (done) UiKit.label(cell, 'OK', 22, 60, 26, 0, -38, base + 2, new Color(140, 255, 160, 255), new Color(10, 60, 20, 255));
        });

        // ---- Botao do presente de hoje ----
        const giftBtn = UiKit.button(c, claimedToday ? tr('Come back tomorrow') : tr('CLAIM'), 0, 36, 340, 56, base, claimedToday ? new Color(110, 110, 110, 255) : Color.WHITE, () => {
            const r = DailyData.claimGift();
            if (!r) return false;
            Haptics.perfect();
            SoundManager.playCashin();
            PowerupManager.instance?.showToast(this.rewardText(r));
            PowerupManager.instance?.refreshBadges();
            this.render();
            this.refreshDots();
            return true;
        });
        void giftBtn;

        // ---- Desafios do dia ----
        UiKit.label(c, tr("Today's challenges"), 26, 520, 34, 0, -14, base, new Color(255, 230, 140, 255), new Color(40, 25, 0, 255));
        const st = DailyData.ensureToday();
        st.challenges.forEach((ch, i) => this.challengeRow(c, ch, i, -70 - i * 62, base));

        // ---- Bonus de completar tudo + reinicio ----
        const allDone = DailyData.allDone();
        const bonusText = DailyData.canClaimAllBonus() ? tr('BONUS +{0}', ALL_CHALLENGES_BONUS) : allDone ? tr('Bonus claimed') : tr('Complete all: +{0}', ALL_CHALLENGES_BONUS);
        const bonusBtn = UiKit.button(c, bonusText, -200, -262, 380, 46, base, DailyData.canClaimAllBonus() ? Color.WHITE : new Color(120, 120, 120, 255), () => {
            const n = DailyData.claimAllBonus();
            if (n <= 0) return false;
            Haptics.perfect();
            SoundManager.playPerfect();
            PowerupManager.instance?.showToast(tr('+{0} coins', n));
            PowerupManager.instance?.refreshBadges();
            this.render();
            this.refreshDots();
            return true;
        });
        void bonusBtn;
        this.timerLabel = UiKit.label(c, '', 22, 380, 30, 230, -262, base, new Color(200, 210, 235, 255), new Color(10, 20, 40, 255), false, true);
        this.updateTimer();
    }

    private static challengeRow(parent: Node, ch: ChallengeState, index: number, y: number, base: number) {
        const tpl = DailyData.template(ch.id);
        const row = UiKit.node(parent, 'Challenge' + index, 0, y, 900, 56);
        UiKit.sprite(row, UiKit.pm!.pointsFrame, base, true);
        const prog = DailyData.progress(ch);
        const done = DailyData.isDone(ch);
        const tierColors = [new Color(120, 255, 150, 255), new Color(255, 214, 80, 255), new Color(255, 120, 120, 255)];
        UiKit.label(row, tpl ? tr(tpl.text, ch.target) : ch.id, 24, 470, 30, -430, 9, base + 1, tierColors[ch.tier] || Color.WHITE, new Color(10, 20, 40, 255), true);
        // Barra de progresso
        const barW = 360, barX = -430;
        const bar = UiKit.node(row, 'Bar', barX + barW / 2, -14, barW, 12);
        UiKit.sprite(bar, UiKit.pm!.pointsFrame, base + 1, true).color = new Color(60, 70, 110, 255);
        const fill = UiKit.node(row, 'Fill', barX, -14, Math.max(1, barW * prog / ch.target), 12);
        fill.getComponent(UITransform)!.anchorX = 0;
        UiKit.sprite(fill, UiKit.pm!.pointsFrame, base + 2, true).color = new Color(90, 235, 120, 255);
        UiKit.label(row, `${prog}/${ch.target}`, 14, 90, 16, barX + barW / 2, -14, base + 3, Color.WHITE, new Color(10, 20, 40, 255), false, true);
        UiKit.label(row, `+${ch.reward}`, 26, 120, 30, 130, 0, base + 1, new Color(255, 226, 80, 255), new Color(110, 60, 0, 255));
        const label = ch.claimed ? tr('DONE') : tr('CLAIM');
        UiKit.button(row, label, 330, 0, 190, 44, base + 1, ch.claimed ? new Color(110, 110, 110, 255) : done ? Color.WHITE : new Color(110, 110, 110, 255), () => {
            const n = DailyData.claimChallenge(index);
            if (n <= 0) return false;
            Haptics.delivery();
            SoundManager.playCashin();
            PowerupManager.instance?.showToast(tr('+{0} coins', n));
            PowerupManager.instance?.refreshBadges();
            this.render();
            this.refreshDots();
            return true;
        });
    }

    private static updateTimer() {
        if (!this.timerLabel || !this.timerLabel.isValid) return;
        const s = DailyData.secondsToReset();
        const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
        this.timerLabel.string = tr('New challenges in {0}', `${hh}h ${mm < 10 ? '0' : ''}${mm}m`);
    }
}
