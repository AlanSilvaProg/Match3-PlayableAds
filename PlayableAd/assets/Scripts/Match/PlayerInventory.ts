import { SoundManager } from './SoundManager';
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
        this.seen = null;
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

    private static readonly SEEN_KEY = 'match3_powerup_seen';
    private static seen: number[] | null = null;

    /** O jogador ja comprou, ganhou por anuncio ou usou este power-up alguma vez? (os tutoriais so valem para quem nunca fez) */
    public static hasSeen(type: PowerupType): boolean {
        if (!this.seen) {
            const data = readJson<number[]>(this.SEEN_KEY, []);
            this.seen = Array.isArray(data) ? data : [];
        }
        return this.seen.indexOf(type) !== -1;
    }

    public static markSeen(type: PowerupType) {
        if (this.hasSeen(type)) return;
        this.seen!.push(type);
        writeJson(this.SEEN_KEY, this.seen);
    }

    /** Consome 1 unidade. Retorna false se nao havia. */
    public static consume(type: PowerupType): boolean {
        const data = this.load();
        if ((data[type] || 0) <= 0) return false;
        data[type]--;
        writeJson(this.STORAGE_KEY, data);
        this.markSeen(type);
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
        if (amount > 0) SoundManager.playSuccessOrder();
        return true;
    }
}
