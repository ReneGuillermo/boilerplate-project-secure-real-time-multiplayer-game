require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const expect = require("chai");
const socket = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const Collectible = require("./public/Collectible.mjs").default;
const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner.js");

const app = express();

app.use("/public", express.static(process.cwd() + "/public"));
app.use("/assets", express.static(process.cwd() + "/assets"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({ origin: "*" }));

// Comienzo del bloque de seguridad (HELMET v3.x)
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.noCache());
app.disable("x-powered-by ");
app.use(function (req, res, next) {
  res.setHeader("X-Powered-By", "PHP 7.4.3");
  next();
});

// Index page (static HTML)
app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

//For FCC testing purposes
fccTestingRoutes(app);

// 404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === "test") {
    console.log("Running Tests...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log("Tests are not valid:");
        console.error(error);
      }
    }, 1500);
  }
});

// Estructuras de Datos Globales del Juego
let PLAYERS = {};
let COLLECTIBLES = {};
let GAME_STATUS = {
  players: PLAYERS,
  collectibles: COLLECTIBLES,
};
const FRAME_RATE = 1000 / 60;

// Inicializar Socket.io
const io = socket(server);

// Lógica para generar los ítems recolectables (mínimo 1)
function createCollectible() {
  const id = Date.now().toString();
  COLLECTIBLES[id] = new Collectible({
    id: id,
    value: 1,
    x: Math.random() * 700 + 50,
    y: Math.random() * 500 + 50,
  });
}

// Generar el primer ítem al inicio
createCollectible();

// Manejador de Conexiones de Socket.io
io.on("connection", (socket) => {
  console.log("Un jugador se ha conectado:", socket.id);

  // 1.Crear un nuevo jugador y agregarlo al estado global
  PLAYERS[socket.id] = {
    id: socket.id,
    x: 100 + Math.random() * 600, // Posición inicial aleatoria
    y: 100 + Math.random() * 400,
    score: 0,
  };

  // 2. Enviar el estado inicial solo al jugador que se conecta
  socket.emit("init_state", {
    player: PLAYERS[socket.id],
    others: PLAYERS,
    collectibles: COLLECTIBLES,
  });

  // 3. Manejar la entrada de movimiento del jugador
  socket.on("movement", (data) => {
    const player = PLAYERS[socket.id] || {};
    if (player.x !== undefined) {
      switch (data.direction) {
        case "up":
          player.y -= data.amount;
          break;
        case "down":
          player.y += data.amount;
          break;
        case "left":
          player.x -= data.amount;
          break;
        case "right":
          player.x += data.amount;
          break;
      }
    }
  });

  // 4. Manejar la recolección de ítems
  socket.on("collect_item", (itemId) => {
    if (COLLECTIBLES[itemId]) {
      // Aumentar la puntuación del jugador
      PLAYERS[socket.id].score += COLLECTIBLES[itemId].value;
      // Eliminar el ítem
      delete COLLECTIBLES[itemId];
      // Generar un nuevo ítem
      createCollectible();
      // Notificar a todos que hubo una recolección para que el cliente actualice el estado
      io.emit("item_collected", {
        playerId: socket.id,
        newScore: PLAYERS[socket.id].score,
        itemId: itemId,
      });
    }
  });

  // 5. Manejar desconexión
  socket.on("disconnect", () => {
    console.log("Jugador desconectado:", socket.id);
    // Eliminar jugador de la lista
    delete PLAYERS[socket.id];
    // Notificar a todos los clientes para que remuevan el avatar
    io.emit("player_disconnected", socket.id);
  });
});

// Game Loop
setInterval(() => {
  io.sockets.emit("game_state", {
    players: PLAYERS,
    collectibles: COLLECTIBLES,
  });
}, FRAME_RATE);

// Exportar la aplicación para pruebas
module.exports = app; // For testing
