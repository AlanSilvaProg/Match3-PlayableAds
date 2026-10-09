import { SoundManager } from './SoundManager';
import { _decorator, Component, Button, Node } from 'cc';
const { ccclass, property } = _decorator;
import { GameManager } from './GameManager';
import { PowerupManager } from './PowerupManager';

@ccclass('StartScreen')
export class StartScreen extends Component {

    @property(Button)
    public playButton: Button | null = null;

    @property({ type: Node, tooltip: 'Seletor de niveis aberto ao clicar em Play. Se vazio, o jogo comeca direto.' })
    public levelSelector: Node | null = null;

    protected start() {
        // Botao do inventario de power-ups no menu principal (canto inferior esquerdo).
        PowerupManager.instance?.createOpenButton(this.node, -540, -255, 75);

        if (this.playButton) {
            this.playButton.node.on(Button.EventType.CLICK, this.onPlayClicked, this);
        }
    }

    private onPlayClicked() {
        SoundManager.playMenuClick();
        if (this.levelSelector) {
            this.levelSelector.active = true;
            this.node.active = false;
        } else if (GameManager.instance) {
            GameManager.instance.BeginPlay();
        }
    }
}
