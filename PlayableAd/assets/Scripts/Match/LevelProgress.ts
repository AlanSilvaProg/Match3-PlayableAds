import { sys } from 'cc';

/** Progresso salvo (estrelas por nivel) no cache local do navegador. */
export class LevelProgress {

    public static readonly STORAGE_KEY = 'match3_level_stars';
    public static readonly MAX_STARS = 3;

    private static cache: number[] | null = null;

    /** Descarta o cache em memoria (ex.: depois que o save da nuvem da Poki e injetado no localStorage). */
    public static reload() {
        this.cache = null;
    }

    public static getStars(level: number): number {
        return this.load()[level] || 0;
    }

    /** Estrelas de cada nivel (indice = nivel, 0 = primeiro). */
    public static getAllStars(): number[] {
        return this.load().slice();
    }

    public static getTotalStars(): number {
        return this.load().reduce((sum, s) => sum + (s || 0), 0);
    }

    /** Guarda o resultado apenas se for melhor que o ja salvo. */
    public static setStars(level: number, stars: number) {
        const data = this.load();
        const value = Math.max(0, Math.min(this.MAX_STARS, Math.floor(stars)));
        if (value <= (data[level] || 0)) return;

        while (data.length <= level) data.push(0);
        data[level] = value;
        this.save(data);
    }

    private static load(): number[] {
        if (this.cache) return this.cache;
        let data: number[] = [];
        try {
            const raw = sys.localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) data = parsed.map(n => Number(n) || 0);
            }
        } catch (e) { }
        this.cache = data;
        return data;
    }

    private static save(data: number[]) {
        this.cache = data;
        try {
            sys.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) { }
    }
}
