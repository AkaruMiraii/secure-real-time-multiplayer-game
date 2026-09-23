class Player {
  constructor({
    id,
    x = 10,
    y = 10,
    w = 30,
    h = 30,
    score = 0,
    main = false
  } = {}) {
    this.id = id ?? `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.x = Number.isFinite(x) ? x : 10;
    this.y = Number.isFinite(y) ? y : 10;
    this.w = Number.isFinite(w) ? w : 30;
    this.h = Number.isFinite(h) ? h : 30;
    this.score = Number.isFinite(score) ? score : 0;
    this.isMain = Boolean(main);
    this.movementDirection = {};
    this.keys = new Set();
  }

  movePlayer(dir, pixels) {
    if (!Number.isFinite(pixels)) return this;

    switch (dir) {
      case 'up':
        this.y -= pixels;
        break;
      case 'down':
        this.y += pixels;
        break;
      case 'left':
        this.x -= pixels;
        break;
      case 'right':
        this.x += pixels;
        break;
      default:
        break;
    }

    return this;
  }

  collision(item) {
    if (!item) return false;

    const itemWidth = Number.isFinite(item.w) ? item.w : 15;
    const itemHeight = Number.isFinite(item.h) ? item.h : 15;

    return (
      this.x < item.x + itemWidth &&
      this.x + this.w > item.x &&
      this.y < item.y + itemHeight &&
      this.y + this.h > item.y
    );
  }

  calculateRank(players) {
    const allPlayers = Array.isArray(players) ? players : [];
    const sortedPlayers = allPlayers.slice().sort((a, b) => {
      const scoreDifference = (Number(b.score) || 0) - (Number(a.score) || 0);
      return scoreDifference || 0;
    });
    const currentIndex = sortedPlayers.findIndex(player => (
      player === this || (this.id !== undefined && player.id === this.id)
    ));
    const rank = currentIndex === -1 ? allPlayers.length : currentIndex + 1;

    return `Rank: ${rank}/${allPlayers.length}`;
  }

  draw(context) {
    context.fillStyle = this.isMain ? '#60a5fa' : '#f472b6';
    context.fillRect(this.x, this.y, this.w, this.h);
    context.strokeStyle = '#f8fafc';
    context.lineWidth = 1;
    context.strokeRect(this.x, this.y, this.w, this.h);
  }
}

export default Player;
