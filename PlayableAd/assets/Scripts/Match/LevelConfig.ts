import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';

export interface LevelGroup {
    type: ElementType;
    /** Quantos itens desse tipo o nivel exige no total (somando todos os pedidos). */
    count: number;
}

export interface OrderLine {
    type: ElementType;
    /** Quantidade exata desse alimento que o pedido pede (um unico merge com essa quantidade). */
    quantity: number;
}

export interface OrderPlan {
    /** Segundos de nivel (cronometro correndo) a partir dos quais o pedido pode aparecer. */
    spawnTime: number;
    /** Segundos para entregar o pedido a partir do momento em que ele aparece. */
    deliverTime: number;
    lines: OrderLine[];
}

export interface LevelPlan {
    level: number;
    special: boolean;
    /** Faixa de dificuldade: sobe a cada 10 niveis. */
    tier: number;
    /** Tempo inicial do nivel (os pedidos entregues cedo somam, os atrasados subtraem). */
    duration: number;
    orders: OrderPlan[];
    /** Enquanto houver pedidos na fila, ao menos este numero fica na tela (o proximo aparece antes da hora). Nao ha limite maximo. */
    minActiveOrders: number;
    /** Itens totais por tipo, derivados dos pedidos: define o que o tabuleiro precisa ter. */
    groups: LevelGroup[];
}

/**
 * Balanceamento procedural e deterministico dos niveis (mesmo nivel = mesmo plano).
 * Ajuste os numeros em TUNING para mudar a curva de dificuldade.
 */
export class LevelConfig {

    public static readonly TUNING = {
        /** A cada N niveis ha um nivel especial (mais dificil, botao especial). */
        specialEvery: 10,

        // ---- Variedade de alimentos ----
        baseTypes: 3,
        typesPerLevels: 4,
        specialExtraTypes: 2,
        maxTypes: 9,

        // ---- Pedidos ----
        /** Quantidade de pedidos: base + nivel * ordersPerLevel + faixa + bonus especial. */
        baseOrders: 4,
        ordersPerLevel: 0.3,
        specialExtraOrders: 2,
        maxOrders: 12,
        /** Teto de itens no tabuleiro: pedidos do fim da fila sao descartados acima disso. */
        maxBoardItems: 100,
        /** Itens por pedido: limite = base + nivel * porNivel (ate o maximo). */
        maxItemsPerOrderBase: 4,
        maxItemsPerOrderPerLevel: 0.3,
        maxItemsPerOrderCap: 12,
        /** Chance de um pedido ter uma 2a linha (outro alimento): base + nivel * porNivel. */
        secondLineChance: 0.2,
        secondLineChancePerLevel: 0.02,
        /** A partir deste nivel os pedidos podem ter 3 linhas. */
        thirdLineFromLevel: 10,
        thirdLineChance: 0.1,
        thirdLineChancePerLevel: 0.008,
        specialExtraLineChance: 0.15,
        /** Quantidade pedida por linha: minimo 1 nos primeiros niveis, 2 depois; maximo cresce com o nivel (ate 4). */
        minQuantityEarly: 1,
        minQuantityFromLevel: 5,
        minQuantity: 2,
        baseMaxQuantity: 2,
        maxQuantityEveryLevels: 6,
        maxQuantityCap: 4,
        specialExtraQuantity: 1,
        /** Pedidos minimos sempre visiveis enquanto houver fila. */
        minActiveOrders: 2,
        /** Itens extras no tabuleiro (sem pedido): fracao dos itens pedidos, com minimo, para o tabuleiro nao ficar vazio. */
        decoyRatio: 0.3,
        minDecoys: 6,
        /** Teto de itens no tabuleiro contando os extras. */
        maxBoardTotal: 110,

        // ---- Tempo ----
        /** Segundos por item no tempo do nivel: comeca em base e cai por nivel/faixa ate o minimo. */
        baseSecondsPerItem: 1.55,
        secondsPerItemDropPerLevel: 0.018,
        secondsPerItemDropPerTier: 0.05,
        minSecondsPerItem: 0.85,
        fixedTimeBonus: 12,
        specialTimeFactor: 0.9,
        minDuration: 30,
        maxDuration: 180,
        /** Prazo de cada pedido = itens * segundos por item * deliverFactor + deliverPadding. */
        deliverFactor: 1.35,
        deliverPadding: 10,
        minDeliverTime: 15,
        /** Os pedidos aparecem espalhados ate esta fracao da duracao do nivel. */
        spawnSpreadRatio: 0.55,
    };

    public static isSpecial(level: number): boolean {
        return (level + 1) % this.TUNING.specialEvery === 0;
    }

    public static get(level: number): LevelPlan {
        const T = this.TUNING;
        const rng = this.rng(level * 7919 + 13);
        const special = this.isSpecial(level);
        const tier = Math.floor(level / T.specialEvery);

        const available = ElementCatalog.defs.filter(d => d.unlockLevel <= level).map(d => d.type);

        // Quantidade de tipos diferentes (a cada 3 niveis um "respiro" com um tipo a menos).
        let typeCount = T.baseTypes + Math.floor(level / T.typesPerLevels) + (special ? T.specialExtraTypes : 0);
        if (!special && level % 3 === 2) typeCount -= 1;
        typeCount = Math.max(T.baseTypes, Math.min(typeCount, T.maxTypes, available.length));

        // Escolha dos tipos: o item mais novo liberado entra sempre; o resto varia por nivel.
        const chosen: ElementType[] = [];
        const newest = ElementCatalog.defs
            .filter(d => d.unlockLevel <= level)
            .sort((a, b) => b.unlockLevel - a.unlockLevel)[0];
        if (newest) chosen.push(newest.type);
        const pool = available.filter(t => chosen.indexOf(t) === -1);
        while (chosen.length < typeCount && pool.length > 0) {
            chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        }
        chosen.sort((a, b) => a - b);

        // ---- Pedidos ----
        let orderCount = T.baseOrders + Math.floor(level * T.ordersPerLevel) + tier + (special ? T.specialExtraOrders : 0);
        orderCount = Math.max(T.baseOrders, Math.min(orderCount, T.maxOrders));

        const maxLines = Math.min(chosen.length, special ? 4 : 3);
        const bag: ElementType[] = [];
        const refillBag = () => {
            const copy = chosen.slice();
            while (copy.length) bag.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
        };

        const draft: OrderLine[][] = [];
        for (let i = 0; i < orderCount; i++) {
            let lineCount = 1;
            if (rng() < T.secondLineChance + T.secondLineChancePerLevel * level + (special ? T.specialExtraLineChance : 0)) lineCount = 2;
            if (level >= T.thirdLineFromLevel &&
                rng() < T.thirdLineChance + T.thirdLineChancePerLevel * (level - T.thirdLineFromLevel) + (special ? T.specialExtraLineChance : 0)) lineCount = 3;
            lineCount = Math.min(lineCount, maxLines);

            const lines: OrderLine[] = [];
            while (lines.length < lineCount) {
                if (bag.length === 0) refillBag();
                // Pega do saco o primeiro tipo ainda ausente neste pedido (todos os tipos aparecem ao longo do nivel).
                let idx = bag.findIndex(t => !lines.some(l => l.type === t));
                if (idx === -1) idx = 0;
                const type = bag.splice(idx, 1)[0];
                if (lines.some(l => l.type === type)) break;

                const minQ = level < T.minQuantityFromLevel ? T.minQuantityEarly : T.minQuantity;
                const maxQ = Math.min(T.maxQuantityCap,
                    T.baseMaxQuantity + Math.floor(level / T.maxQuantityEveryLevels) + (special ? T.specialExtraQuantity : 0));
                const quantity = minQ + Math.floor(rng() * (Math.max(minQ, maxQ) - minQ + 1));
                lines.push({ type, quantity });
            }
            if (lines.length === 0) lines.push({ type: chosen[0], quantity: 1 });

            // Limita o tamanho do pedido (some linhas / reduz quantidades) para a dificuldade crescer de forma gradual.
            const itemCap = Math.min(T.maxItemsPerOrderCap, Math.floor(T.maxItemsPerOrderBase + level * T.maxItemsPerOrderPerLevel));
            const sumItems = () => lines.reduce((sum, l) => sum + l.quantity, 0);
            while (lines.length > 1 && sumItems() > itemCap) lines.pop();
            for (const l of lines) {
                while (l.quantity > 1 && sumItems() > itemCap) l.quantity--;
            }
            draft.push(lines);
        }

        const itemsOf = (lines: OrderLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
        // Teto de itens: descarta pedidos do fim da fila (mantendo ao menos baseOrders).
        let totalItems = draft.reduce((s, lines) => s + itemsOf(lines), 0);
        while (totalItems > T.maxBoardItems && draft.length > T.baseOrders) {
            totalItems -= itemsOf(draft.pop()!);
        }

        const perItem = Math.max(T.minSecondsPerItem,
            T.baseSecondsPerItem - T.secondsPerItemDropPerLevel * level - T.secondsPerItemDropPerTier * tier);

        let duration = totalItems * perItem + T.fixedTimeBonus;
        if (special) duration *= T.specialTimeFactor;
        duration = Math.max(T.minDuration, Math.min(T.maxDuration, Math.round(duration)));

        const orderTotal = draft.length;
        const spread = duration * T.spawnSpreadRatio;
        const orders: OrderPlan[] = draft.map((lines, i) => {
            let deliver = itemsOf(lines) * perItem * T.deliverFactor + T.deliverPadding;
            if (special) deliver *= T.specialTimeFactor;
            return {
                spawnTime: orderTotal > 1 ? Math.round((spread * i) / (orderTotal - 1)) : 0,
                deliverTime: Math.max(T.minDeliverTime, Math.round(deliver)),
                lines,
            };
        });

        // Itens do tabuleiro = soma das quantidades pedidas por tipo.
        const totals = new Map<ElementType, number>();
        orders.forEach(o => o.lines.forEach(l => totals.set(l.type, (totals.get(l.type) || 0) + l.quantity)));
        const groups: LevelGroup[] = chosen
            .filter(t => totals.has(t))
            .map(type => ({ type, count: totals.get(type)! }));

        // Itens extras: tabuleiro mais cheio (qualquer item do tipo pedido serve para o merge, os sobrando ficam).
        const decoys = Math.max(0, Math.min(Math.max(T.minDecoys, Math.ceil(totalItems * T.decoyRatio)), T.maxBoardTotal - totalItems));
        for (let i = 0; i < decoys; i++) {
            const g = groups[Math.floor(rng() * groups.length)];
            if (g) g.count++;
        }

        return { level, special, tier, duration, orders, minActiveOrders: T.minActiveOrders, groups };
    }

    /** Gerador pseudo-aleatorio deterministico (mulberry32). */
    private static rng(seed: number): () => number {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
}
