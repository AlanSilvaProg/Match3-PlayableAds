import { _decorator, Component, Vec3, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;

/** Animacao simples e continua para logos: flutua suavemente e balanca de leve (nao mexe na escala). */
@ccclass('LogoAnimation')
export class LogoAnimation extends Component {

    @property({ tooltip: 'Altura (px) da flutuacao vertical.' })
    public floatHeight: number = 10;

    @property({ tooltip: 'Duracao (s) de meio ciclo da flutuacao.' })
    public floatDuration: number = 1.2;

    @property({ tooltip: 'Angulo (graus) do balanco lateral.' })
    public swayAngle: number = 3;

    @property({ tooltip: 'Duracao (s) de meio ciclo do balanco.' })
    public swayDuration: number = 1.6;

    private basePosition: Vec3 = new Vec3();
    private floatTween: Tween<any> | null = null;
    private swayTween: Tween<any> | null = null;

    protected onEnable() {
        this.basePosition.set(this.node.position);
        const base = this.basePosition;
        const up = new Vec3(base.x, base.y + this.floatHeight, base.z);

        this.floatTween = tween(this.node)
            .to(this.floatDuration, { position: up }, { easing: 'sineInOut' })
            .to(this.floatDuration, { position: base }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        this.swayTween = tween(this.node)
            .to(this.swayDuration, { eulerAngles: new Vec3(0, 0, this.swayAngle) }, { easing: 'sineInOut' })
            .to(this.swayDuration, { eulerAngles: new Vec3(0, 0, -this.swayAngle) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    protected onDisable() {
        this.floatTween?.stop();
        this.swayTween?.stop();
        this.floatTween = null;
        this.swayTween = null;
        this.node.setPosition(this.basePosition);
        this.node.setRotationFromEuler(0, 0, 0);
    }
}
