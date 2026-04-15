import { _decorator, Component, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('OpenURL')
export class OpenURL extends Component {

    @property
    public url: string = "https://www.google.com";

    public CallExternalUrl() {
        if (this.url) {
            console.log("Opening URL: ", this.url);
            sys.openURL(this.url);
        }
    }
}
