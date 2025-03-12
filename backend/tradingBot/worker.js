import { workerData, parentPort } from "worker_threads";

import { getLatestClosingPrice, limitBracketOrder } from "../util/alpaca.js";
import { getADX, getATR, getEMA, getMACD } from "./indicators.js";
import { cancelAlpacaOrder, getHistoricalData } from "../util/alpaca.js";

//========================================================================
// Purpose: Manage when to sell stocks
//========================================================================

//------------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------------
const CHECK_MOMENTUM_SEC = 5; // How often to check the momentum of this ticker
const BUDGET = workerData.budget; // Budget per ticker
const CANCEL_ORDER_PERIOD = workerData.cancelPeriod; // Miliseconds before terminating order
let ticker = workerData.ticker; // Ticker symbol this worker is managing
let tickerQty = 0; // Number of positions bought. For partial fill mitigation

// Maximum multiplier to ATR for calculating stop limit
const MAX_ATR_MULTIPLIER = workerData.maxAtrMultiplier;

//------------------------------------------------------------------------------
// Inform parent what stock has been sold
//------------------------------------------------------------------------------
function notifyPositionClosed() {
  parentPort.postMessage(ticker);
}

//------------------------------------------------------------------------------
// Buy the given ticker after calculating the appropriate quanity to buy
// \param string ticker: the ticker symbol to buy
//------------------------------------------------------------------------------
async function buyTicker(ticker) {
  console.log("in buy ticker");

  // Compare the short and long term ATR to check price volitility
  const shortHistoryParam = {
    dataType: ["h", "l", "c"],
    barSize: "5Min",
    lookBackHours: 10,
  };

  const longHistoryParam = {
    dataType: ["h", "l", "c"],
    barSize: "1Day",
    lookBackHours: 672,
  };

  const shortHistoryPromise = getHistoricalData([ticker], shortHistoryParam);
  const longtHistoryPromise = getHistoricalData([ticker], longHistoryParam);
  const historyPromises = [shortHistoryPromise, longtHistoryPromise];
  const historyData = await Promise.all(historyPromises);

  const shortHLC = [
    historyData[0][ticker]["h"],
    historyData[0][ticker]["l"],
    historyData[0][ticker]["c"],
  ];

  const longHLC = [
    historyData[1][ticker]["h"],
    historyData[1][ticker]["l"],
    historyData[1][ticker]["c"],
  ];

  const shortATRPromise = getATR(shortHLC, [14]);
  const longATRPromise = getATR(longHLC, [14]);
  const pricePromise = getLatestClosingPrice([ticker]);
  const promises = [shortATRPromise, longATRPromise, pricePromise];
  const promiseData = await Promise.all(promises);

  const recentShortATR = promiseData[0][promiseData[0].length - 1];
  const recentLongATR = promiseData[1][promiseData[1].length - 1];
  const atrRatio = recentShortATR / recentLongATR;

  // If high volatility, give more room for stock to move
  const atrCoeff = 1.5 + (MAX_ATR_MULTIPLIER - 1.5) * atrRatio;
  const scaledATR = atrCoeff * recentShortATR;

  const closePrice = promiseData[2][ticker];
  let quantity = Math.floor(BUDGET / closePrice);
  quantity = quantity === 0 ? 1 : quantity; // Buy at least one of this stock

  const priceParams = {
    bLimitPrice: closePrice,
    tpLimitPrice: closePrice + scaledATR, // round to hundreath
    slStopPrice: closePrice - scaledATR,
  };

  // How to handle failed orders or partial fills? Do this in alpaca.js
  const orderId = await limitBracketOrder(ticker, quantity, priceParams);
  if (orderId) {
    tickerQty = quantity;
    setTimeout(async () => {
      await cancelAlpacaOrder(orderId);
    }, CANCEL_ORDER_PERIOD);
  }
}

//------------------------------------------------------------------------------
// Check if this stock still has momentum to continue
//------------------------------------------------------------------------------
async function checkMomentum() {
  // Check momentum... if momentum sufficient, update our limit sell?
  // sell with brakcet order
}

//------------------------------------------------------------------------------
// Main Logic
//------------------------------------------------------------------------------
console.log(ticker, BUDGET);
parentPort.on("message", async (message) => {
  // Message from parent means new ticker assigned
  ticker = message;

  // Buy the stock if needed
  await buyTicker(ticker);
});

// Buy stock if not already bought
await buyTicker(ticker);

setInterval(async () => {
  checkMomentum();
}, CHECK_MOMENTUM_SEC * 1000);
