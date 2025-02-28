import * as alpaca from "./alpaca.js";
import axios from "axios";
import https from "https";
import { certLocation } from "../certs.js";
import fs from "fs";
import {
  adxFilter,
  dailyVolumeFilter,
  emaFilter,
  macdFilter,
  priceFilter,
  spreadFilter,
  volumeFilter,
} from "./filterHelper.js";

//------------------------------------------------------------------------
// Purpose: Script to constantly run and scan for suitable stocks to buy.
// This is the main way for the master script to know what stocks to buy
//------------------------------------------------------------------------

//------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------
const MASTER_PORT = process.env.MASTER_PORT;
const HTTPS_AGENT = new https.Agent({ ca: fs.readFileSync(certLocation) });

//------------------------------------------------------------------------
// Determine if the stock's today's volume is volatile compared to the
// volume over the past week
// \param array<int> volumes: the volume data of the past week
// \param array<string> times: the string representing the UTC of the
// volumes array. The string at index i of times array should be the time
// of the volume at index i
// \return true if stock is volatile or false if not
//------------------------------------------------------------------------
function isVolatile(volumes, times) {
  console.log("data", volumes, times);
  const currentTime = new Date();
  let todayVolume = 0;
  const dailyVolumeMap = {};

  for (let i = 0; i < volumes.length; ++i) {
    let dateTime = new Date(times[i]);
    let date = dateTime.getDate();
    let hour = dateTime.getHours();
    let min = dateTime.getMinutes();
    let currentHour = currentTime.getHours();
    let currentMin = currentTime.getMinutes();

    if (date === currentTime.getDate()) {
      todayVolume += volumes[i];
    } else if (
      hour <= currentHour ||
      (hour === currentHour && min <= currentMin)
    ) {
      if (!dailyVolumeMap[date]) {
        dailyVolumeMap[date] = 0;
      }

      dailyVolumeMap[date] += volumes[i];
    }
  }

  let averageWeekVolume = () => {
    let weeklyVolumes = Object.values(dailyVolumeMap);
    let totalVolume = 0;

    for (let i = 0; i < weeklyVolumes.length; ++i) {
      totalVolume += weeklyVolumes[i];
    }

    let averageVolume =
      weeklyVolumes.length > 0 ? totalVolume / weeklyVolumes.length : 0;

    return averageVolume;
  };

  return todayVolume > averageWeekVolume() * 1.7;
}

//------------------------------------------------------------------------
// Create batches from a larger array
// \param array<any> arr: array to break into even chunks (execpt last chunk)
// \param int size: size of each chunk
// \return array of arrays of size size
//------------------------------------------------------------------------
function chunkArray(arr, size) {
  if (size <= 0) return arr;

  let chunkedArray = [];
  for (let i = 0; i < arr.length; i += size) {
    const batchArr = arr.slice(i, i + size);

    let batch = [];
    for (const t of batchArr) {
      batch.push(t);
    }
    chunkedArray.push(batch);
  }

  return chunkedArray;
}

//------------------------------------------------------------------------
// Initialize the list of potential tickers by filtering out stocks from
// many stocks traded in the market
// \return array<string> of stocks symbols
//------------------------------------------------------------------------
async function getPotentialTickers() {
  let rawTickers = await alpaca.getAssets();

  if (!rawTickers) return null;

  // Remove "preferred" stocks
  let tickers = rawTickers.filter((symbol) => {
    if (!symbol) return false;
    return !symbol.includes(".");
  });

  let filteredPrice = await filterBy(tickers, priceFilter, "Price");
  let filteredVolume = await filterBy(
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

//------------------------------------------------------------------------
// Filter by condition/attribute
// \param array<string> tickers: array of ticker symbols to filter
// \param FilterParams params: FilterParams object to use for filtering
// \param string filterName: The name of the condition/attribute that
// will be printed
// \return an array of tickers (as a string) that passed the filter
//------------------------------------------------------------------------
async function filterBy(tickers, params, filterName) {
  let filteredTickers = [];
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
      let shouldAdd = await filterFunction(data[t]);
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

//------------------------------------------------------------------------
// Filter the tickers based on condtions/indicators to find suitable
// tickers to buy
// \param array<string> tickers: the tickers to filter
// \return an array of tickers (as a string) to buy
//------------------------------------------------------------------------
async function findSuitableTickers(tickers) {
  let filteredByRecentVolume = await filterBy(tickers, volumeFilter, "Volume");
  let filteredBySpread = await filterBy(
    filteredByRecentVolume,
    spreadFilter,
    "Spread"
  );
  let filteredByEMA = await filterBy(filteredBySpread, emaFilter, "EMA");
  let filteredByADX = await filterBy(filteredByEMA, adxFilter, "ADX");
  let filteredByMACD = await filterBy(filteredByADX, macdFilter, "MACD");
  // require (ATR / Price) > X% (like 2–3%) for profit. if ATR is too low don't trade it

  return filteredByMACD;
}

//------------------------------------------------------------------------
// Send object to the master
// \param any data: the data to send to the master
// \param string name: the name for the data to send to the master. Used
// as the field name of the object sent to the master
//------------------------------------------------------------------------
async function sendDataToMaster(data, name) {
  if (!data || !name) return;

  let mail = {};
  mail[name] = data;
  try {
    let queryURL = `https://localhost:${MASTER_PORT}/updateTickers`;
    await axios.put(queryURL, mail, { httpsAgent: HTTPS_AGENT });
  } catch (err) {
    console.error("Failed to send data to master:", err);
  }
}

//------------------------------------------------------------------------
// Main stock scanner logic:
// Filter stocks and send stocks to the master
//------------------------------------------------------------------------
const accountInfo = await alpaca.getAccountInfo(); // Account information
const TICKERS = await getPotentialTickers(); // Potential tickers of stocks to trade
const REFRESH_SECONDS = 10; // How often to scan for stocks to buy
let accountCash = accountInfo.cash; // Available cash in account
let newsTickers = []; // Tickers mentioned in news. Should be prioritiezed
let potentialTickers = []; // Tickers that have been filtered

if (accountInfo === null || TICKERS === null) {
  throw new Error("Unable to properly initialize. Check connection to Alpaca.");
}

console.log(accountCash);

setInterval(async () => {
  potentialTickers = await findSuitableTickers(TICKERS);
  sendDataToMaster(potentialTickers, "potentialTickers");
}, REFRESH_SECONDS * 1000);
