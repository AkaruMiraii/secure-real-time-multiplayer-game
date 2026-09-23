require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const socket = require('socket.io');
const PlayerModule = require('./public/Player.mjs');
const CollectibleModule = require('./public/Collectible.mjs');
const Player = PlayerModule.default || PlayerModule;
const Collectible = CollectibleModule.default || CollectibleModule;

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

app.use((req, res, next) => {
  if (typeof res._headers === 'undefined') {
    Object.defineProperty(res, '_headers', {
      configurable: true,
      enumerable: false,
      get: () => res.getHeaders()
    });
  }

  next();
});

app.use(helmet({
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: { setTo: 'PHP 7.4.3' }
}));
app.use((req, res, next) => {
  res.set({
    'Surrogate-Control': 'no-store',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  next();
});
app.use(cors({ origin: '*' }));

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));
app.use(bodyParser.json({ limit: '32kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '32kb' }));

app.route('/').get((req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

fccTestingRoutes(app);

app.use((req, res) => {
  res.status(404).type('text').send('Not Found');
});

const portNum = Number(process.env.PORT) || 3000;
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(() => {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

const io = socket(server);

const CANVAS = Object.freeze({
  width: 640,
  height: 480,
  minX: 5,
  minY: 45,
  maxX: 605,
  maxY: 445,
  playerWidth: 30,
  playerHeight: 30,
  collectibleWidth: 15,
  collectibleHeight: 15,
  speed: 5
});
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const players = new Map();
let collectibleSequence = 0;
let collectible = createCollectible();

function createId(prefix) {
  collectibleSequence += 1;
  return `${prefix}-${Date.now()}-${collectibleSequence}`;
}

function randomPosition(min, max, size) {
  return Math.floor(Math.random() * (max - min - size + 1)) + min;
}

function createCollectible() {
  const roll = Math.random();
  return new Collectible({
    id: createId('collectible'),
    x: randomPosition(CANVAS.minX, CANVAS.maxX, CANVAS.collectibleWidth),
    y: randomPosition(CANVAS.minY, CANVAS.maxY, CANVAS.collectibleHeight),
    w: CANVAS.collectibleWidth,
    h: CANVAS.collectibleHeight,
    value: roll < 0.6 ? 1 : roll < 0.85 ? 2 : 3
  });
}

function createPlayer(id) {
  return new Player({
    id,
    x: randomPosition(CANVAS.minX, CANVAS.maxX, CANVAS.playerWidth),
    y: randomPosition(CANVAS.minY, CANVAS.maxY, CANVAS.playerHeight),
    w: CANVAS.playerWidth,
    h: CANVAS.playerHeight,
    score: 0
  });
}

function publicPlayer(player) {
  return {
    id: player.id,
    x: player.x,
    y: player.y,
    w: player.w,
    h: player.h,
    score: player.score
  };
}

function publicState() {
  return {
    players: Array.from(players.values(), publicPlayer),
    collectible: { ...collectible }
  };
}

function movePlayer(player, direction) {
  if (direction === 'up') player.y = Math.max(CANVAS.minY, player.y - CANVAS.speed);
  if (direction === 'down') player.y = Math.min(CANVAS.maxY, player.y + CANVAS.speed);
  if (direction === 'left') player.x = Math.max(CANVAS.minX, player.x - CANVAS.speed);
  if (direction === 'right') player.x = Math.min(CANVAS.maxX, player.x + CANVAS.speed);
}

function collides(player, item) {
  return (
    player.x < item.x + item.w &&
    player.x + player.w > item.x &&
    player.y < item.y + item.h &&
    player.y + player.h > item.y
  );
}

function replaceCollectible() {
  const previousId = collectible.id;
  do {
    collectible = createCollectible();
  } while (collectible.id === previousId);
}

function broadcastState() {
  io.emit('state', publicState());
}

io.on('connection', client => {
  const player = createPlayer(client.id);
  players.set(client.id, player);

  const otherPlayers = Array.from(players.values())
    .filter(current => current.id !== client.id)
    .map(publicPlayer);

  client.emit('init', {
    id: player.id,
    player: publicPlayer(player),
    players: otherPlayers,
    collectible: { ...collectible }
  });
  client.broadcast.emit('new-player', publicPlayer(player));
  broadcastState();

  client.on('move-player', payload => {
    const direction = typeof payload === 'string' ? payload : payload && payload.direction;
    const pressed = typeof payload === 'object' ? payload.pressed !== false : true;
    if (!DIRECTIONS.has(direction)) return;

    if (pressed) player.keys.add(direction);
    else player.keys.delete(direction);
  });

  client.on('stop-player', direction => {
    if (DIRECTIONS.has(direction)) player.keys.delete(direction);
  });

  client.on('disconnect', () => {
    players.delete(client.id);
    client.broadcast.emit('remove-player', client.id);
    broadcastState();
  });
});

const gameTick = setInterval(() => {
  let stateChanged = false;

  for (const player of players.values()) {
    for (const direction of player.keys) {
      movePlayer(player, direction);
      stateChanged = true;
    }

    if (collides(player, collectible)) {
      player.score += collectible.value;
      replaceCollectible();
      io.emit('collectible-collected', {
        player: publicPlayer(player),
        collectible: { ...collectible }
      });
      stateChanged = true;
    }
  }

  if (stateChanged) broadcastState();
}, 50);
gameTick.unref();

app.gameState = {
  canvas: CANVAS,
  players,
  get collectible() {
    return collectible;
  },
  publicState,
  close() {
    clearInterval(gameTick);
    io.close();
    server.close();
  }
};
app.io = io;
app.server = server;

module.exports = app;
