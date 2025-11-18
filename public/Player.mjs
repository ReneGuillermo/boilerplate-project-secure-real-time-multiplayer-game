class Player {
  constructor({ id, x, y, score, radius = 20 }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.score = score;
    this.radius = radius;
  }

  movePlayer(dir, speed) {
    switch (dir) {
      case 'up':
        this.y -= speed;
        break;
      case 'down':
        this.y += speed;
        break;
      case 'left':
        this.x -= speed;
        break;
      case 'right':
        this.x += speed;
        break;
    }
  }

  collision(item) {
    const distanceX = this.x - item.x;
    const distanceY = this.y - item.y;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    const itemRadius = item.radius || 10;

    return distance <= (this.radius + itemRadius);
  }

  calculateRank(arr) {
    const sortedPlayers = [...arr].sort((a, b) => {
      return b.score - a.score;
    });

    const playerIndex = sortedPlayers.findIndex(p => p.id === this.id);
    const currentRank = playerIndex + 1;
    const totalPlayers = sortedPlayers.length;

    return `Rank: ${currentRank}/${totalPlayers}`;
  }
}

export default Player;