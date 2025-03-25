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
let ticker = ""; // Ticker symbol this worker is managing
let tickerQty = 0; // Number of positions bought. For partial fill mitigation

// Miliseconds before terminating order
const CANCEL_ORDER_PERIOD = workerData.cancelPeriod;

// Maximum multiplier to ATR for calculating stop limit
const MAX_ATR_MULTIPLIER = workerData.maxAtrMultiplier;

//------------------------------------------------------------------------------
// Send a message to master
// \param string stat: the status of the worker to send to master
//------------------------------------------------------------------------------
function messageMaster(stat) {
  switch (stat) {
    case "ready":
      parentPort.postMessage({ status: "ready" });
      return;
    case "error":
      parentPort.postMessage({ status: "error", ticker: ticker });
    default:
      console.error("Message to master not valid:", message);
      return;
  }
}

//------------------------------------------------------------------------------
// Buy the given ticker after calculating the appropriate quanity to buy
// \param string ticker: the ticker symbol to buy
//------------------------------------------------------------------------------
async function buyTicker(ticker) {
  // TODO: check if I have enough cash to make the purchase? probably not a worry
  // with cash accounts

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
    messageMaster("error");
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
    messageMaster("error");
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
    messageMaster("error");
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
    messageMaster("error");
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
messageMaster("ready");

parentPort.on("message", async (message) => {
  if ("buy" in message) {
    ticker = message.buy;
    await buyTicker(ticker);
  }
});

// setInterval(async () => {
//   checkMomentum();
// }, CHECK_MOMENTUM_SEC * 1000);
