import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import SaveSelectScene from './scenes/SaveSelectScene.js';
import MenuScene from './scenes/MenuScene.js';
import HallScene from './scenes/HallScene.js';
import GameScene from './scenes/GameScene.js';
import CaveScene from './scenes/CaveScene.js';
import MeditateScene from './scenes/MeditateScene.js';
import TetrisScene from './scenes/TetrisScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import GachaScene from './scenes/GachaScene.js';
import BagScene from './scenes/BagScene.js';
import { WIDTH, HEIGHT } from './config.js';

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a0a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  dom: {
    createContainer: true,
  },
  scene: [BootScene, SaveSelectScene, MenuScene, HallScene, GameScene, GameOverScene, CaveScene, MeditateScene, TetrisScene, GachaScene, BagScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
