import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MatchCounterUI')
export class MatchCounterUI extends Component {

    @property(Label)
    public label: Label = null!;

    public updateCount(count: number) {
        if (this.label) {
            this.label.string = count.toString();
        }
    }
}
