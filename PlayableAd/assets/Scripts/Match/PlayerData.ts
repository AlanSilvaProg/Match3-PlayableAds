import { LevelProgress } from './LevelProgress';
import { PowerupInventory, PlayerWallet } from './PlayerInventory';
import { PlayerStats } from './PlayerStats';
import { AchievementManager } from './AchievementManager';
import { RankingManager } from './RankingManager';
import { PowerupManager } from './PowerupManager';

/**
 * Save do jogador: tudo fica no localStorage (cache rapido). Quando o jogador esta logado na Poki, o proprio SDK
 * sincroniza o localStorage com a nuvem e INJETA o save da nuvem durante o `PokiSDK.init()`. Por isso o jogo
 * espera o init e depois chama `reloadAll()`, que descarta os caches em memoria e le o localStorage de novo.
 */
export class PlayerData {

    public static reloadAll() {
        LevelProgress.reload();
        PowerupInventory.reload();
        PlayerWallet.reload();
        PlayerStats.reload();
        AchievementManager.instance?.reloadState();
        RankingManager.instance?.reloadState();
        PowerupManager.instance?.refreshBadges();
        AchievementManager.instance?.refreshOpenButtons();
    }
}
