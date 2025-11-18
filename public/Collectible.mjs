class Collectible {
  constructor({ id, x, y, value, radius = 10 }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = radius;
  }
}

try {
  module.exports = Collectible;
} catch (e) { }

export default Collectible;