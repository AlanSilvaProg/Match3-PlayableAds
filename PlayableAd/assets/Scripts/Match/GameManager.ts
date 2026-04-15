import { _decorator, Component, Label, Prefab, instantiate, Node, Sprite, find, director } from 'cc';
import { MatchElement } from './MatchElement';
const { ccclass, property } = _decorator;

import { GameState } from './GameState';

@ccclass('GameManager')
export class GameManager extends Component {

    @property
    public duration: number = 60;

    @property(Label)
    public timerLabel: Label = null!;

    @property(Sprite)
    public timerBar: Sprite = null!;

    @property(Prefab)
    public victoryPrefab: Prefab = null!;

    @property(Prefab)
    public defeatPrefab: Prefab = null!;

    @property([Node])
    public nodesToDeactivate: Node[] = [];

    @property(Node)
    public warningNode: Node | null = null;

    @property
    public warningThreshold: number = 10;

    private currentState: GameState = GameState.Tutorial;
    private timer: number = 0;
    private totalElements: number = 0;
    private matchedElements: number = 0;

    public static instance: GameManager = null!;

    onLoad() {
        GameManager.instance = this;
    }

    start() {
        this.timer = this.duration;
        this.updateTimerUI();

        if (this.warningNode) {
            this.warningNode.active = false;
        }
    }

    public StartGame() {
        if (this.currentState === GameState.Tutorial) {
            this.currentState = GameState.Running;
        }
    }

    public IsRunning(): boolean {
        return this.currentState === GameState.Running;
    }

    public IsTutorialRunning(): boolean {
        return this.currentState === GameState.Tutorial;
    }

    public RegisterElements(count: number) {
        this.IncreaseElements(count);
    }

    public IncreaseElements(value: number) {
        this.totalElements += value;
    }

    public RegisterMatch(count: number) {
        if (!this.IsRunning()) return;

        this.matchedElements += count;
        if (this.matchedElements >= this.totalElements) {
            this.SetState(GameState.Victory);
        }
    }

    private SetState(state: GameState) {
        this.currentState = state;

        if (state === GameState.Victory) {
            if (this.victoryPrefab) {
                const instance = instantiate(this.victoryPrefab);
                instance.parent = this.node.parent;
            }
        } else if (state === GameState.Defeat) {
            if (this.defeatPrefab) {
                const instance = instantiate(this.defeatPrefab);
                instance.parent = this.node.parent;
            }
        }

        if (state === GameState.Victory || state === GameState.Defeat) {
            this.nodesToDeactivate.forEach(node => {
                if (node) node.active = false;
            });

            if (this.warningNode) this.warningNode.active = false;

            const searchRoot = find("Canvas") || director.getScene();
            if (searchRoot) {
                const elements = searchRoot.getComponentsInChildren(MatchElement);
                elements.forEach(el => {
                    el.SetSortingOrder(el.defaultSortingOrder);
                });
            }
        }
    }

    update(deltaTime: number) {
        if (this.currentState === GameState.Running) {
            this.timer -= deltaTime;

            if (this.warningNode && !this.warningNode.active && this.timer <= this.warningThreshold) {
                this.warningNode.active = true;
            }

            if (this.timer <= 0) {
                this.timer = 0;
                this.SetState(GameState.Defeat);
            }
            this.updateTimerUI();
        }
    }

    private updateTimerUI() {
        if (this.timerLabel) {
            const minutes = Math.floor(this.timer / 60);
            const seconds = Math.floor(this.timer % 60);
            this.timerLabel.string = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }

        if (this.timerBar) {
            this.timerBar.fillRange = -1 * (Math.ceil(this.timer) / this.duration);
        }
    }
}
