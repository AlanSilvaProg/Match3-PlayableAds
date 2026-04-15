import { _decorator, Component, ParticleSystem2D } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ParticleTrigger')
export class ParticleTrigger extends Component {

    @property([ParticleSystem2D])
    public particleSystems: ParticleSystem2D[] = [];

    public TriggerParticle() {
        this.particleSystems.forEach(ps => {
            if (ps) {
                ps.resetSystem();
            }
        });

        if (this.particleSystems.length === 0) {
            console.warn("ParticleTrigger: No ParticleSystem2D assigned in the list.");
        }
    }
}
