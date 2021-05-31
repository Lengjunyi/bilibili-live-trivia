const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const config = require('./config.json')
const words = require('./data/cet4.json')

const { Server } = require("socket.io");
const io = new Server(server);

const fs = require("fs");

server.listen(3000, () => {
  console.log('listening on *:3000');
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


// Updates 点歌
function readAndUpdate(delay, socket) {
  fs.readFile(config['songs-info-location'], function (err, data) {
    if (err) {
        return console.error(err);
    }
    socket.emit("songs-info", data.toString());
    setTimeout(function () {
      readAndUpdate(delay, socket)
  }, delay);
  });
}

// Updates 弹幕
const axios = require("axios");
const { exit } = require('process');
var timeline = ""
var rnds = []
function crawlAndUpdate(delay, socket) {
  fs.readFile(config['danmus'], function (err, data) {
    if (err) {
        return console.error(err);
    }
    splitted = data.toString().split("\r\n")
    for (var num in splitted) {
      var message = splitted[num];
      const regex = new RegExp('(.*) : 收到彈幕:(.*) 說: (.*)');
      if (!regex.test(message)) {
        continue
      }
      var match = message.match(regex)
      if (match[1] < timeline) {
        continue;
      }
      if (match[1] == timeline) {
        if (match[2] in rnds) {
          continue;
        }
        rnds[match[2]] = true;
      }
      if (match[1] > timeline) {
        timeline = match[1]
        rnds = []
        rnds[match[2]] = true
      }
      console.log(match[2] + " " + match[3])
      socket.emit("bullet", match[2], match[3])
    }
    setTimeout(function () {
      crawlAndUpdate(delay, socket)
    }, delay);
  });
}

io.on('connection', (socket) => {
  console.log('a user connected');
  readAndUpdate(200, socket);
  crawlAndUpdate(200, socket);
  socket.on('new word', () => {
    newWord(socket);
  })
});

function newWord (socket) {
  console.log("new word request")
  var length = words.length
  var word = words[Math.floor(Math.random() * length)]
  axios.get("https://www.dictionaryapi.com/api/v3/references/learners/json/" + word.word + "?key=" + config['merriam-webster-key']).then((resp) => {
    data = resp['data'][0]['meta']['app-shortdef']['def'][0]
    console.log(data)
    console.log("new word decided: " + word.word)
    socket.emit('new word', word.word.replace(" ", ''), word.translate, data);
  }).catch((err) => {
    return console.error(err);
  });
}