/**
 * Vibracao do celular (navigator.vibrate). Silenciosa onde nao existe (iOS/Safari, desktop) e nunca quebra o jogo.
 * Padroes curtos: o objetivo e um "toque" de resposta, nao um motor ligado.
 */
export class Haptics {
    /** Liga/desliga todas as vibracoes. */
    public static enabled: boolean = true;
    private static last: number = 0;

    public static vibrate(pattern: number | number[]) {
        if (!this.enabled) return;
        try {
            const nav: any = (globalThis as any).navigator;
            if (!nav || typeof nav.vibrate !== 'function') return;
            const now = performance.now();
            if (now - this.last < 30) return; // sem metralhadora de vibracoes
            this.last = now;
            nav.vibrate(pattern);
        } catch (e) { /* sem vibracao */ }
    }

    /** Escolher um alimento. */
    public static tick() { this.vibrate(8); }
    /** Linha do pedido completa. */
    public static line() { this.vibrate(20); }
    /** Entrega no prazo. */
    public static delivery() { this.vibrate([18, 28, 34]); }
    /** Entrega perfeita. */
    public static perfect() { this.vibrate([20, 30, 20, 30, 60]); }
    /** Clique errado / entrega atrasada. */
    public static wrong() { this.vibrate([35, 45, 35]); }
    public static late() { this.vibrate([90, 50, 90]); }
    /** Comemoracao de combo: mais forte a cada degrau (0 = NICE ... 5 = LEGENDARY). */
    public static celebration(tier: number) {
        const n = Math.min(5, Math.max(0, tier)) + 1;
        const p: number[] = [];
        for (let i = 0; i < n; i++) { p.push(16 + i * 4); if (i < n - 1) p.push(36); }
        this.vibrate(p);
    }
    /** Golden Time, raio, fase nova, vitoria. */
    public static big() { this.vibrate([30, 40, 30, 40, 80]); }
    /** Derrota. */
    public static defeat() { this.vibrate([140, 60, 220]); }
}
