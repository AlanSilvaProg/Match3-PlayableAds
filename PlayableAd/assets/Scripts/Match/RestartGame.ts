import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RestartGame')
export class RestartGame extends Component {

    public Restart() {
        director.loadScene(director.getScene().name);
    }
}
