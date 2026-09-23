class Collectible {
  constructor({ x = 10, y = 10, w = 15, h = 15, value = 1, id } = {}) {
    this.x = Number.isFinite(x) ? x : 10;
    this.y = Number.isFinite(y) ? y : 10;
    this.w = Number.isFinite(w) ? w : 15;
    this.h = Number.isFinite(h) ? h : 15;
    this.value = Number.isFinite(value) ? value : 1;
    this.id = id ?? `collectible-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  draw(context) {
    const colors = { 1: '#f59e0b', 2: '#cbd5e1', 3: '#fde047' };
    context.fillStyle = colors[this.value] || colors[1];
    context.beginPath();
    context.arc(
      this.x + this.w / 2,
      this.y + this.h / 2,
      Math.min(this.w, this.h) / 2,
      0,
      Math.PI * 2
    );
    context.fill();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Collectible;
}

export default Collectible;
