import * as alpaca from "../util/alpaca.js";
import * as indicators from "./indicators.js";
import { linearRegression } from "simple-statistics";

//========================================================================
// Purpose: settings for stock indicaticators and helper for filtering
// stocks
//========================================================================

//------------------------------------------------------------------------
// Price filter constants
//------------------------------------------------------------------------
const LOWEST_PRICE = 10; // Lowest price of a stock we will buy
const HIGHEST_PRICE = 50; // Highest price of a stock we will buy

//------------------------------------------------------------------------
// Daily Volume and Recent Volume filter constants
//------------------------------------------------------------------------
// Minumum average daily volume of stock we will buy
const MINIMUM_DAILY_VOLUME = 2000000;

// Minimum volume per 15 minutes we trade
const MIN_VOL_PER_15 = MINIMUM_DAILY_VOLUME / 6.5 / 4;

//------------------------------------------------------------------------
// Spread filter constants
//------------------------------------------------------------------------
// Maximum acceptable spread of a stock as a percent of it's price
const MAX_ACCEPTABLE_SPREAD = 0.02;

//------------------------------------------------------------------------
// EMA filter constants
//------------------------------------------------------------------------
const EMA_PERIOD = 20; // Period of EMA

//------------------------------------------------------------------------
// ADX filter constants
//------------------------------------------------------------------------
const ADX_PERIOD = 14; // Period of ADX

//------------------------------------------------------------------------
// MACD filter constants
//------------------------------------------------------------------------
const MACD_PERIOD = [12, 26, 9]; // Period for MACD indicator
const MACD_RELEVANT_NUM_BARS = 3; // Number of latest bars to account

//------------------------------------------------------------------------
// Class to hold parameters for the filtering functions
//------------------------------------------------------------------------
class FilterParams {
  dataGetter; // function to fetch data to filter
  dataGetterParam; // parameters for dataGetter function
  batchSize; // number of stocks to retreive data using dataGetter function
  filterFunction; // funcion for filtering stock data

  constructor(df, ff, bs) {
    this.dataGetter = df;
    this.filterFunction = ff;
    this.batchSize = bs;
  }
}

//------------------------------------------------------------------------
// Parameters for filtering by price
//------------------------------------------------------------------------
const priceFilter = new FilterParams(
  alpaca.getLatestClosingPrice,
  filterByPrice,
  12000
);

//------------------------------------------------------------------------
// Parameters for filtering by daily volume
//------------------------------------------------------------------------
const dailyVolumeFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterByDailyVolume,
  2000
);
dailyVolumeFilter.dataGetterParam = {
  dataType: ["v"],
  barSize: "1Day",
  lookBackHours: 168,
};

//------------------------------------------------------------------------
// Parameters for filtering by recent volume
//------------------------------------------------------------------------
const volumeFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterByVolume,
  100 // could be 200?
);
volumeFilter.dataGetterParam = {
  dataType: ["v"],
  barSize: "15Min",
  lookBackHours: 30, // TODO: CHANGE TO .5 WHEN DONE TESTING
};

//------------------------------------------------------------------------
// Parameters for filtering by spread
//------------------------------------------------------------------------
const spreadFilter = new FilterParams(
  alpaca.getLatestQuote,
  filterBySpread,
  40 // could be 200?
);

//------------------------------------------------------------------------
// Parameters for filtering with EMA
//------------------------------------------------------------------------
const emaFilter = new FilterParams(alpaca.getHistoricalData, filterWithEma, 40);
emaFilter.dataGetterParam = {
  dataType: ["c"],
  barSize: "5Min",
  lookBackHours: 2, // TODO: CHANGE TO 2 WHEN DONE TESTING
};

//------------------------------------------------------------------------
// Parameters for filtering with ADX
//------------------------------------------------------------------------
const adxFilter = new FilterParams(alpaca.getHistoricalData, filterWithAdx, 40);
adxFilter.dataGetterParam = {
  dataType: ["h", "l", "c"],
  barSize: "15Min",
  lookBackHours: 4, // TODO: CHANGE TO 4 WHEN DONE TESTING
};

//------------------------------------------------------------------------
// Parameters for filtering with MACD
//------------------------------------------------------------------------
const macdFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterWithMacd,
  40
);
macdFilter.dataGetterParam = {
  dataType: ["c"],
  barSize: "5Min",
  lookBackHours: 3, // TODO: CHANGE TO 3 WHEN DONE TESTING
};

//------------------------------------------------------------------------
// Check if this stock should be traded based on its price
// \param Object data: Object containing price data
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
function filterByPrice(data) {
  if (data >= LOWEST_PRICE && data <= HIGHEST_PRICE) return true;

  return false;
}

//------------------------------------------------------------------------
// Check if this stock should be traded based on its daily volume
// \param Object data: Object containing daily volume data
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
function filterByDailyVolume(data) {
  if (!("v" in data)) {
    console.error("filterByDailyVolume is missing parameters");
    return false;
  }

  // Don't include today's volume (last value)
  let weeklyVolume = 0;
  for (let i = 0; i < data.v.length - 1; ++i) {
    weeklyVolume += data.v[i];
  }

  if (weeklyVolume / (data.v.length - 1) > MINIMUM_DAILY_VOLUME) {
    return true;
  }

  return false;
}

//------------------------------------------------------------------------
// Check if this stock should be traded based on its volume
// \param Object data: Object containing volume data
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
function filterByVolume(data) {
  if (!("v" in data)) {
    console.error("filterByVolume is missing parameters");
    return false;
  }

  if (data.v.length > 0 && data.v[data.v.length - 1] > MIN_VOL_PER_15) {
    return true;
  }

  return false;
}

//------------------------------------------------------------------------
// Check if this stock should be traded based on its spread
// \param Object data: Object containing data of the last quote
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
function filterBySpread(data) {
  if (!("ap" in data) || !("bp" in data)) {
    console.error("filterBySpread is missing parameters");
    return false;
  }

  if (data.ap == 0 || data.bp == 0) return false;

  const spreadPercent = (data.ap - data.bp) / data.ap;
  if (spreadPercent < MAX_ACCEPTABLE_SPREAD) return true;

  return false;
}

//------------------------------------------------------------------------
// Check if this stock should be traded based on EMA
// \param Object data: Object containing close data as EMA's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
async function filterWithEma(data) {
  if (!("c" in data)) {
    console.error("filterWithEma missing parameters");
    return false;
  }

  const closingPrices = data.c;
  const ema = await indicators.getEMA(closingPrices, [EMA_PERIOD]); // should I map this also?

  // todo: maybe check if ema is above closing for at least 2 5Min bars?
  if (
    ema &&
    ema.length > 0 &&
    closingPrices[closingPrices.length - 1] > ema[ema.length - 1]
  ) {
    return true;
  }

  return false;
}

//------------------------------------------------------------------------
// Check if this stock should be traded based on ADX
// \param Object data: Object containing high, low, and close data as
// ADX's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
async function filterWithAdx(data) {
  if (!("h" in data) || !("l" in data) || !("c" in data)) {
    console.error("filterWithAdx is missing parameters");
    return false;
  }

  const { h: highPrices, l: lowPrices, c: closePrices } = data;
  const adx = await indicators.getADX(
    [highPrices, lowPrices, closePrices],
    [ADX_PERIOD]
  );

  if (adx && adx.length > 0 && adx[adx.length - 1] > 20) return true;

  return false;
}

//------------------------------------------------------------------------
// Check if this stock should be traded based on MACD
// \param Object data: Object containing closing data as MACD's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------
async function filterWithMacd(data) {
  if (!("c" in data)) {
    console.error("filterWithMacd is missing parameters");
    return false;
  }
  const closingPrices = data.c;
  const macd = await indicators.getMACD(closingPrices, MACD_PERIOD);

  if (!macd) return false;
  if (macd.macdLine.length < 3 || macd.histogram.length < 3) return false; // can I check either one or both lengths?

  // Find the slope
  const relevantMacdLine = macd.macdLine.slice(-MACD_RELEVANT_NUM_BARS);
  const macdAsCoord = [];
  for (let i = 0; i < relevantMacdLine.length; ++i) {
    macdAsCoord.push([i, relevantMacdLine[i]]);
  }

  if (linearRegression.m > 0 && macd.histogram[macd.histogram.length - 1]) {
    return true;
  }

  return false;
}

export {
  priceFilter,
  dailyVolumeFilter,
  macdFilter,
  volumeFilter,
  spreadFilter,
  emaFilter,
  adxFilter,
};
