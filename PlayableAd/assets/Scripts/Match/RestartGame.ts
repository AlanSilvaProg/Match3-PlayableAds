import { SoundManager } from './SoundManager';
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;
import { GameManager } from './GameManager';

@ccclass('RestartGame')
export class RestartGame extends Component {

    private busy: boolean = false;

    public Restart() {
        if (this.busy) return;
        this.busy = true;
        SoundManager.playMenuClick();

        GameManager.skipMenuOnLoad = true;
        // Anuncio da Poki entre niveis, depois recarrega a cena.
        GameManager.reloadWithBreak().then(ok => {
            if (!ok) {
                GameManager.skipMenuOnLoad = false;
                this.busy = false;
            }
        });
    }
}
