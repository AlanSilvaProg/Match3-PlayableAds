import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TimedAutoDestroy')
export class TimedAutoDestroy extends Component {

    @property
    public duration: number = 2.0;

    protected start() {
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, this.duration);
    }
}
