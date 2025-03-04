import Alpaca from "@alpacahq/alpaca-trade-api";
import dotevn from "dotenv";
import { alpacaGET } from "./httpUtil.js";

dotevn.config({ path: "../../.env" });

//========================================================================
// Purpose: standardize data fetched from Alpaca
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
      console.error("Error getting account cash:", err);
      return null;
    });

  return account;
}

//------------------------------------------------------------------------
// Get symbol tickers of active stocks in NYSE, NASDAQ, ARCA, BATS
// exchanges
// \return a array of ticker symbols as strings
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
// Buy a stock during market open
// string tickerSymbol: ticker symbol to buy
// int qty: number of stocks of symbol specified to buy
//------------------------------------------------------------------------
function marketBuy(tickerSymbol, qty = 5) {
  // TODO: figure out how to take advantage of client_order_id param
  alpaca
    .createOrder({
      symbol: tickerSymbol, // any valid ticker symbol
      qty: qty,
      side: "buy",
      type: "market",
      time_in_force: "day",
      extended_hours: false,
    })
    .then(() => {
      console.log("order Created");
    });
}

//------------------------------------------------------------------------
// Buy a stock during market open
// \param string tickerSymbol: ticker symbol to buy
// \param int qty: number of stocks of symbol specified to buy
// \param bool sellAll: if you want to sell all stocks
//------------------------------------------------------------------------
function marketSell(tickerSymbol, qty = 5, sellAll = false) {
  alpaca
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
}

//------------------------------------------------------------------------
// Find the date in UTC format before specified time
// int hours: how many hours before current time
// return the date (and time) in UTC format the hours before current time
//------------------------------------------------------------------------
function timeBefore(hours) {
  let now = new Date();
  let before = new Date(now.getTime() - hours * 60 * 60 * 1000);
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

  let result = processingFunction(response, res, processingParams);
  return result;
}

//------------------------------------------------------------------------
// Get the historical data of a stock
// \param string symbols: ticker symbols separated by commas to get info
// for array stockPriceData: array of stock price data to return as an array
//                       of strings. Example:
//                         ["t", "o", "h", "l", "c", "v", "n", "v", "vw"]
//
// \param Object params: an object that contains the parameters below:
// \param string barType: the length of time of each bar. For example:
//                        "1Min", "5Min", "15Min", etc...
// \param float lookBackHours: how many hours to go back and get info of
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
    return null;
  }

  const { dataType, barSize, lookBackHours } = params;
  const startTime = timeBefore(lookBackHours).toISOString();

  // Combine the tickers into one string for querying
  let tickersString = getTickerSymbolsString(symbols);

  let queryURL = "https://data.alpaca.markets/v2/stocks/bars";
  let queryParams = {
    symbols: tickersString,
    timeframe: barSize,
    start: startTime,
    sort: "asc",
    limit: 10000,
  };
  let processingParams = { symbols: symbols, dataType: dataType };
  let data = await AlpacaHttpsCall(
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
  let tickersString = getTickerSymbolsString(symbols);
  let queryURL = "https://data.alpaca.markets/v2/stocks/bars/latest";
  let queryParams = {
    symbols: tickersString,
  };

  let data = await AlpacaHttpsCall(
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
  let data = alpacaResponse.data.bars;
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
  let tickersString = getTickerSymbolsString(symbols);
  let queryURL = "https://data.alpaca.markets/v2/stocks/quotes/latest";
  let queryParams = {
    symbols: tickersString,
  };

  let data = await AlpacaHttpsCall(
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
  let data = alpacaResponse.data.quotes;
  for (const t of Object.keys(data)) {
    res[t] = data[t];
  }

  return res;
}

export {
  alpaca,
  getAccountInfo,
  marketBuy,
  marketSell,
  getAssets,
  getHistoricalData,
  getLatestClosingPrice,
  getLatestQuote,
};
