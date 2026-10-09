import { sys, Enum } from 'cc';
import { LevelProgress } from './LevelProgress';
import { LevelConfig } from './LevelConfig';

/** Metricas que as conquistas podem acompanhar. */
export enum AchievementMetric {
    /** Niveis diferentes concluidos (ao menos 1 estrela). */
    LevelsCompleted,
    /** Maior nivel concluido (numero do nivel, 1 = primeiro). */
    HighestLevel,
    /** Total de estrelas. */
    TotalStars,
    /** Niveis diferentes concluidos com 3 estrelas. */
    ThreeStarLevels,
    /** Niveis especiais (a cada 10) diferentes concluidos. */
    SpecialLevelsCompleted,
    /** Merges feitos (total). */
    Merges,
    /** Pedidos entregues (total). */
    OrdersDelivered,
    /** Pedidos entregues dentro do prazo (total). */
    OrdersOnTime,
    /** Coins ganhos em partidas (total acumulado). */
    CoinsEarned,
    /** Power-ups usados em partida. */
    PowerupsUsed,
    /** Power-ups comprados com coins. */
    PowerupsBought,
    /** Vezes que o combo chegou ao nivel maximo. */
    MaxComboReached,
    /** Vezes que o jogador continuou depois de falhar (anuncio). */
    Revives,
}
Enum(AchievementMetric);

/**
 * Estatisticas do jogador (cache local). Algumas metricas sao derivadas do progresso de niveis; as demais
 * sao contadores gravados aqui.
 */
export class PlayerStats {

    public static readonly STORAGE_KEY = 'match3_stats';
    private static cache: Record<string, number> | null = null;

    private static load(): Record<string, number> {
        if (!this.cache) {
            this.cache = {};
            try {
                const raw = sys.localStorage.getItem(this.STORAGE_KEY);
                if (raw) this.cache = JSON.parse(raw) || {};
            } catch (e) { }
        }
        return this.cache!;
    }

    private static save() {
        try {
            sys.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.load()));
        } catch (e) { }
    }

    public static reload() {
        this.cache = null;
    }

    /** Soma ao contador de uma metrica gravada. */
    public static increment(metric: AchievementMetric, amount: number = 1) {
        const data = this.load();
        const key = AchievementMetric[metric];
        data[key] = (data[key] || 0) + amount;
        this.save();
    }

    public static get(metric: AchievementMetric): number {
        const stars = LevelProgress.getAllStars();
        switch (metric) {
            case AchievementMetric.LevelsCompleted:
                return stars.filter(s => s > 0).length;
            case AchievementMetric.HighestLevel: {
                let highest = 0;
                stars.forEach((s, i) => { if (s > 0) highest = i + 1; });
                return highest;
            }
            case AchievementMetric.TotalStars:
                return stars.reduce((a, s) => a + (s || 0), 0);
            case AchievementMetric.ThreeStarLevels:
                return stars.filter(s => s >= 3).length;
            case AchievementMetric.SpecialLevelsCompleted:
                return stars.filter((s, i) => s > 0 && LevelConfig.isSpecial(i)).length;
            default:
                return this.load()[AchievementMetric[metric]] || 0;
        }
    }
}
