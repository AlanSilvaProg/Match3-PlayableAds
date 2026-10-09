import { _decorator, Component, Prefab, SpriteFrame, instantiate, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

import { MatchElement } from './MatchElement';
import { MatchController } from './MatchController';
import { ElementType } from './ElementType';
import { ElementCatalog } from './ElementCatalog';
import { LevelConfig, LevelPlan } from './LevelConfig';
import { GameManager } from './GameManager';
import { MatchSlots } from './MatchSlots';

@ccclass('MatchInitializer')
export class MatchInitializer extends Component {

    @property({ type: Prefab, tooltip: 'Prefab unico dos itens: tipo e sprite sao definidos em runtime.' })
    public elementPrefab: Prefab = null!;

    @property({ type: SpriteFrame, tooltip: 'Sprite frame do food-elements-sheet.png inteiro; os itens sao recortados dele.' })
    public foodSheet: SpriteFrame | null = null;

    @property(MatchController)
    public matchController: MatchController = null!;

    @property(MatchSlots)
    public matchSlots: MatchSlots = null!;

    @property({ tooltip: 'Tamanho maximo (px) do sprite de cada item no tabuleiro.' })
    public elementSize: number = 90;

    private width: number = 0;
    private height: number = 0;
    private anchorX: number = 0;
    private anchorY: number = 0;
    private built: boolean = false;

    protected onLoad() {
        ElementCatalog.init(this.foodSheet);
    }

    protected start() {
        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            this.width = uiTransform.width;
            this.height = uiTransform.height;
            this.anchorX = uiTransform.anchorX;
            this.anchorY = uiTransform.anchorY;
        }

        // O tabuleiro so e montado quando o jogador escolhe o nivel (ou no inicio direto, na primeira vez).
        if (GameManager.instance) {
            GameManager.instance.events.on(GameManager.EVENT_PLAY, this.onPlay, this);
        }
    }

    protected onDestroy() {
        // Ao trocar de cena o GameManager pode ja ter sido destruido (campos zerados pelo engine).
        GameManager.instance?.events?.off(GameManager.EVENT_PLAY, this.onPlay, this);
    }

    private onPlay() {
        this.BuildLevel(LevelConfig.get(GameManager.currentLevel));
    }

    public BuildLevel(plan: LevelPlan) {
        if (this.built) return;
        this.built = true;

        for (const group of plan.groups) {
            const total = group.count; // itens = soma das quantidades pedidas
            for (let i = 0; i < total; i++) {
                this.CreateMatchElement(group.type, true);
            }
        }

        if (GameManager.instance) {
            GameManager.instance.ApplyLevelPlan(plan);
        }
    }

    public CreateMatchElement(type: ElementType, randomizePosition: boolean): MatchElement | null {
        const instance = instantiate(this.elementPrefab);
        instance.parent = this.node;

        const matchElement = instance.getComponent(MatchElement);
        if (!matchElement) {
            console.error("Prefab does not have a MatchElement component.");
            return null;
        }

        matchElement.Setup(type, this.elementSize);

        if (randomizePosition) {
            const x = (Math.random() - this.anchorX) * this.width;
            const y = (Math.random() - this.anchorY) * this.height;
            instance.setPosition(new Vec3(x, y, 0));
        }

        if (GameManager.instance) {
            GameManager.instance.IncreaseElements(1);
        }

        matchElement.matchController = this.matchController;
        matchElement.matchSlots = this.matchSlots;

        return matchElement;
    }
}
