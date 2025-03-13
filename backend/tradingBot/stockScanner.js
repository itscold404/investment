import * as alpaca from "../util/alpaca.js";
import fs from "fs";
import { httpPUT } from "../util/httpUtil.js";
import {
  adxFilter,
  dailyVolumeFilter,
  emaFilter,
  macdFilter,
  priceFilter,
  spreadFilter,
  volumeFilter,
} from "./filterHelper.js";

//==============================================================================
// Purpose: Script to constantly run and scan for suitable stocks to buy.
// This is the main way for the master script to know what stocks to buy
//==============================================================================

//------------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------------
const MASTER_PORT = process.env.MASTER_PORT;

//------------------------------------------------------------------------------
// Create batches from a larger array
// \param array<any> arr: array to break into even chunks (execpt last chunk)
// \param int size: size of each chunk
// \return array of arrays of size size
//------------------------------------------------------------------------------
function chunkArray(arr, size) {
  if (size <= 0) return arr;

  const chunkedArray = [];
  for (let i = 0; i < arr.length; i += size) {
    const batchArr = arr.slice(i, i + size);

    const batch = [];
    for (const t of batchArr) {
      batch.push(t);
    }
    chunkedArray.push(batch);
  }

  return chunkedArray;
}

//------------------------------------------------------------------------------
// Initialize the list of potential tickers by filtering out stocks from
// many stocks traded in the market
// \return array<string> of stocks symbols
//------------------------------------------------------------------------------
async function getPotentialTickers() {
  const rawTickers = await alpaca.getAssets();

  if (!rawTickers) return null;

  // Remove "preferred" stocks
  const tickers = rawTickers.filter((symbol) => {
    if (!symbol) return false;
    return !symbol.includes(".");
  });

  const filteredPrice = await filterBy(tickers, priceFilter, "Price");
  const filteredVolume = await filterBy(
    filteredPrice,
    dailyVolumeFilter,
    "Daily Volume"
  );

  // Write the resulting string to a text file
  const text = filteredVolume.join("\n");
  fs.writeFile("../../data/stockList.txt", text, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("File written successfully as stockList.txt");
    }
  });

  return filteredVolume;
}

//------------------------------------------------------------------------------
// Filter by condition/attribute
// \param array<string> tickers: array of ticker symbols to filter
// \param FilterParams params: FilterParams object to use for filtering
// \param string filterName: The name of the condition/attribute that
// will be printed
// \return an array of tickers (as a string) that passed the filter
//------------------------------------------------------------------------------
async function filterBy(tickers, params, filterName) {
  const filteredTickers = [];
  let requestCount = 0;
  let hasNextToken = false;
  const dataGetter = params.dataGetter;
  const filterFunction = params.filterFunction;
  const batches = chunkArray(tickers, params.batchSize);
  const dataPromises = batches.map((batch) => {
    return dataGetter(batch, params.dataGetterParam);
  });

  const datas = await Promise.all(dataPromises);
  if (!datas) return [];
  for (const data of datas) {
    if (!data) continue;
    for (const t of Object.keys(data)) {
      if (t === "hasNextToken" && data["hasNextToken"]) {
        hasNextToken = true;
        continue;
      }

      if (
        data[t] == null ||
        (Object.keys(data[t]).length === 0 && typeof data[t] !== "number")
      )
        continue;

      // TODO: could put this into a map
      const shouldAdd = await filterFunction(data[t]);
      if (shouldAdd) {
        filteredTickers.push(t);
      }
    }

    requestCount += 1;
  }

  console.log(filteredTickers);
  console.log(
    "Made ",
    requestCount,
    "request(s) to filter by",
    filterName,
    "for list size of ",
    filteredTickers.length
  );
  console.log("Initialization has next token:", hasNextToken);

  return filteredTickers;
}

//------------------------------------------------------------------------------
// Filter the tickers based on condtions/indicators to find suitable
// tickers to buy
// \param array<string> tickers: the tickers to filter
// \return an array of tickers (as a string) to buy
//------------------------------------------------------------------------------
async function findSuitableTickers(tickers) {
  const filteredByRecentVolume = await filterBy(
    tickers,
    volumeFilter,
    "Recent Volume"
  );
  const filteredBySpread = await filterBy(
    filteredByRecentVolume,
    spreadFilter,
    "Spread"
  );
  const filteredByEMA = await filterBy(filteredBySpread, emaFilter, "EMA");
  const filteredByADX = await filterBy(filteredByEMA, adxFilter, "ADX");
  const filteredByMACD = await filterBy(filteredByADX, macdFilter, "MACD");
  // require (ATR / Price) > X% (like 2–3%) for profit. if ATR is too low don't trade it

  return filteredByMACD;
}

//------------------------------------------------------------------------------
// Main stock scanner logic:
// Filter stocks and send stocks to the master
//------------------------------------------------------------------------------
const accountInfo = await alpaca.getAccountInfo(); // Account information
const TICKERS = await getPotentialTickers(); // Potential tickers of stocks to trade
const REFRESH_SECONDS = 10; // How often to scan for stocks to buy
const accountCash = accountInfo.cash; // Available cash in account
const newsTickers = []; // Tickers mentioned in news. Should be prioritiezed
let potentialTickers = []; // Tickers that have been filtered

if (accountInfo === null || TICKERS === null) {
  throw new Error("Unable to properly initialize. Check connection to Alpaca.");
}

setInterval(async () => {
  potentialTickers = await findSuitableTickers(TICKERS);
  httpPUT(
    `https://localhost:${MASTER_PORT}/updateTickers`,
    [potentialTickers],
    ["potentialTickers"]
  );
}, REFRESH_SECONDS * 1000);
