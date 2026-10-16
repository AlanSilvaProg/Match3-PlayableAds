import { sys } from 'cc';
import { AchievementMetric, PlayerStats } from './PlayerStats';
import { PowerupType } from './PowerupCatalog';
import { PowerupInventory, PlayerWallet } from './PlayerInventory';
import { ElementType } from './ElementType';

/** Um desafio do dia. `tiers` = [meta, premio em coins] da dificuldade 0 (facil), 1 (medio), 2 (dificil); ausente = nao existe nessa dificuldade. */
export interface ChallengeTemplate {
    id: string;
    metric: AchievementMetric;
    /** Texto em ingles (chave do I18n); {0} = meta. */
    text: string;
    tiers: ([number, number] | null)[];
}

/**
 * Banco de desafios. Para ADICIONAR um desafio basta incluir uma linha aqui (e a traducao no I18n): o sorteio do dia
 * escolhe 1 facil, 1 medio e 1 dificil entre os que nao sairam nos ultimos dias e nao repete a mesma metrica no dia.
 */
export const CHALLENGES: ChallengeTemplate[] = [
    { id: 'deliver',  metric: AchievementMetric.OrdersDelivered,   text: 'Deliver {0} orders',             tiers: [[6, 120], [14, 260], [26, 520]] },
    { id: 'ontime',   metric: AchievementMetric.OrdersOnTime,      text: 'Deliver {0} orders on time',     tiers: [[4, 130], [10, 280], [20, 560]] },
    { id: 'wins',     metric: AchievementMetric.LevelWins,         text: 'Win {0} level(s)',               tiers: [[1, 100], [3, 280], [5, 520]] },
    { id: 'picks',    metric: AchievementMetric.FoodsPicked,       text: 'Pick {0} foods',                 tiers: [[25, 100], [70, 250], [140, 480]] },
    { id: 'lines',    metric: AchievementMetric.Merges,            text: 'Complete {0} order lines',       tiers: [[8, 110], [20, 260], [40, 500]] },
    { id: 'powerups', metric: AchievementMetric.PowerupsUsed,      text: 'Use {0} power-up(s)',            tiers: [[1, 100], [3, 260], [6, 480]] },
    { id: 'perfect',  metric: AchievementMetric.PerfectDeliveries, text: 'Make {0} PERFECT deliveries',    tiers: [[2, 150], [5, 320], [10, 600]] },
    { id: 'fastcombo', metric: AchievementMetric.FastCombos,       text: 'Trigger {0} combo celebrations', tiers: [[2, 140], [5, 300], [9, 560]] },
    { id: 'coins',    metric: AchievementMetric.CoinsEarned,       text: 'Earn {0} coins in matches',      tiers: [[500, 120], [1500, 280], [3500, 540]] },
    { id: 'buy',      metric: AchievementMetric.PowerupsBought,    text: 'Buy {0} power-up(s)',            tiers: [[1, 100], null, null] },
    { id: 'threestar', metric: AchievementMetric.ThreeStarWins,    text: 'Win {0} level(s) with 3 stars',  tiers: [null, [1, 300], [2, 560]] },
    { id: 'maxcombo', metric: AchievementMetric.MaxComboReached,   text: 'Reach the max combo {0} time(s)', tiers: [null, [1, 380], [2, 620]] },
    { id: 'golden',   metric: AchievementMetric.GoldenTimes,       text: 'Trigger Golden Time',            tiers: [null, null, [1, 450]] },
];

/** Presentes da sequencia de 7 dias (repete). Um item pode ter coins e/ou power-up. */
export interface DailyReward { coins?: number; powerup?: PowerupType; amount?: number }
export const DAILY_REWARDS: DailyReward[] = [
    { coins: 150 },
    { powerup: PowerupType.TimeBonus, amount: 1 },
    { coins: 250 },
    { powerup: PowerupType.FreezeTimer, amount: 1 },
    { coins: 400 },
    { powerup: PowerupType.Highlight, amount: 2 },
    { coins: 800, powerup: PowerupType.MaxCombo, amount: 1 },
];

/** Bonus por completar os 3 desafios do dia. */
export const ALL_CHALLENGES_BONUS = 400;
const RECENT_DAYS = 5;

export interface ChallengeState { id: string; tier: number; target: number; reward: number; base: number; claimed: boolean }
interface DailyState {
    day: string;
    streak: number;
    lastClaimDay: string;
    claimedToday: boolean;
    allBonusClaimed: boolean;
    challenges: ChallengeState[];
    history: { day: string, ids: string[] }[];
}

function dayKey(offset: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seeded(seed: string): () => number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Dados do Diario: presente diario (sequencia de dias) e 3 desafios por dia. Salvos no localStorage (sincroniza com a nuvem da Poki). */
export class DailyData {
    public static readonly KEY = 'match3_daily';
    private static state: DailyState | null = null;

    public static reload() { this.state = null; }

    private static load(): DailyState {
        if (!this.state) {
            let s: DailyState | null = null;
            try { const raw = sys.localStorage.getItem(this.KEY); if (raw) s = JSON.parse(raw); } catch (e) { }
            this.state = s || { day: '', streak: 0, lastClaimDay: '', claimedToday: false, allBonusClaimed: false, challenges: [], history: [] };
        }
        return this.state!;
    }

    private static save() {
        try { sys.localStorage.setItem(this.KEY, JSON.stringify(this.load())); } catch (e) { }
    }

    /** Vira o dia: sorteia os desafios novos (sem repetir os dos ultimos dias) e zera os premios do dia. */
    public static ensureToday(): DailyState {
        const s = this.load();
        const today = dayKey();
        if (s.day === today) return s;
        s.day = today;
        s.claimedToday = s.lastClaimDay === today;
        s.allBonusClaimed = false;
        s.challenges = this.pick(today, s.history);
        s.history = s.history.filter(h => h.day !== today);
        s.history.push({ day: today, ids: s.challenges.map(c => c.id) });
        s.history = s.history.slice(-14);
        this.save();
        return s;
    }

    private static pick(today: string, history: { day: string, ids: string[] }[]): ChallengeState[] {
        const rng = seeded(today + '#daily');
        const recent = new Set<string>();
        history.slice(-RECENT_DAYS).forEach(h => h.ids.forEach(id => recent.add(id)));
        const usedMetrics = new Set<number>();
        const out: ChallengeState[] = [];
        for (let tier = 0; tier < 3; tier++) {
            const has = (t: ChallengeTemplate) => !!t.tiers[tier] && !usedMetrics.has(t.metric);
            let pool = CHALLENGES.filter(t => has(t) && !recent.has(t.id));
            if (pool.length === 0) pool = CHALLENGES.filter(has); // banco pequeno demais: aceita repetir
            if (pool.length === 0) continue;
            const t = pool[Math.floor(rng() * pool.length)];
            usedMetrics.add(t.metric);
            const [target, reward] = t.tiers[tier]!;
            out.push({ id: t.id, tier, target, reward, base: PlayerStats.get(t.metric), claimed: false });
        }
        return out;
    }

    public static template(id: string): ChallengeTemplate | undefined { return CHALLENGES.find(c => c.id === id); }

    public static progress(c: ChallengeState): number {
        const t = this.template(c.id);
        if (!t) return 0;
        return Math.max(0, Math.min(c.target, PlayerStats.get(t.metric) - c.base));
    }

    public static isDone(c: ChallengeState): boolean { return this.progress(c) >= c.target; }

    public static claimChallenge(index: number): number {
        const s = this.ensureToday();
        const c = s.challenges[index];
        if (!c || c.claimed || !this.isDone(c)) return 0;
        c.claimed = true;
        PlayerWallet.addPoints(c.reward);
        this.save();
        return c.reward;
    }

    public static allDone(): boolean { const s = this.ensureToday(); return s.challenges.length > 0 && s.challenges.every(c => c.claimed); }
    public static canClaimAllBonus(): boolean { const s = this.ensureToday(); return this.allDone() && !s.allBonusClaimed; }
    public static claimAllBonus(): number {
        if (!this.canClaimAllBonus()) return 0;
        const s = this.ensureToday();
        s.allBonusClaimed = true;
        PlayerWallet.addPoints(ALL_CHALLENGES_BONUS);
        this.save();
        return ALL_CHALLENGES_BONUS;
    }

    // ---------- Presente diario ----------

    /** Posicao (0-6) do presente de hoje na sequencia. */
    public static todayIndex(): number {
        const s = this.ensureToday();
        if (s.claimedToday) return Math.max(0, (s.streak - 1) % DAILY_REWARDS.length);
        const next = s.lastClaimDay === dayKey(-1) ? s.streak + 1 : 1;
        return (next - 1) % DAILY_REWARDS.length;
    }

    public static streak(): number {
        const s = this.ensureToday();
        if (s.claimedToday) return s.streak;
        return s.lastClaimDay === dayKey(-1) ? s.streak : 0; // sequencia quebrada: recomeca no dia 1
    }

    public static canClaimGift(): boolean { return !this.ensureToday().claimedToday; }

    public static claimGift(): DailyReward | null {
        const s = this.ensureToday();
        if (s.claimedToday) return null;
        const reward = DAILY_REWARDS[this.todayIndex()];
        s.streak = s.lastClaimDay === dayKey(-1) ? s.streak + 1 : 1;
        s.lastClaimDay = s.day;
        s.claimedToday = true;
        if (reward.coins) PlayerWallet.addPoints(reward.coins);
        if (reward.powerup !== undefined && reward.amount) PowerupInventory.add(reward.powerup, reward.amount);
        this.save();
        return reward;
    }

    /** Premios prontos para pegar (presente + desafios concluidos + bonus): bolinha vermelha do menu. */
    public static claimableCount(): number {
        const s = this.ensureToday();
        let n = this.canClaimGift() ? 1 : 0;
        s.challenges.forEach(c => { if (!c.claimed && this.isDone(c)) n++; });
        if (this.canClaimAllBonus()) n++;
        return n;
    }

    /** Segundos ate a meia-noite local (os desafios viram). */
    public static secondsToReset(): number {
        const now = new Date(), next = new Date(now);
        next.setHours(24, 0, 0, 0);
        return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
    }
}

/** Quantas vezes cada alimento ja foi servido (tela de Colecao). */
export class FoodStats {
    public static readonly KEY = 'match3_food_counts';
    private static cache: Record<string, number> | null = null;

    public static reload() { this.cache = null; }

    private static load(): Record<string, number> {
        if (!this.cache) {
            this.cache = {};
            try { const raw = sys.localStorage.getItem(this.KEY); if (raw) this.cache = JSON.parse(raw) || {}; } catch (e) { }
        }
        return this.cache!;
    }

    public static add(type: ElementType, n: number = 1) {
        const d = this.load();
        d[type] = (d[type] || 0) + n;
        try { sys.localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { }
    }

    public static get(type: ElementType): number { return this.load()[type] || 0; }
}
