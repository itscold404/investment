import { workerData, parentPort } from "worker_threads";
import { getLatestClosingPrice, limitBracketOrder } from "../util/alpaca.js";
import { getIndicator } from "../util/techIndicators.js";
import { cancelAlpacaOrder, getHistoricalData } from "../util/alpaca.js";

//==============================================================================
// Purpose: Manage when to sell stocks
//==============================================================================

//------------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------------
const CHECK_MOMENTUM_SEC = 5; // How often to check the momentum of this ticker
const BUDGET = workerData.budget; // Budget per ticker
const CANCEL_ORDER_PERIOD = workerData.cancelPeriod; // Miliseconds before terminating order
let ticker = ""; // Ticker symbol this worker is managing
let tickerQty = 0; // Number of positions bought. For partial fill mitigation

// Maximum multiplier to ATR for calculating stop limit
const MAX_ATR_MULTIPLIER = workerData.maxAtrMultiplier;

//------------------------------------------------------------------------------
// Initialize indicators to avoid "Module did not self-register" error. Let
// parent know that this worker has been loaded and can load the next worker
//------------------------------------------------------------------------------
async function initializeWorker() {
  try {
    parentPort.postMessage({ status: "ready" });
  } catch (err) {
    parentPort.postMessage({
      type: "error",
      error: err.message,
    });

    process.exit(1);
  }
}

//------------------------------------------------------------------------------
// Buy the given ticker after calculating the appropriate quanity to buy
// \param string ticker: the ticker symbol to buy
//------------------------------------------------------------------------------
async function buyTicker(ticker) {
  // Compare the short and long term ATR to check price volitility
  const shortHistoryParam = {
    dataType: ["h", "l", "c"],
    barSize: "5Min",
    lookBackHours: 1.5, // TODO: change this to 1.5 when done testing
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

  if (
    !historyData[0] ||
    !historyData[1] ||
    !historyData[0][ticker] ||
    !historyData[1][ticker]
  ) {
    console.error(
      "Failed to buy as could not get historical data for ticker",
      ticker
    );

    // TODO: inform master could not buy ticker to free worker
    return;
  }

  const shortHLC = {
    high: historyData[0][ticker]["h"],
    low: historyData[0][ticker]["l"],
    close: historyData[0][ticker]["c"],
    period: 14,
  };

  const longHLC = {
    high: historyData[1][ticker]["h"],
    low: historyData[1][ticker]["l"],
    close: historyData[1][ticker]["c"],
    period: 14,
  };

  const shortATR = getIndicator("atr", shortHLC);
  const longATR = getIndicator("atr", longHLC);

  if (!shortATR || !longATR) {
    console.error("Failed to buy as could not calculate ATR data", ticker);
    return;
  }

  const recentShortATR = shortATR[shortATR.length - 1];
  const recentLongATR = longATR[longATR.length - 1];
  const atrRatio = recentShortATR / recentLongATR;

  // If high volatility, give more room for stock to move
  const atrCoeff = 1.0 + (MAX_ATR_MULTIPLIER - 2) * atrRatio;
  const scaledATR = atrCoeff * recentShortATR;
  const closePriceObject = await getLatestClosingPrice([ticker]);

  if (
    !closePriceObject ||
    !(ticker in closePriceObject) ||
    !closePriceObject[ticker]
  ) {
    console.error("Failed to buy as could not get closing price", ticker);

    // TODO: inform master could not buy ticker to free worker

    return;
  }

  const closePrice = closePriceObject[ticker];
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
    // TODO: how to guarentee that this executes before worker dies?
    tickerQty = quantity;
    setTimeout(async () => {
      await cancelAlpacaOrder(orderId);
    }, CANCEL_ORDER_PERIOD);
  } else {
    // TODO: tell master that worker has error`
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
await initializeWorker();

parentPort.on("message", async (message) => {
  if ("buy" in message) {
    ticker = message.buy;
    await buyTicker(ticker);
  }
});

// setInterval(async () => {
//   checkMomentum();
// }, CHECK_MOMENTUM_SEC * 1000);
