import dotevn from "dotenv";
import express from "express";
import fs from "fs";
import https from "https";
import { Worker } from "worker_threads";

import { createAlpacaWebsocket } from "../util/alpaca.js";
import { getAccountInfo } from "../util/alpaca.js";
import { keyLocation, certLocation } from "../util/certs.js";
dotevn.config({ path: "../../.env" });

//==============================================================================
// Purpose: Buys suitable stocks and distribute them to workers to manage
//==============================================================================

//------------------------------------------------------------------------------
// Constants and Globals for Workers
//------------------------------------------------------------------------------
const RATIO_ALLOCATE = 0.001; // Ratio of available cash to spend on stock
const MAX_ATR_MULTIPLIER = 3; // Maximum multiplier to ATR for calculating stop limit
const CANCEL_ORDER_PERIOD = 3000; // Miliseconds before terminating order
let budgetPerTicker = 30; // Budget per ticker

//------------------------------------------------------------------------------
// Constants and Globals for Master
//------------------------------------------------------------------------------
const MASTER_PORT = process.env.MASTER_PORT; // Port number for this service
const MAX_WORKERS = 4; // Maximum number of workers running at all times
let potentialTickers = [""]; // Tickers to check to see if it should be bough
let WORKERS = {}; // Map ticker the worker assigned to it
const AVAILABLE_WORKERS = []; // Workers not assigned a ticker
const TRADE_UPDATE_URL = "wss://paper-api.alpaca.markets/v2/stream";

// Interval in seconds to check for dead workers
const CHECK_DEAD_WORKERS_SEC = 5;

// Interval in seconds to check stocks to buy
const CHECK_STOCKS_SEC = 10;

let options = {
  key: fs.readFileSync(keyLocation),
  cert: fs.readFileSync(certLocation),
};

const app = express();
app.use(express.json());
https.createServer(options, app).listen(MASTER_PORT, () => {
  console.log(`Master running on port https://localhost:${MASTER_PORT}`);
});

//------------------------------------------------------------------------------
// Put function to update the potential tickers
//------------------------------------------------------------------------------
app.put("/updateTickers", (req, res) => {
  potentialTickers = req.body.potentialTickers;
  console.log(potentialTickers);
});

//------------------------------------------------------------------------------
// Initialize master
//------------------------------------------------------------------------------
async function initializeMaster() {
  budgetPerTicker = await budgetForTickers(RATIO_ALLOCATE);
  console.log("Budget per ticker:", budgetPerTicker);

  await startAlpacaWebsocket();
  // setInterval(async () => {
  //   checkAllAssigned();
  // }, CHECK_DEAD_WORKERS_SEC * 1000);

  setInterval(async () => {
    // if openPositions.length < MAX_WORKERS
    filterSuitableTickers(potentialTickers);
  }, CHECK_STOCKS_SEC * 1000);

  createWorker("TSLA");
  // todo: master must check if stock has an open position before assignment
}

//------------------------------------------------------------------------------
// Initialize websocket for listening to trade updates
//------------------------------------------------------------------------------
async function startAlpacaWebsocket() {
  const ws = await createAlpacaWebsocket(TRADE_UPDATE_URL);

  ws.on("message", async (d) => {
    const message = JSON.parse(d);
    console.log(message);
    if (
      message.stream === "authorization" &&
      message.data.status === "authorized"
    ) {
      console.log("Authenticated in Alpaca websocket");
      ws.send(
        JSON.stringify({
          action: "listen",
          data: {
            streams: ["trade_updates"],
          },
        })
      );
    } else if (message.stream === "trade_updates") {
      const side = message.data.order.side;
      const event = message.data.event;
      const symbol = message.data.order.symbol;
      // make the worker available if its ticker is completly sold
      if (side == "sell") {
        if (event == "fill") {
          AVAILABLE_WORKERS.push(WORKERS[symbol]);
          delete WORKERS[symbol];
        }
      }
    }
  });
}

//------------------------------------------------------------------------------
// Create workers
// \param string tickerSymbol: The ticker symbol to be managed by the
// worker
//------------------------------------------------------------------------------
async function createWorker(tickerSymbol) {
  const wkr = new Worker("./worker.js", {
    workerData: {
      ticker: tickerSymbol,
      budget: budgetPerTicker,
      maxAtrMultiplier: MAX_ATR_MULTIPLIER,
      cancelPeriod: CANCEL_ORDER_PERIOD,
    },
  });

  WORKERS[tickerSymbol] = wkr;

  wkr.on("message", (data) => {
    // TODO: handle how to handle successful selling of stock
    // 1) remove ticker but not worker from workers object (maybe need another data
    // structure to track)
    // 2) worker waits to be assigned new stock
    console.log(data);
  });

  wkr.on("error", (message) => {
    console.error(`Worker for ${tickerSymbol} crashed!`);
    console.error(message);
    WORKERS[tickerSymbol] = null;
  });

  wkr.on("exit", (code) => {
    console.log(`Worker for ${tickerSymbol} exited with code ${code}`);
    WORKERS[tickerSymbol] = null;
  });
}

//------------------------------------------------------------------------------
// Check if there are any open positions not assigned to a worker. If
// there is, create a worker to handle that position
//------------------------------------------------------------------------------
async function checkAllAssigned() {
  for (ticker in WORKERS) {
    if (!WORKERS[ticker]) createWorker(ticker);
  }
}

//------------------------------------------------------------------------------
// Check if there is enough workers. Create more workers if not
//------------------------------------------------------------------------------
async function checkNumWorkers() {
  if (WORKERS.length() < MAX_WORKERS) {
    let tempTickers = potentialTickers; // Copy in case update in the middle of logic
    let count = 0;
    while (tempTickers.length < MAX_WORKERS) {
      createWorker(ticker);
    }
  }
}

//------------------------------------------------------------------------------
// Filter for suitable stocks and buy them
// \param array<string> tickerList: array of tickers to filter though and
// potentiall buy
//------------------------------------------------------------------------------
async function filterSuitableTickers(tickerList) {
  // If open positions < MAX_WORKERS, then filter and try to buy new stocks
}

//------------------------------------------------------------------------------
// Determin budget to spend on each ticker
// \param float ratio: ratio to spend on per stock
//------------------------------------------------------------------------------
async function budgetForTickers(ratio) {
  let account = await getAccountInfo();
  let cash = account.cash;

  return cash * ratio;
}

//------------------------------------------------------------------------------
// Main Logic
//------------------------------------------------------------------------------
await initializeMaster();
