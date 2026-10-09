import { SoundManager } from './SoundManager';
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;
import { GameManager } from './GameManager';

/**
 * Recarrega a cena abrindo direto o seletor de niveis. Sem commercialBreak: a Poki so quer o intervalo comercial
 * quando o jogador volta para o gameplay (ele acontece ao escolher o nivel no seletor).
 */
@ccclass('ReturnToLevels')
export class ReturnToLevels extends Component {

    private busy: boolean = false;

    public GoToLevels() {
        if (this.busy) return;
        this.busy = true;
        SoundManager.playMenuClick();

        GameManager.showSelectorOnLoad = true;
        if (!GameManager.reloadScene()) {
            GameManager.showSelectorOnLoad = false;
            this.busy = false;
        }
    }
}
