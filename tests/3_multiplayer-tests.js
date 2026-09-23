const chai = require('chai');
const assert = chai.assert;
const ioClient = require('socket.io-client');
const server = require('../server');

const port = server.server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

function connectClient() {
  return new Promise((resolve, reject) => {
    const client = ioClient(baseUrl, {
      forceNew: true,
      transports: ['websocket']
    });
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('Timed out waiting for Socket.io init event'));
    }, 3000);

    client.once('connect_error', error => {
      clearTimeout(timeout);
      client.close();
      reject(error);
    });
    client.once('init', state => {
      clearTimeout(timeout);
      resolve({ client, state });
    });
  });
}

function waitForEvent(client, event, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.removeListener(event, onEvent);
      reject(new Error(`Timed out waiting for ${event} event`));
    }, 3000);

    function onEvent(payload) {
      if (predicate && !predicate(payload)) return;
      clearTimeout(timeout);
      client.removeListener(event, onEvent);
      resolve(payload);
    }

    client.on(event, onEvent);
  });
}

suite('Multiplayer Integration Tests', () => {
  let first;
  let second;

  suiteSetup(done => {
    connectClient()
      .then(result => {
        first = result;
        return connectClient();
      })
      .then(result => {
        second = result;
        done();
      })
      .catch(done);
  });

  test('multiple clients receive unique players and a collectible', () => {
    assert.instanceOf(server.gameState.players.get(first.state.id), Object);
    assert.equal(server.gameState.players.get(first.state.id).constructor.name, 'Player');
    assert.isString(first.state.id);
    assert.isString(second.state.id);
    assert.notEqual(first.state.id, second.state.id);
    assert.instanceOf(server.gameState.collectible, Object);
    assert.equal(server.gameState.collectible.constructor.name, 'Collectible');
    assert.isObject(first.state.collectible);
    assert.property(first.state.collectible, 'value');
    assert.property(first.state.collectible, 'x');
    assert.property(first.state.collectible, 'y');
  });

  test('a client movement is synchronized by the server', () => {
    const player = server.gameState.players.get(first.state.id);
    const initialX = player.x;
    const statePromise = waitForEvent(
      first.client,
      'state',
      state => state.players.some(item => item.id === first.state.id && item.x > initialX)
    );

    first.client.emit('move-player', { direction: 'right', pressed: true });
    return statePromise.then(() => {
      first.client.emit('move-player', { direction: 'right', pressed: false });
      player.keys.clear();
    });
  });

  test('collecting an item increases the authoritative player score', () => {
    const player = server.gameState.players.get(first.state.id);
    const item = server.gameState.collectible;
    const initialScore = player.score;

    player.keys.clear();
    player.x = item.x;
    player.y = item.y;

    return waitForEvent(
      first.client,
      'state',
      state => state.players.some(itemState => (
        itemState.id === first.state.id && itemState.score > initialScore
      ))
    );
  });

  test('disconnecting a client removes it from other clients', () => {
    const removed = waitForEvent(
      first.client,
      'remove-player',
      id => id === second.state.id
    );
    second.client.disconnect();

    return removed.then(() => {
      assert.isFalse(server.gameState.players.has(second.state.id));
    });
  });

  suiteTeardown(() => {
    if (first && first.client.connected) first.client.disconnect();
    if (second && second.client.connected) second.client.disconnect();
    server.gameState.close();
  });
});
