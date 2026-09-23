const canvasCalcs = Object.freeze({
  canvasWidth: 640,
  canvasHeight: 480,
  playFieldMinX: 5,
  playFieldMinY: 45,
  playFieldWidth: 630,
  playFieldHeight: 430,
  playFieldMaxX: 605,
  playFieldMaxY: 445,
  playerWidth: 30,
  playerHeight: 30
});

const generateStartPos = (min, max, size = 1) => (
  Math.floor(Math.random() * (max - min - size + 1)) + min
);

export { generateStartPos, canvasCalcs };
