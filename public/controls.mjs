const keyDirections = new Map([
  ['w', 'up'],
  ['ArrowUp', 'up'],
  ['s', 'down'],
  ['ArrowDown', 'down'],
  ['a', 'left'],
  ['ArrowLeft', 'left'],
  ['d', 'right'],
  ['ArrowRight', 'right']
]);

const controls = (player, socket) => {
  const pressed = new Set();

  const emitMovement = (direction, isPressed) => {
    player.movementDirection[direction] = isPressed;
    socket.emit('move-player', { direction, pressed: isPressed });
  };

  const onKeyDown = event => {
    const direction = keyDirections.get(event.key);
    if (!direction) return;

    event.preventDefault();
    if (pressed.has(direction)) return;
    pressed.add(direction);
    emitMovement(direction, true);
  };

  const onKeyUp = event => {
    const direction = keyDirections.get(event.key);
    if (!direction) return;

    event.preventDefault();
    pressed.delete(direction);
    emitMovement(direction, false);
  };

  const onBlur = () => {
    for (const direction of pressed) emitMovement(direction, false);
    pressed.clear();
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    onBlur();
  };
};

export default controls;
