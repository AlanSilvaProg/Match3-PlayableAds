import { sys } from 'cc';
import { PowerupType } from './PowerupCatalog';

/** Leitura/gravacao segura no cache local do navegador. */
function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = sys.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeJson(key: string, value: unknown) {
    try {
        sys.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { }
}

/** Quantidade de cada power-up que o jogador possui (salva localmente, como o progresso de niveis). */
export class PowerupInventory {

    public static readonly STORAGE_KEY = 'match3_powerups';
    private static cache: number[] | null = null;

    private static load(): number[] {
        if (!this.cache) {
            const data = readJson<number[]>(this.STORAGE_KEY, []);
            this.cache = Array.isArray(data) ? data.map(n => Math.max(0, Number(n) || 0)) : [];
        }
        return this.cache;
    }

    public static reload() {
        this.cache = null;
    }

    public static getCount(type: PowerupType): number {
        return this.load()[type] || 0;
    }

    public static add(type: PowerupType, amount: number = 1) {
        const data = this.load();
        while (data.length <= type) data.push(0);
        data[type] += amount;
        writeJson(this.STORAGE_KEY, data);
    }

    /** Consome 1 unidade. Retorna false se nao havia. */
    public static consume(type: PowerupType): boolean {
        const data = this.load();
        if ((data[type] || 0) <= 0) return false;
        data[type]--;
        writeJson(this.STORAGE_KEY, data);
        return true;
    }
}

/** Saldo de pontos acumulado nas partidas (merges e combos); usado para comprar power-ups. */
export class PlayerWallet {

    public static readonly STORAGE_KEY = 'match3_points';
    private static cache: number | null = null;

    public static reload() {
        this.cache = null;
    }

    public static getPoints(): number {
        if (this.cache === null) this.cache = Math.max(0, Number(readJson<number>(this.STORAGE_KEY, 0)) || 0);
        return this.cache;
    }

    public static addPoints(amount: number) {
        if (amount <= 0) return;
        this.cache = this.getPoints() + Math.floor(amount);
        writeJson(this.STORAGE_KEY, this.cache);
    }

    /** Gasta pontos. Retorna false se o saldo nao e suficiente. */
    public static spend(amount: number): boolean {
        if (this.getPoints() < amount) return false;
        this.cache = this.getPoints() - amount;
        writeJson(this.STORAGE_KEY, this.cache);
        return true;
    }
}
