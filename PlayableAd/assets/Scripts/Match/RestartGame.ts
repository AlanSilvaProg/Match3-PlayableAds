import { SoundManager } from './SoundManager';
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;
import { GameManager } from './GameManager';
import { LevelSelector } from './LevelSelector';

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

    /**
     * Tela de vitoria: joga o PROXIMO nivel direto (sem passar pela selecao). Se o proximo ainda estiver bloqueado
     * (faltam estrelas), o botao vira "RESTART" e repete o nivel atual.
     */
    public NextLevel() {
        if (this.busy) return;
        this.busy = true;
        SoundManager.playMenuClick();

        const previous = GameManager.currentLevel;
        const selector = GameManager.instance?.levelSelector?.getComponent(LevelSelector);
        const next = previous + 1;
        if (selector && selector.isUnlocked(next)) GameManager.currentLevel = next;

        GameManager.skipMenuOnLoad = true;
        // Anuncio da Poki entre niveis (vai para o gameplay), depois recarrega a cena ja no nivel escolhido.
        GameManager.reloadWithBreak().then(ok => {
            if (!ok) {
                GameManager.skipMenuOnLoad = false;
                GameManager.currentLevel = previous;
                this.busy = false;
            }
        });
    }
}
