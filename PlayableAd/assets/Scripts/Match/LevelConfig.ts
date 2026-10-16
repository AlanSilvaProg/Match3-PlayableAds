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
    /** Pedido de ouro: nao rende moedas, tem prazo menor e, se entregue no prazo, liga o Golden Time. */
    golden?: boolean;
    lines: OrderLine[];
}

/** Momento do dia de uma fase do nivel: cada um tem seus alimentos e desafios. */
export enum Meal { Breakfast, Lunch, Dinner }

export const MEAL_NAMES = ['BREAKFAST', 'LUNCH', 'DINNER'];

/** Uma fase do nivel (cafe da manha, almoco ou jantar): tem seus proprios pedidos, alimentos e tempo. */
export interface PhasePlan {
    meal: Meal;
    /** Tempo inicial da fase (os pedidos entregues cedo somam, os atrasados subtraem). */
    duration: number;
    orders: OrderPlan[];
    /** Enquanto houver pedidos na fila, ao menos este numero fica na tela (o proximo aparece antes da hora). Nao ha limite maximo. */
    minActiveOrders: number;
    /** Itens totais por tipo, derivados dos pedidos: define o que o tabuleiro precisa ter. */
    groups: LevelGroup[];
}

/**
 * Plano do nivel. Os campos duration/orders/minActiveOrders/groups/meal sempre descrevem a FASE ATUAL (phaseIndex):
 * o plano devolvido por LevelConfig.get() e o da 1a fase; LevelConfig.phase(plan, i) devolve o da fase i.
 */
export interface LevelPlan extends PhasePlan {
    level: number;
    special: boolean;
    /** Faixa de dificuldade: sobe a cada 10 niveis. */
    tier: number;
    /** Indice da fase atual em `phases`. */
    phaseIndex: number;
    /** Todas as fases do nivel: niveis normais = almoco + jantar; especiais = cafe da manha + almoco + jantar. */
    phases: PhasePlan[];
}

/**
 * Balanceamento procedural e deterministico dos niveis (mesmo nivel = mesmo plano).
 * Ajuste os numeros em TUNING para mudar a curva de dificuldade.
 */
export class LevelConfig {
    /** O jogador ja concluiu este nivel? (ligado ao LevelProgress pelo GameManager; sem ele conta como concluido) */
    public static isCompleted: (level: number) => boolean = () => true;

    public static readonly TUNING = {
        /** A cada N niveis ha um nivel especial (mais dificil, botao especial). */
        specialEvery: 10,

        // ---- Curva de quantidade x tempo ----
        /** A quantidade (pedidos, itens por pedido, linhas) sobe logo: do nivel 2 em diante usa no minimo a dificuldade desta "nivel equivalente". */
        minQuantityLevel: 20,
        /** O 1o nivel e um aquecimento: usa esta dificuldade equivalente. */
        firstLevelQuantityLevel: 4,
        /** Tempo extra nos primeiros niveis: o tempo por item/pedido e multiplicado por 1 + earlyTimeBonus, caindo a 1 ate o nivel earlyTimeLevels. */
        earlyTimeBonus: 0.5,
        earlyTimeLevels: 20,
        /** Primeiro nivel de todos: ainda mais folga (o 1o minuto do jogador precisa terminar em vitoria tranquila). */
        firstLevelEase: 1.25,
        /** Cada fase seguinte do nivel tem este tanto a menos de tempo (a 1a fase e a mais folgada). */
        phaseTimeDrop: 0.08,

        // ---- Variedade de alimentos ----
        baseTypes: 3,
        /** Tipos por nivel = fracao dos alimentos ja liberados (com os novos entrando em grupos: 3 no nivel 2, 5 no nivel 5...). */
        typeShare: 0.8,
        specialExtraTypes: 2,
        maxTypes: 11,

        // ---- Pedidos ----
        /** Quantidade de pedidos: base + nivel * ordersPerLevel + faixa + bonus especial. */
        baseOrders: 4,
        ordersPerLevel: 0.65,
        specialExtraOrders: 2,
        maxOrders: 12,
        /** Teto de itens no tabuleiro: pedidos do fim da fila sao descartados acima disso. */
        maxBoardItems: 100,
        /** Itens por pedido: limite = base + nivel * porNivel (ate o maximo). */
        maxItemsPerOrderBase: 3.5,
        maxItemsPerOrderPerLevel: 0.5,
        maxItemsPerOrderCap: 12,
        /** Chance de um pedido ter uma 2a linha (outro alimento): base + nivel * porNivel. */
        secondLineChance: 0.25,
        secondLineChancePerLevel: 0.03,
        /** A partir deste nivel os pedidos podem ter 3 linhas. */
        thirdLineFromLevel: 6,
        thirdLineChance: 0.1,
        thirdLineChancePerLevel: 0.01,
        specialExtraLineChance: 0.15,
        /** Quantidade pedida por linha: minimo 1 nos primeiros niveis, 2 depois; maximo cresce com o nivel (ate 4). */
        minQuantityEarly: 1,
        minQuantityFromLevel: 3,
        minQuantity: 2,
        baseMaxQuantity: 2,
        maxQuantityEveryLevels: 3,
        maxQuantityCap: 4,
        specialExtraQuantity: 1,
        /** Fases: cada uma recebe esta fracao da quantidade de pedidos do nivel (normal 2 fases, especial 3). */
        phaseOrderShare: 0.5,
        minPhaseOrders: 3,
        maxPhaseOrders: 9,
        /** Fracao dos tipos disponiveis que cada fase usa (janelas deslizantes: fases vizinhas tem alimentos diferentes). */
        basePhaseTypes: 4,
        phaseTypesEvery: 6,
        /** Pedidos minimos sempre visiveis enquanto houver fila. */
        minActiveOrders: 2,
        /** Itens extras no tabuleiro (sem pedido): fracao dos itens pedidos, com minimo, para o tabuleiro nao ficar vazio. */
        decoyRatio: 0.3,
        minDecoys: 6,
        /** Teto de itens no tabuleiro contando os extras. */
        maxBoardTotal: 120,

        // ---- Tempo ----
        /** Segundos por item no tempo do nivel: comeca em base e cai por nivel/faixa ate o minimo. */
        baseSecondsPerItem: 2.0,
        secondsPerItemDropPerLevel: 0.035,
        secondsPerItemDropPerTier: 0.05,
        minSecondsPerItem: 1.25,
        fixedTimeBonus: 14,
        specialTimeFactor: 0.9,
        /** Cada fase (cafe, almoco, jantar) dura em media 1 minuto: entre estes limites. Pedidos demais para caber no maximo sao cortados. */
        minDuration: 55,
        maxDuration: 75,
        /** Prazo de cada pedido = itens * segundos por item * deliverFactor + deliverPadding. */
        deliverFactor: 2.1,
        deliverPadding: 10,
        minDeliverTime: 16,
        /** Chance de cada pedido (a partir do 3o da fase) ser de ouro e o quanto o prazo dele e menor. */
        goldenChance: 0.05,
        /** Chance de o 1o pedido do almoco ser de ouro em niveis que o jogador nunca concluiu. */
        goldenFirstLunchChance: 0.5,
        goldenTimeFactor: 0.7,
        /** Os pedidos aparecem espalhados ate esta fracao da duracao do nivel. */
        spawnSpreadRatio: 0.55,
    };

    public static isSpecial(level: number): boolean {
        return (level + 1) % this.TUNING.specialEvery === 0;
    }

    /** Plano da fase `index` de um nivel (o mesmo objeto com os campos da fase aplicados). */
    public static phase(plan: LevelPlan, index: number): LevelPlan {
        const i = Math.max(0, Math.min(plan.phases.length - 1, index));
        return { ...plan, ...plan.phases[i], phaseIndex: i };
    }

    public static get(level: number): LevelPlan {
        const T = this.TUNING;
        const rng = this.rng(level * 7919 + 13);
        const special = this.isSpecial(level);
        // Dificuldade de quantidade (equivalente): sobe rapido; a variedade de alimentos continua seguindo o nivel real.
        const qLevel = level === 0 ? T.firstLevelQuantityLevel : Math.max(level, T.minQuantityLevel);
        const tier = Math.floor(qLevel / T.specialEvery);

        const available = ElementCatalog.defs.filter(d => d.unlockLevel <= level).map(d => d.type);

        // Fases: toda fase tem cafe da manha, almoco e jantar (a partir do 1o nivel).
        const meals = [Meal.Breakfast, Meal.Lunch, Meal.Dinner];
        // Alimentos por fase (em media 4 no inicio, sobe com o nivel) e no nivel inteiro (as janelas das fases se sobrepoem).
        const windowTarget = T.basePhaseTypes + Math.floor(level / T.phaseTypesEvery) + (special ? 1 : 0);
        const typeCount = Math.max(T.baseTypes, Math.min(windowTarget + 2 * (meals.length - 1), T.maxTypes, available.length));

        // Escolha dos tipos: o item mais novo liberado entra sempre (e abre a lista); o resto varia por nivel.
        const chosen: ElementType[] = [];
        const newest = ElementCatalog.defs
            .filter(d => d.unlockLevel <= level)
            .sort((a, b) => b.unlockLevel - a.unlockLevel)[0];
        if (newest) {
            // No nivel em que um grupo de alimentos e liberado, TODOS os novos entram (o jogador conhece o grupo inteiro).
            const group = ElementCatalog.defs.filter(d => d.unlockLevel === newest.unlockLevel && newest.unlockLevel === level);
            (group.length > 0 ? group : [newest]).forEach(d => chosen.push(d.type));
        }
        const pool = available.filter(t => chosen.indexOf(t) === -1);
        while (chosen.length < typeCount && pool.length > 0) {
            chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        }

        const baseOrders = T.baseOrders + Math.floor(qLevel * T.ordersPerLevel) + tier + (special ? T.specialExtraOrders : 0);
        const share = T.phaseOrderShare;
        const phaseOrders = Math.max(T.minPhaseOrders,
            Math.min(T.maxPhaseOrders, Math.round(Math.max(T.baseOrders, Math.min(baseOrders, T.maxOrders)) * share)));

        // Cada fase usa uma janela dos tipos escolhidos: as fases vizinhas tem alimentos diferentes.
        const n = chosen.length;
        const windowSize = Math.max(Math.min(2, n), Math.min(n, windowTarget));
        const phases: PhasePlan[] = meals.map((meal, i) => {
            const start = meals.length > 1 ? Math.floor(i * (n - windowSize) / (meals.length - 1)) : 0;
            const types = chosen.slice(start, start + windowSize).sort((a, b) => a - b);
            // A cada fase a dificuldade sobe um pouco (como se fosse um nivel a frente).
            return this.buildPhase(qLevel + i, level, i, special, tier, rng, types, phaseOrders, meal);
        });

        return { level, special, tier, phaseIndex: 0, phases, ...phases[0] };
    }

    /** Monta os pedidos, o tempo e os itens de uma fase usando so os `types` dados. */
    private static buildPhase(level: number, realLevel: number, phaseIdx: number, special: boolean, tier: number, rng: () => number,
        chosen: ElementType[], orderCount: number, meal: Meal): PhasePlan {
        const T = this.TUNING;

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

        // Tempo por item: cai com a dificuldade, mas os primeiros niveis ganham folga extra (que some ate o nivel
        // earlyTimeLevels) e a 1a fase de cada nivel e mais folgada que as seguintes.
        const earlyFactor = (1 + T.earlyTimeBonus * Math.max(0, 1 - realLevel / T.earlyTimeLevels)) * (realLevel === 0 ? T.firstLevelEase : 1);
        const phaseFactor = Math.max(0.5, 1 - T.phaseTimeDrop * phaseIdx);
        const perItem = Math.max(T.minSecondsPerItem,
            T.baseSecondsPerItem - T.secondsPerItemDropPerLevel * level - T.secondsPerItemDropPerTier * tier) * earlyFactor * phaseFactor;

        // A fase precisa caber no tempo maximo (~1 minuto): corta pedidos do fim da fila (mantendo o minimo).
        while (draft.length > T.minPhaseOrders && totalItems * perItem + T.fixedTimeBonus > T.maxDuration) {
            totalItems -= itemsOf(draft.pop()!);
        }

        let duration = totalItems * perItem + T.fixedTimeBonus;
        if (special) duration *= T.specialTimeFactor;
        duration = Math.max(T.minDuration, Math.min(T.maxDuration, Math.round(duration)));

        const orderTotal = draft.length;
        const spread = duration * T.spawnSpreadRatio;
        const orders: OrderPlan[] = draft.map((lines, i) => {
            let deliver = itemsOf(lines) * perItem * T.deliverFactor + T.deliverPadding;
            if (special) deliver *= T.specialTimeFactor;
            // Pedido de ouro: prazo menor. Em nivel nunca concluido, o 1o pedido do almoco tem 50% de chance (sorteio a cada
            // tentativa); nos demais, 5%, nunca um dos 2 primeiros da fase.
            const firstLunch = i === 0 && meal === Meal.Lunch && !this.isCompleted(realLevel);
            const golden = firstLunch ? Math.random() < T.goldenFirstLunchChance : (i >= 2 && rng() < T.goldenChance);
            if (golden) deliver *= T.goldenTimeFactor;
            return {
                spawnTime: orderTotal > 1 ? Math.round((spread * i) / (orderTotal - 1)) : 0,
                deliverTime: Math.max(golden ? 8 : T.minDeliverTime, Math.round(deliver)),
                lines,
                golden: golden || undefined,
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

        return { meal, duration, orders, minActiveOrders: T.minActiveOrders, groups };
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
