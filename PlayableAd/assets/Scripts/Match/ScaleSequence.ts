import { _decorator, Component, Node, Vec3, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ScaleSequence')
export class ScaleSequence extends Component {

    @property([Node])
    public nodes: Node[] = [];

    @property(Vec3)
    public startScale: Vec3 = new Vec3(0, 0, 0);

    @property(Vec3)
    public endScale: Vec3 = new Vec3(1, 1, 1);

    @property
    public duration: number = 0.3;

    protected start(): void {
        this.ExecuteSequence();
    }

    public ExecuteSequence() {
        if (this.nodes.length === 0) return;

        this.animateNode(0);
    }

    private animateNode(index: number) {
        if (index >= this.nodes.length) return;

        const targetNode = this.nodes[index];
        if (!targetNode) {
            this.animateNode(index + 1);
            return;
        }

        targetNode.setScale(this.startScale);

        tween(targetNode)
            .to(this.duration, { scale: this.endScale })
            .call(() => {
                this.animateNode(index + 1);
            })
            .start();
    }
}
