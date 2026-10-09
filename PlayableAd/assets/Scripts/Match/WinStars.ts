import { _decorator, Component, Sprite, Vec3, Color, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;
import { GameManager } from './GameManager';
import { SoundManager } from './SoundManager';

/** Na tela de vitoria: acende so as estrelas ganhas nesta partida (as demais ficam apagadas). */
@ccclass('WinStars')
export class WinStars extends Component {

    @property({ tooltip: 'Cor das estrelas nao conquistadas.' })
    public emptyColor: Color = new Color(60, 60, 60, 170);

    @property({ tooltip: 'Atraso (s) ate a primeira estrela conquistada aparecer com o pulso.' })
    public popDelay: number = 0.35;

    @property({ tooltip: 'Intervalo (s) entre os pulsos das estrelas conquistadas.' })
    public popInterval: number = 0.18;

    protected start() {
        const earned = Math.max(0, Math.min(3, GameManager.lastStars));
        const sprites = this.getComponentsInChildren(Sprite);

        sprites.forEach((sprite, i) => {
            if (i >= earned) {
                sprite.color = this.emptyColor;
                return;
            }
            const node = sprite.node;
            const base = node.scale.clone();
            Tween.stopAllByTarget(node);
            node.setScale(0, 0, base.z);
            tween(node)
                .delay(this.popDelay + this.popInterval * i)
                .call(() => SoundManager.playStarsWon())
                .to(0.18, { scale: new Vec3(base.x * 1.3, base.y * 1.3, base.z) }, { easing: 'quadOut' })
                .to(0.12, { scale: base })
                .start();
        });
    }
}
