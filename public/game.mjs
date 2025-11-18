import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io();
const canvas = document.getElementById('game-window');
const context = canvas.getContext('2d');

// Configuración y Estado del Juego (Local)
let myPlayer = null;
let players = {};
let collectibles = {};
const SPEED = 5;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const KEY_STATE = {};
const PLAYER_COLOR = '#007bff';
const COLLECTIBLE_COLOR = '#ffc107';

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// --Funciones de Renderizado--
// Dibuja un jugador en el Canvas
function drawPlayer(player, isLocal) {
  // Dibujar cuerpo
  context.beginPath();
  context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  context.fillStyle = isLocal ? PLAYER_COLOR : 'rgba(108, 117, 125, 0.7)';
  context.fill();
  context.strokeStyle = '#343a40';
  context.stroke();
  context.closePath();

  // Dibujar ID o Rank
  const displayString = isLocal ? `Rank: ${myPlayer.calculateRank(Object.values(players))}` : `${player.score}`;
  context.fillStyle = '#343a40';
  context.font = '12px sans-serif';
  context.textAlign = 'center';
  context.fillText(displayString, player.x, player.y - player.radius - 5);
}

// Dibuja un ítem recolectable.
function drawCollectible(item) {
  context.beginPath();
  context.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
  context.fillStyle = COLLECTIBLE_COLOR;
  context.fill();
  context.closePath();

  context.fillStyle = '#343a40';
  context.font = '10px sans-serif';
  context.textAlign = 'center';
  context.fillText(`+${item.value}`, item.x, item.y + 4);
}

// -- Bucle principal de renderizado--
function drawGame() {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = '#f8f9fa';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (!myPlayer) {
    requestAnimationFrame(drawGame);
    return;
  }

  // Dibujar Items
  for (const id in collectibles) {
    if (collectibles.hasOwnProperty(id)) {
      drawCollectible(collectibles[id]);
    }
  }

  // Dibujar Jugadores
  for (const id in players) {
    if (players.hasOwnProperty(id)) {
      const player = players[id];
      drawPlayer(player, id === myPlayer.id);
    }
  }

  // Procesar Entrada y Colisiones (enviando eventos al servidor)
  processInputAndCollisions();

  // Repetir el bucle
  requestAnimationFrame(drawGame);
}

// --- Lógica del Juego (Input y Colisiones) ---
function processInputAndCollisions() {
  if (!myPlayer) return;

  const movementData = {
    direction: null,
    amount: SPEED
  };

  // Procesar Input del Teclado y emitir intención de movimiento
  if (KEY_STATE['w'] || KEY_STATE['ArrowUp']) {
    movementData.direction = 'up';
  } else if (KEY_STATE['s'] || KEY_STATE['ArrowDown']) {
    movementData.direction = 'down';
  } else if (KEY_STATE['a'] || KEY_STATE['ArrowLeft']) {
    movementData.direction = 'left';
  } else if (KEY_STATE['d'] || KEY_STATE['ArrowRight']) {
    movementData.direction = 'right';
  }

  if (movementData.direction) {
    myPlayer.movePlayer(movementData.direction, movementData.amount);
    socket.emit('movement', movementData);
  }

  // Procesar Colisiones y emitir recolección al servidor
  for (const itemId in collectibles) {
    const item = collectibles[itemId];
    if (myPlayer.collision(item)) {
      socket.emit('collect_item', itemId);
      break;
    }
  }
}


// --- Manejo de Eventos de Teclado ---
document.addEventListener('keydown', (e) => {
  KEY_STATE[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
  KEY_STATE[e.key.toLowerCase()] = false;
});


// --- Manejo de Eventos de Socket.io (Sincronización) ---
socket.on('init_state', (data) => {
  myPlayer = new Player({
    id: data.player.id,
    x: data.player.x,
    y: data.player.y,
    score: data.player.score
  });

  // Rellenar el mapa de jugadores y ítems (creando instancias de clases)
  for (const id in data.others) {
    players[id] = new Player(data.others[id]);
  }
  for (const id in data.collectibles) {
    collectibles[id] = new Collectible(data.collectibles[id]);
  }

  console.log('Juego inicializado. Bienvenido:', myPlayer.id);

  // Iniciar el bucle de dibujo una vez que el jugador está listo
  requestAnimationFrame(drawGame);
});

// Bucle de sincronización del juego (autoridad del servidor)
socket.on('game_state', (data) => {
  for (const id in data.players) {
    const serverPlayer = data.players[id];

    if (players[id]) {
      players[id].x = serverPlayer.x;
      players[id].y = serverPlayer.y;
      players[id].score = serverPlayer.score;
    } else {
      players[id] = new Player(serverPlayer);
    }
  }

  // Si el jugador local existe, sobrescribir su posición y score para corregir predicción
  if (myPlayer) {
    const serverMyPlayer = data.players[myPlayer.id];
    if (serverMyPlayer) {
      myPlayer.x = serverMyPlayer.x;
      myPlayer.y = serverMyPlayer.y;
      myPlayer.score = serverMyPlayer.score;
    }
  }

  // Sobrescribir el estado de los ítems
  collectibles = {};
  for (const id in data.collectibles) {
    collectibles[id] = new Collectible(data.collectibles[id]);
  }

  // Limpiar jugadores que se desconectaron
  for (const id in players) {
    if (!data.players[id]) {
      delete players[id];
    }
  }
});

// Cuando otro jugador se desconecta
socket.on('player_disconnected', (id) => {
  delete players[id];
});