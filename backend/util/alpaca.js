import Alpaca from "@alpacahq/alpaca-trade-api";
import dotevn from "dotenv";
import { alpacaGET } from "./httpUtil.js";

dotevn.config({ path: "../../.env" });

//========================================================================
// Purpose: standardize data fetched from Alpaca
// Order documentation:
// https://docs.alpaca.markets/docs/orders-at-alpaca
//========================================================================

//------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------
const IS_PAPER_TRADING = true;
const PAPER_API = process.env.ALPACA_PAPER_API_KEY;
const PAPER_SECRET = process.env.ALPACA_SECRET_API_KEY;

//------------------------------------------------------------------------
// Setup and connections
//------------------------------------------------------------------------
const alpaca = new Alpaca({
  keyId: PAPER_API,
  secretKey: PAPER_SECRET,
  paper: IS_PAPER_TRADING,
});

//------------------------------------------------------------------------
// Fetch alpaca account infomation
// \return alpaca account infomation
//------------------------------------------------------------------------
async function getAccountInfo() {
  const account = await alpaca
    .getAccount()
    .then((account) => {
      return account;
    })
    .catch((err) => {
      console.error("Error getting account info:", err);
      return null;
    });

  return account;
}

//------------------------------------------------------------------------
// Get symbol tickers of active stocks in NYSE, NASDAQ, ARCA, BATS
// exchanges
// \return an array of ticker symbols as strings
//------------------------------------------------------------------------
async function getAssets() {
  const assets = await alpaca
    .getAssets({
      status: "active",
      exchange: "NYSE,NASDAQ,ARCA,BATS",
    })
    .then((assets) => {
      return assets;
    })
    .catch((err) => {
      console.error("Error getting assets:", err);
      return null;
    });

  if (assets !== null) {
    let allTickers = [];
    for (const info of assets) {
      if (info.class === "us_equity") {
        allTickers.push(info.symbol);
      }
    }

    return allTickers;
  }
  return null;
}

//------------------------------------------------------------------------
// Cancel an order
// \param string orderId: the Alpaca order ID of the order to cancel
//------------------------------------------------------------------------
async function cancelAlpacaOrder(orderId) {
  try {
    await alpaca.cancelOrder(orderId);
  } catch (err) {
    console.error("Error canceling order:", err.message);
  }
}

//------------------------------------------------------------------------
// Buy a stock during market open
// \param string type: the type of buy - "market", "limit", etc.
// \param string tickerSymbol: ticker symbol to buy
// \param int qty: number of stocks of symbol specified to buy
// \param float limit: (optional) limit price to buy the stock
// TODO: handle order errors
//------------------------------------------------------------------------
async function buyTicker(type, tickerSymbol, qty, limitPrice) {
  // TODO: figure out how to take advantage of client_order_id param

  let order = {
    symbol: tickerSymbol, // any valid ticker symbol
    qty: qty,
    side: "buy",
    type: type,
    time_in_force: "day",
    extended_hours: false,
  };

  if (type == "limit") {
    order.limit_price = limitPrice;
  }

  await alpaca.createOrder(order).then(() => {
    console.log("Buying", qty, tickerSymbol);
  });
}

//------------------------------------------------------------------------
// Buy a stock using bracket Order
// string tickerSymbol: ticker symbol to buy
// \param int qty: number of stocks of symbol specified to buy
// \param Object priceParams: Object that includes prices for the bracket
// order: close price of the latest bar (closePrice), limit price for the
// buy (bLimitPrice), stop price and limit price for the take profit and
// stop loss: tpStopPrice, tpLimitPrice, slStopPrice, slLimitPrice
// \return the order ID if the order executed or null otherwise
// Note: If only the stop price is specified for the stop loss, the stop
// loss becomes a market sell
//------------------------------------------------------------------------
async function limitBracketOrder(tickerSymbol, qty, priceParams) {
  let take_profit = {};
  let stop_loss = {};

  if (priceParams.slStopPrice) {
    stop_loss.stop_price = Math.round(priceParams.slStopPrice * 100) / 100;
  } else {
    console.error("Missing StopPrice for stop loss");
    return null;
  }

  if (priceParams.tpLimitPrice) {
    take_profit.limit_price = Math.round(priceParams.tpLimitPrice * 100) / 100;
  } else if (priceParams.bLimitPrice) {
    take_profit.limit_price =
      Math.round((priceParams.bLimitPrice + 0.01) * 100) / 100;
  } else {
    console.error("Missing limit price for take profit");
    return null;
  }

  if (priceParams.tpStopPrice) {
    take_profit.stop_price = Math.round(priceParams.tpStopPrice * 100) / 100;
  }

  if (priceParams.slLimitPrice) {
    stop_loss.limit_price = priceParams.slLimitPrice;
  }

  const param = {
    side: "buy",
    symbol: tickerSymbol,
    type: "limit",
    qty: qty,
    limit_price: priceParams.bLimitPrice,
    time_in_force: "day",
    extended_hours: false,
    order_class: "bracket",
    take_profit: take_profit,
    stop_loss: stop_loss,
  };

  try {
    const order = await alpaca.createOrder(param);
    console.log("Buying", qty, tickerSymbol);
    console.log("order:", param);
    console.log(order.id);
    return order.id;
  } catch (err) {
    console.error("Bracket order error:", err);
    console.error("order:", order);
    return null;
  }
}

//------------------------------------------------------------------------
// Buy a stock during market open
// \param string tickerSymbol: ticker symbol to buy
// \param int qty: number of stocks of symbol specified to buy
// TODO: handle order errors
//------------------------------------------------------------------------
async function marketSell(tickerSymbol, qty) {
  try {
    await alpaca
      .createOrder({
        symbol: tickerSymbol,
        qty: qty,
        side: "sell",
        type: "market",
        time_in_force: "day",
        extended_hours: false,
      })
      .then(() => {
        console.log("order Created");
      });
  } catch (err) {
    console.error("Error from market sell:", err);
  }
}

//------------------------------------------------------------------------
// Find the date in UTC format before specified time
// int hours: how many hours before current time
// return the date (and time) in UTC format the hours before current time
//------------------------------------------------------------------------
function timeBefore(hours) {
  const now = new Date();
  const before = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return before;
}

//------------------------------------------------------------------------
// Condense an array of tickers into a string of ticker symbols separated
// by commas
// \param array<string> tickers: ticker symbols to combine
// \return a string of tickers symbols, separated by commas
//------------------------------------------------------------------------
function getTickerSymbolsString(tickers) {
  let tickersString = "";
  for (const t of tickers) {
    tickersString = tickersString + t + ",";
  }
  tickersString = tickersString.slice(0, -1); // remove last comma

  return tickersString;
}

//------------------------------------------------------------------------
// Make a HTTPS request to Alpaca to fetch info
// \param string queryURL: the URL to query
// \param Object queryParams: an object that contains the query parameters to
// be passed into the HTTPS request to Alpaca
// \param function processingFunction: the function used to process the
// results returned by Alpaca. This function is reponsible for formatting
// the output
// \param Object processingParams: the parameter to be passed into
// processingFunction
// \return Object that contains the infomation featched from Alpaca that
// has been formatted
//------------------------------------------------------------------------
async function AlpacaHttpsCall(
  queryURL,
  queryParams,
  processingFunction,
  processingParams
) {
  const response = await alpacaGET(queryURL, queryParams);
  if (!response) return null;

  // Extra info to pass into each response
  let res = {};
  if (response.data.next_page_token) {
    res["hasNextToken"] = true;
  } else {
    res["hasNextToken"] = false;
  }

  const result = processingFunction(response, res, processingParams);
  return result;
}

//------------------------------------------------------------------------
// Get the historical data of a stock
// \param array<string> symbols: ticker symbols to get info for
// \param Object params: an object that contains the parameters below:
//    \param array<string> dataType: array of stock price data to
//    return. Example:
//                     ["t", "o", "h", "l", "c", "v", "n", "v", "vw"]
//    \param string barType: the length of time of each bar. For example:
//                        "1Min", "5Min", "15Min", etc...
//    \param float lookBackHours: how many hours to go back and get info of
// \return an Object with with stock price data as requested and the values
// as an array of value of that type:
//              {
//                  GOOG: {
//                     h : [ 428.44, 428.6, 428.65 ],
//                     l : [ 420.44, 420.6, 420.65 ]
//                  }
//                  TSLA: null
//              }
//
// in the event of an error, return null
//------------------------------------------------------------------------
async function getHistoricalData(symbols, params) {
  if (
    !("dataType" in params) ||
    !("barSize" in params) ||
    !("lookBackHours" in params)
  ) {
    console.log("Missing parameter in call to getHistoricalData");
    return null;
  }

  const { dataType, barSize, lookBackHours } = params;
  const startTime = timeBefore(lookBackHours).toISOString();

  // Combine the tickers into one string for querying
  const tickersString = getTickerSymbolsString(symbols);

  const queryURL = "https://data.alpaca.markets/v2/stocks/bars";
  const queryParams = {
    symbols: tickersString,
    timeframe: barSize,
    start: startTime,
    sort: "asc",
    limit: 10000,
  };
  const processingParams = { symbols: symbols, dataType: dataType };
  const data = await AlpacaHttpsCall(
    queryURL,
    queryParams,
    processHistoricalData,
    processingParams
  );

  return data;
}

//------------------------------------------------------------------------
// The funtion for processing and formatting the result of a historical
// data fetch from Alpaca
// \param Object alpacaResponse: the entire response form Alpaca query
// \param Object res: the object this function adds to. This object
// contains general infomation for alpaca requests
// \param Object processingParams: the parameter to be passed into
// processingFunction
// \return Object with properly formatted data. See getHistoricalData()
//------------------------------------------------------------------------
function processHistoricalData(alpacaResponse, res, processingParams) {
  if (!("dataType" in processingParams) || !("symbols" in processingParams)) {
    return null;
  }

  const data = alpacaResponse.data.bars;
  const { symbols, dataType } = processingParams;
  for (const ticker of symbols) {
    if (data[ticker] && data[ticker].length > 0) {
      res[ticker] = {};

      for (const type of dataType) {
        res[ticker][type] = [];
      }

      for (const bar of data[ticker]) {
        for (const type of dataType) {
          res[ticker][type].push(bar[type]);
        }
      }
    } else {
      res[ticker] = null;
    }
  }

  return res;
}

//------------------------------------------------------------------------
// Get the most recent closing price for a array of symbols
// \param array<string> symbols: ticker symbols to search info for
// \param Object param: param to fullfill structure of filterBy in
// stockScanner.js
// \return object with the ticker symbols searched ex.
//         {
//          GOOG: {
//                  c: 100
//                }
//         }
//------------------------------------------------------------------------
async function getLatestClosingPrice(symbols) {
  const tickersString = getTickerSymbolsString(symbols);
  const queryURL = "https://data.alpaca.markets/v2/stocks/bars/latest";
  const queryParams = {
    symbols: tickersString,
  };

  const data = await AlpacaHttpsCall(
    queryURL,
    queryParams,
    processClosingPriceData
  );

  return data;
}

//------------------------------------------------------------------------
// The funtion for processing and formatting the result of a closing price
// data fetch from Alpaca
// \param Object alpacaResponse: the entire response form Alpaca query
// \param Object res: the object this function adds to. This object
// contains general infomation for alpaca requests
// \return Object with properly formatted data. See getLatestClosingPrice()
//------------------------------------------------------------------------
function processClosingPriceData(alpacaResponse, res) {
  const data = alpacaResponse.data.bars;
  for (const t of Object.keys(data)) {
    if ("c" in data[t]) {
      res[t] = data[t].c;
    }
  }

  return res;
}

//------------------------------------------------------------------------
// Get the most recent closing price for a array of symbols
// \param array<string> symbols: ticker symbols to search info for
// \param Object params: this parameter is not used. Included to meet
// structure of filterBy() function in stockScanner.js
// \return object with the ticker symbols searched ex.
//         {
//          GOOG: {
//                  ap: 100
//                  as:1
//                  bp:1000
//                  bs:1
//                }
//         }
//------------------------------------------------------------------------
async function getLatestQuote(symbols) {
  const tickersString = getTickerSymbolsString(symbols);
  const queryURL = "https://data.alpaca.markets/v2/stocks/quotes/latest";
  const queryParams = {
    symbols: tickersString,
  };

  const data = await AlpacaHttpsCall(
    queryURL,
    queryParams,
    processLatestQuoteData
  );

  return data;
}

//------------------------------------------------------------------------
// The funtion for processing and formatting the result of a latest quote
// data fetch from Alpaca
// \param Object alpacaResponse: the entire response form Alpaca query
// \param Object res: the object this function adds to. This object
// contains general infomation for alpaca requests
// \return Object with properly formatted data. See getLatestQuote()
//------------------------------------------------------------------------
function processLatestQuoteData(alpacaResponse, res) {
  const data = alpacaResponse.data.quotes;
  for (const t of Object.keys(data)) {
    res[t] = data[t];
  }

  return res;
}

export {
  alpaca,
  cancelAlpacaOrder,
  limitBracketOrder,
  getAccountInfo,
  getAssets,
  buyTicker,
  marketSell,
  getHistoricalData,
  getLatestClosingPrice,
  getLatestQuote,
};
