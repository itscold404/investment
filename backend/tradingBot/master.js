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
let potentialTickers = []; // Tickers to check to see if it should be bought
const ACTIVE_WORKERS = {}; // Map the ticker the worker assigned to it
const AVAILABLE_WORKERS = []; // Workers not assigned a ticker
const TRADE_UPDATE_URL = "wss://paper-api.alpaca.markets/v2/stream";

// Interval in seconds to check stocks to buy
const CHECK_STOCKS_SEC = 1;

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

  setInterval(async () => {
    fillWorkers(potentialTickers);
  }, CHECK_STOCKS_SEC * 1000);
}

//------------------------------------------------------------------------------
// Make the worker available to work on a different ticker
// \param string tickerSymbol: the ticker that the worker working on it should
// be freed from
//------------------------------------------------------------------------------
function freeWorker(tickerSymbol) {
  AVAILABLE_WORKERS.push(ACTIVE_WORKERS[tickerSymbol]);
  delete ACTIVE_WORKERS[tickerSymbol];
}

//------------------------------------------------------------------------------
// Assign a ticker to a worker
// \param string tickerSymbol: the ticker that the worker should buy
// \param Worker worker: the worker to assign to
//------------------------------------------------------------------------------
function assignTickerToWorker(tickerSymbol, worker) {
  worker.postMessage({ buy: tickerSymbol }); // should this be acked in workers?
  ACTIVE_WORKERS[tickerSymbol] = worker;
}

//------------------------------------------------------------------------------
// Initialize websocket for listening to trade updates. Handle workers
// according to the trade updates
//------------------------------------------------------------------------------
async function startAlpacaWebsocket() {
  const ws = await createAlpacaWebsocket(TRADE_UPDATE_URL);

  ws.on("message", async (d) => {
    const message = JSON.parse(d);
    // console.log(message);
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

      // Make the worker available if:
      // 1) ticker order is canceled
      // 2) ticker is completly sold
      if (
        (side === "sell" && event === "fill") ||
        (side === "buy" && event === "canceled")
      ) {
        console.log(symbol, "worker freed");
        freeWorker(symbol);
      }
    }
  });
}

//------------------------------------------------------------------------------
// Create a worker
//------------------------------------------------------------------------------
async function createWorker() {
  return new Promise((resolve, reject) => {
    const wkr = new Worker("./worker.js", {
      workerData: {
        budget: budgetPerTicker,
        maxAtrMultiplier: MAX_ATR_MULTIPLIER,
        cancelPeriod: CANCEL_ORDER_PERIOD,
      },
    });

    // Check if worker is ready
    wkr.once("message", (msg) => {
      console.log(msg);
      if (msg.status === "ready") {
        resolve(wkr);
      } else {
        reject(new Error("Could not create worker"));
      }
    });

    wkr.on("message", (msg) => {
      // TODO: accept messages from workers
    });

    wkr.on("error", (msg) => {
      // How to figure out which worker crashed?
      // TODO: free worker that crashed
    });

    wkr.on("exit", (code) => {
      // How to figure out which worker crashed?
      // TODO: free worker that crashed
    });
  });
}

//------------------------------------------------------------------------------
// Assign tickers to workers if not all workers are put to work
// \param array<string> tickerList: array of tickers buy from
//------------------------------------------------------------------------------
async function fillWorkers(tickerList) {
  let countActiveWkrs = Object.keys(ACTIVE_WORKERS).length;

  if (countActiveWkrs + AVAILABLE_WORKERS.length > MAX_WORKERS) {
    // TODO: handle this case?
    console.error("OOPS!! More total workers than we hired :/");
  }

  // Assign tickers to available workers first before creating new ones
  while (AVAILABLE_WORKERS.length > 0) {
    if (tickerList.length > 0) {
      const tickerToBuy = tickerList[0];

      // Assign the first available worker the first stock
      // and remove it from the available workers array
      assignTickerToWorker(tickerToBuy, AVAILABLE_WORKERS[0]);
      AVAILABLE_WORKERS.shift();

      tickerList.shift();
      ++countActiveWkrs;
    } else {
      break;
    }
  }

  // Create new workers if needed and assign them a ticker
  while (countActiveWkrs < MAX_WORKERS) {
    if (tickerList.length > 0) {
      const tickerToBuy = tickerList[0];
      const wkr = await createWorker(tickerToBuy);
      console.log("worker created", tickerToBuy);
      assignTickerToWorker(tickerToBuy, wkr);
      tickerList.shift();
      ++countActiveWkrs;
    } else {
      break;
    }
  }
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
