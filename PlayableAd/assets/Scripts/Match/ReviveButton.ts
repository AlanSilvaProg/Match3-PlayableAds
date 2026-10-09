import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;
import { GameManager } from './GameManager';
import { PokiService } from './PokiService';

/** Botao da tela de derrota: assistir anuncio com recompensa para continuar a partida de onde parou. */
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
        PokiService.rewardedBreak().then(ok => {
            if (ok && GameManager.instance) {
                GameManager.instance.Revive();
            } else {
                this.busy = false;
            }
        });
    }
}
