import { SoundManager } from './SoundManager';
import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;
import { GameManager } from './GameManager';
import { PokiService } from './PokiService';

/**
 * Botao da tela de derrota (anuncio com recompensa). Na 1a fase do nivel ele CONTINUA a partida de onde parou (+tempo);
 * da 2a fase em diante volta ao CHECKPOINT (comeco da fase atual). Os textos ficam em WinRewards.setupFail.
 */
@ccclass('ReviveButton')
export class ReviveButton extends Component {

    private busy: boolean = false;

    protected onEnable() {
        // So uma vez por nivel.
        if (GameManager.instance && GameManager.instance.hasRevived) {
            this.node.active = false;
        }
    }

    public Revive() {
        if (this.busy) return;
        this.busy = true;
        SoundManager.playMenuClick();
        PokiService.rewardedBreak().then(ok => {
            const gm = GameManager.instance;
            if (ok && gm) {
                if (gm.phaseIndex === 0) gm.Revive(); else gm.RetryFromCheckpoint();
            } else {
                this.busy = false;
            }
        });
    }
}
