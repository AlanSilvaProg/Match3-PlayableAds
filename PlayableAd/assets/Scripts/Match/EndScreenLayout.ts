import { Node, UITransform } from 'cc';
import { Responsive } from './Responsive';

/**
 * Layout das telas de vitoria/derrota. Em paisagem usam o desenho do prefab (coluna de botoes a esquerda, logo a
 * direita); em retrato tudo vai para uma coluna central (logo, estrelas, botoes). O fundo escuro e o brilho cobrem a tela.
 */
export class EndScreenLayout {
    private static readonly SHIFT = 265; // a coluna de botoes do prefab fica em x = -265

    public static apply(screen: Node) {
        const layout = () => this.layout(screen);
        layout();
        const cb = () => {
            if (!screen.isValid) { Responsive.offChange(cb); return; }
            layout();
        };
        Responsive.onChange(cb);
    }

    private static layout(screen: Node) {
        if (!screen.isValid) return;
        const portrait = Responsive.portrait;
        ['Fade', 'WinningEffect'].forEach(name => {
            const n = screen.getChildByName(name);
            const ut = n?.getComponent(UITransform);
            if (!n || !ut) return;
            const k = Math.max(Responsive.width / 1280, Responsive.height / 720);
            ut.setContentSize(1280 * k, 720 * k);
        });

        // Posicoes do prefab (paisagem) sao guardadas na primeira passada para poder voltar.
        const orig = (n: Node): { x: number, y: number } => {
            const saved = (n as any).__endOrig;
            if (saved) return saved;
            const o = { x: n.position.x, y: n.position.y };
            (n as any).__endOrig = o;
            return o;
        };
        screen.children.forEach(c => {
            if (['Fade', 'WinningEffect', 'SFX'].indexOf(c.name) !== -1) return;
            const o = orig(c);
            // LogoAnimation guarda a posicao base no onEnable: desliga/religa em volta da mudanca para ela acompanhar.
            const anim: any = c.getComponent('LogoAnimation');
            if (anim) anim.enabled = false;
            if (!portrait) c.setPosition(o.x, o.y, c.position.z);
            else if (c.name === 'Logo') c.setPosition(0, 330, c.position.z);
            else c.setPosition(o.x + this.SHIFT, o.y, c.position.z); // coluna de botoes/estrelas vai para o centro
            if (anim) anim.enabled = true;
        });
    }
}
