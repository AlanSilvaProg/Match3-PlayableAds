import { Enum } from 'cc';

export enum GameState {
    Tutorial,
    Running,
    Defeat,
    Victory
}

Enum(GameState);
