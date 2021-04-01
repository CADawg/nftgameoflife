var express = require('express');
var router = express.Router();
const fs = require("fs");
const path = require("path");
const CanvasGifEncoder = require('gif-encoder-2');
const {createCanvas} = require('canvas');
const crypto = require("crypto");

router.get('/image/:id', async function(req, res, ignored) {
  let nftId = req.params.id;

  nftId = nftId.replace(".gif","");

  try {
    if (parseInt(nftId).toString() !== nftId) {
      res.status(404);
      res.write("Not Found.")
      res.end();
      return "";
    }
  } catch (ignoredError) {
    res.status(404);
    res.write("Not Found.")
    res.end();
    return "";
  }

  if (fs.existsSync(path.join(__dirname, "..", "images", nftId + ".gif"))) {
    res.sendFile(path.join(__dirname, "..", "images", nftId + ".gif"));
  } else {
    // OUTPUTS (not caps as they aren't settings for the user)
    const canvas = createCanvas(484, 484);
    const context = canvas.getContext("2d");
    const encoder = new CanvasGifEncoder(484, 484);
    encoder.setDelay(200);
    encoder.start();

    let sameInARow = 0;

    function hex2bin(hex){
      hex = hex.replace("0x", "").toLowerCase();
      let out = "";
      for(let c of hex) {
        switch(c) {
          case '0': out += "0000"; break;
          case '1': out += "0001"; break;
          case '2': out += "0010"; break;
          case '3': out += "0011"; break;
          case '4': out += "0100"; break;
          case '5': out += "0101"; break;
          case '6': out += "0110"; break;
          case '7': out += "0111"; break;
          case '8': out += "1000"; break;
          case '9': out += "1001"; break;
          case 'a': out += "1010"; break;
          case 'b': out += "1011"; break;
          case 'c': out += "1100"; break;
          case 'd': out += "1101"; break;
          case 'e': out += "1110"; break;
          case 'f': out += "1111"; break;
          default: return "";
        }
      }

      return out;
    }

    function sha512(str) {
      return crypto.createHash('sha512').update(str).digest('hex');
    }

      let GAME_ID = nftId;

      const GAME_HASH = await sha512(GAME_ID);

      let GAME_BINARY = hex2bin(GAME_HASH.toString(), 16);



// VISUAL SETTINGS
      const GRID_SIZE = 22;
      const PIXEL_SIZE = 22;
      const GAME_FPS = 100;

// GAMEPLAY SETTINGS
      const GAME_MAX_NEIGHBORS = 3;
      const GAME_MIN_NEIGHBORS = 2;
      const GAME_SPAWN_NEIGHBORS = 3;

      const COLOR_CAP = 200;

      const CANVAS_SIZE = GRID_SIZE * PIXEL_SIZE;


      let grids = await grid_from_binary(GRID_SIZE, GAME_BINARY);

      let myGrid = grids[0];
      let colorGrid = grids[1];

      let si = setInterval(render,1000/GAME_FPS);

      context.fillStyle = "rgba(255,255,255,1)";
      context.fillRect( 0, 0, CANVAS_SIZE, CANVAS_SIZE);

      let frameCounter = 0;

      function render() {
        if (frameCounter > 50 || sameInARow > 6) {
          clearInterval(si);
          encoder.finish();
          const buffer = encoder.out.getData();
          res.end(buffer);
          fs.writeFile(path.join(__dirname, "..", "images", nftId + ".gif"), buffer, (ignored => {}));
        } else {
          draw_game(myGrid);
          encoder.addFrame(context);
          let lastGrid = JSON.stringify(myGrid);
          myGrid = update_grid(myGrid);
          if (JSON.stringify(myGrid) === lastGrid) {
            sameInARow++;
          }
          frameCounter++;
        }
      }

      function draw_game(grid) {
        for (let y = 0; y < grid.length; y++) {
          for (let x = 0; x < grid[y].length; x++) {
            set_pixel(grid[y][x], x, y);
          }
        }
      }

      async function grid_from_binary(grid_size, binary) {
        let grid = [];
        let colorGrid = [];
        let counter = 0;
        for (let y = 0; y < grid_size; y++) {
          grid.push([]);
          colorGrid.push([]);
          for (let x = 0; x < grid_size; x++) {
            counter = counter % binary.length;

            grid[y].push(binary[counter] === "1");
            let color = await sha512("".concat(x.toString(), ",", y.toString(), "-", GAME_ID));
            let r = parseInt(color.substr(0,2), 16) % COLOR_CAP;
            let g = parseInt(color.substr(2,2), 16) % COLOR_CAP;
            let b = parseInt(color.substr(4,2), 16) % COLOR_CAP;
            colorGrid[y].push({r, g, b});
            counter++;
          }
        }

        return [grid, colorGrid];
      }

// Sets "pixels" on the canvas
      function set_pixel(value, x, y) {
        let r = 255;
        let g = 255;
        let b = 255;

        if (value) {
          r = colorGrid[y][x].r;
          g = colorGrid[y][x].g;
          b = colorGrid[y][x].b;
        }

        let a = 1;
        context.fillStyle = "rgba("+r+","+g+","+b+","+a+")";
        context.fillRect( x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE - 1, PIXEL_SIZE - 1);
      }

      function block_is_alive(grid, x, y) {
        if (x < 0 || x >= GRID_SIZE) return false;
        if (y < 0 || y >= GRID_SIZE) return false;

        return (grid[y][x] || false);
      }

      function live_neighbors(grid, x,y) {
        let lives = 0;
        for (let yc = y - 1; yc <= y + 1; yc++) {
          for (let xc = x - 1; xc <= x + 1; xc++) {
            if (yc === 0 && xc === 0) continue;
            if (block_is_alive(grid, xc, yc)) {
              lives += 1;
            }
          }
        }
        return lives;
      }

      function update_grid(grid){
        let new_grid = [];
        let liveNeighbours = 0;
        for (let yc = 0; yc < GRID_SIZE; yc++){
          new_grid[yc] = [];
          for (let xc = 0; xc < GRID_SIZE; xc++){
            liveNeighbours = live_neighbors(grid, xc, yc);

            new_grid[yc][xc] = grid[yc][xc]
            if ((liveNeighbours < GAME_MIN_NEIGHBORS) || (liveNeighbours > GAME_MAX_NEIGHBORS)) {
              // kill our little friend
              new_grid[yc][xc] = 0;
            }

            if (liveNeighbours === GAME_SPAWN_NEIGHBORS){
              // welcome back to life, little pixel!
              new_grid[yc][xc] = 1;
            }
          }
        }
        return new_grid;
      }
  }
})

module.exports = router;
