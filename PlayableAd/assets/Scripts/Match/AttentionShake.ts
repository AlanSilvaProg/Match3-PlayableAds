import { _decorator, Component, Node, Vec3, tween, Tween, input, Input } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Chama a atencao do jogador balancando o no quando ele fica um tempo sem interagir.
 * Repete a cada `repeatInterval` segundos ate qualquer toque/clique (que reinicia a espera).
 */
@ccclass('AttentionShake')
export class AttentionShake extends Component {

    @property({ tooltip: 'Segundos sem interacao ate o primeiro shake.' })
    public idleDelay: number = 3;

    @property({ tooltip: 'Segundos entre um shake e o proximo enquanto o jogador nao interage.' })
    public repeatInterval: number = 3;

    @property({ tooltip: 'Angulo maximo (graus) do balanco.' })
    public angle: number = 10;

    @property({ tooltip: 'Deslocamento horizontal maximo (px) do balanco.' })
    public offset: number = 6;

    @property({ tooltip: 'Numero de oscilacoes por shake.' })
    public shakes: number = 5;

    @property({ tooltip: 'Duracao (s) de uma oscilacao completa.' })
    public stepDuration: number = 0.07;

    private idleTime: number = 0;
    private basePosition: Vec3 = new Vec3();
    private shaking: boolean = false;

    protected onEnable() {
        this.idleTime = 0;
        this.shaking = false;
        input.on(Input.EventType.TOUCH_START, this.onInteraction, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onInteraction, this);
    }

    protected onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onInteraction, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onInteraction, this);
        this.stopShake();
    }

    protected update(dt: number) {
        if (this.shaking) return;

        this.idleTime += dt;
        if (this.idleTime >= this.idleDelay) {
            this.idleTime = this.idleDelay - this.repeatInterval;
            this.playShake();
        }
    }

    private onInteraction() {
        this.idleTime = 0;
    }

    private playShake() {
        this.shaking = true;
        this.basePosition.set(this.node.position);

        const a = this.angle, o = this.offset, d = this.stepDuration;
        const base = this.basePosition;
        let t = tween(this.node);
        for (let i = 0; i < this.shakes; i++) {
            const sign = i % 2 === 0 ? 1 : -1;
            const fade = 1 - i / (this.shakes + 1);
            t = t.to(d, {
                eulerAngles: new Vec3(0, 0, a * sign * fade),
                position: new Vec3(base.x + o * sign * fade, base.y, base.z),
            });
        }
        t.to(d, { eulerAngles: Vec3.ZERO, position: base })
            .call(() => { this.shaking = false; })
            .start();
    }

    private stopShake() {
        if (!this.shaking) return;
        Tween.stopAllByTarget(this.node);
        this.node.setPosition(this.basePosition);
        this.node.setRotationFromEuler(0, 0, 0);
        this.shaking = false;
    }
}
