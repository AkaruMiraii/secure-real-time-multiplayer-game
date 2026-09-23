import Player from './Player.mjs';
import Collectible from './Collectible.mjs';
import controls from './controls.mjs';
import { canvasCalcs } from './canvas-data.mjs';

const socketFactory = window.io;
if (typeof socketFactory !== 'function') {
  throw new Error('Socket.io client is unavailable');
}
const socket = socketFactory({ transports: ['websocket', 'polling'] });
const canvas = document.getElementById('game-window');
const context = canvas.getContext('2d');
const connectionStatus = document.getElementById('connection-status');
const rankStatus = document.getElementById('rank-status');
const scoreStatus = document.getElementById('score-status');
const playerStatus = document.getElementById('player-status');

let mainPlayer;
let players = [];
let item;
let animationFrame;
let stopControls;

function setStatus(element, value) {
  if (element) element.textContent = value;
}

function drawBackground() {
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#475569';
  context.lineWidth = 2;
  context.strokeRect(
    canvasCalcs.playFieldMinX,
    canvasCalcs.playFieldMinY,
    canvasCalcs.playFieldWidth,
    canvasCalcs.playFieldHeight
  );
}

function drawHud() {
  context.fillStyle = '#e2e8f0';
  context.font = '14px system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText('WASD / Arrow keys to move', 18, 27);
  context.textAlign = 'center';
  context.font = 'bold 18px system-ui, sans-serif';
  context.fillText('COIN RACE', canvas.width / 2, 28);
  context.textAlign = 'right';
  context.font = '14px system-ui, sans-serif';
  context.fillText(mainPlayer ? mainPlayer.calculateRank(players) : 'Rank: -/-', 622, 27);
}

function render() {
  drawBackground();
  drawHud();
  players.forEach(player => player.draw(context));
  if (item) item.draw(context);
  animationFrame = requestAnimationFrame(render);
}

function updatePlayers(serverPlayers, mainId) {
  const existingPlayers = new Map(players.map(player => [player.id, player]));

  players = serverPlayers.map(playerData => {
    const player = existingPlayers.get(playerData.id) || new Player(playerData);
    player.x = playerData.x;
    player.y = playerData.y;
    player.w = playerData.w;
    player.h = playerData.h;
    player.score = playerData.score;
    player.isMain = playerData.id === mainId;
    return player;
  });

  mainPlayer = players.find(player => player.id === mainId) || mainPlayer;
  setStatus(playerStatus, `${players.length} connected`);
  if (mainPlayer) {
    setStatus(scoreStatus, `Score: ${mainPlayer.score}`);
    setStatus(rankStatus, mainPlayer.calculateRank(players));
  }
}

socket.on('connect', () => {
  setStatus(connectionStatus, 'Connected');
});

socket.on('connect_error', () => {
  setStatus(connectionStatus, 'Connection error');
});

socket.on('init', ({ id, player, players: remotePlayers, collectible }) => {
  item = new Collectible(collectible);
  updatePlayers([...remotePlayers, player], id);
  stopControls = controls(mainPlayer, socket);
  render();
});

socket.on('state', state => {
  if (!mainPlayer) return;
  updatePlayers(state.players, mainPlayer.id);
  item = new Collectible(state.collectible);
});

socket.on('new-player', player => {
  if (!players.some(current => current.id === player.id)) {
    updatePlayers([...players.map(current => ({
      id: current.id,
      x: current.x,
      y: current.y,
      w: current.w,
      h: current.h,
      score: current.score
    })), player], mainPlayer && mainPlayer.id);
  }
});

socket.on('remove-player', id => {
  players = players.filter(player => player.id !== id);
  setStatus(playerStatus, `${players.length} connected`);
});

socket.on('collectible-collected', ({ player, collectible }) => {
  item = new Collectible(collectible);
  const scoringPlayer = players.find(current => current.id === player.id);
  if (scoringPlayer) scoringPlayer.score = player.score;
});

window.addEventListener('beforeunload', () => {
  if (stopControls) stopControls();
  cancelAnimationFrame(animationFrame);
  socket.disconnect();
});
