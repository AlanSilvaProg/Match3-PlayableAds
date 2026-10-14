import { Enum } from 'cc';

export enum GameState {
    Tutorial,
    Running,
    Defeat,
    Victory,
    Menu,
    /** Troca de fase do nivel (itens varridos e nova leva de alimentos): tempo e cliques parados. */
    Transition
}

Enum(GameState);
