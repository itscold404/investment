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
let potentialTickers = ["TSLA", "INTC", "ELF"]; // Tickers to check to see if it should be bought
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
async function freeWorker(tickerSymbol) {
  AVAILABLE_WORKERS.push(ACTIVE_WORKERS[tickerSymbol]);
  delete ACTIVE_WORKERS[tickerSymbol];
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
        if (side === "sell" && event === "fill") {
          console.log(symbol, "canceled");
        }
        freeWorker(symbol);
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
  return new Promise((resolve, reject) => {
    const wkr = new Worker("./worker.js", {
      workerData: {
        ticker: tickerSymbol,
        budget: budgetPerTicker,
        maxAtrMultiplier: MAX_ATR_MULTIPLIER,
        cancelPeriod: CANCEL_ORDER_PERIOD,
      },
    });

    ACTIVE_WORKERS[tickerSymbol] = wkr;

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
      console.error(`Worker for ${tickerSymbol} crashed:`);
      console.error(msg);
      freeWorker(symbol);
    });

    wkr.on("exit", (code) => {
      console.error(`Worker for ${tickerSymbol} exited with code ${code}`);
      freeWorker(symbol);
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
      // Assign the ticker to the worker and mark the worker as "busy"
      AVAILABLE_WORKERS[0].postMessage("Buy:" + tickerToBuy); // Should I check if this message has been acked?
      ACTIVE_WORKERS[tickerToBuy] = AVAILABLE_WORKERS[0];
      tickerList.shift();
      AVAILABLE_WORKERS.shift();
      ++countActiveWkrs;
    } else {
      break;
    }
  }

  // Create new workers if needed
  while (countActiveWkrs < MAX_WORKERS) {
    if (tickerList.length > 0) {
      await createWorker(tickerList[0]);
      console.log("worker created", tickerList[0]);
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
