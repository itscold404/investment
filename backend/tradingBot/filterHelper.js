import * as alpaca from "../util/alpaca.js";
import * as indicators from "../util/tulindIndicators.js";
import { FilterParams } from "../util/filterParams.js";
import { filterSettings } from "./filterConfig.js";
import { linearRegression } from "simple-statistics";

//==============================================================================
// Purpose: settings for stock indicaticators and helper for filtering
// stocks
//==============================================================================

//------------------------------------------------------------------------------
// Price filter constants
//------------------------------------------------------------------------------
const LOWEST_PRICE = filterSettings.LOWEST_PRICE;
const HIGHEST_PRICE = filterSettings.HIGHEST_PRICE;
const priceFilter = new FilterParams( // Parameters for filtering by price
  alpaca.getLatestClosingPrice,
  filterByPrice,
  filterSettings.priceBatchSize
);

//------------------------------------------------------------------------------
// Daily Volume filter constants
//------------------------------------------------------------------------------
// Minumum average daily volume of stock we will buy
const MINIMUM_DAILY_VOLUME = filterSettings.MINIMUM_DAILY_VOLUME;

// Parameters for filtering by daily volume
const dailyVolumeFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterByDailyVolume,
  filterSettings.dailyVolumeBatchSize
);
dailyVolumeFilter.dataGetterParam = {
  dataType: ["v"],
  barSize: filterSettings.dailyVolumeBarSize,
  lookBackHours: filterSettings.dailyVolumeLookBackHour,
};

//------------------------------------------------------------------------------
// Recent Volume filter constants
//------------------------------------------------------------------------------
// Minimum average volume per 15 minutes we will buy
const MIN_VOL_PER_15 = filterSettings.MIN_VOL_PER_15;

// Parameters for filtering by recent volume
const recentVolumeFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterByVolume,
  filterSettings.recentVolumeBatchSize
);
recentVolumeFilter.dataGetterParam = {
  dataType: ["v"],
  barSize: filterSettings.recentVolumeBarSize,
  lookBackHours: filterSettings.recentVolumeLookBackHours,
};

//------------------------------------------------------------------------------
// Spread filter constants
//------------------------------------------------------------------------------
const MAX_ACCEPTABLE_SPREAD = filterSettings.MAX_ACCEPTABLE_SPREAD;

// Parameters for filtering by spread
const spreadFilter = new FilterParams(
  alpaca.getLatestQuote,
  filterBySpread,
  filterSettings.spreadBatchSize
);

//------------------------------------------------------------------------------
// EMA filter constants
//------------------------------------------------------------------------------
const EMA_PERIOD = filterSettings.EMA_PERIOD;

// Parameters for filtering with EMA
const emaFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterWithEma,
  filterSettings.emaBatchSize
);
emaFilter.dataGetterParam = {
  dataType: ["c"],
  barSize: filterSettings.emaBarSize,
  lookBackHours: filterSettings.emaLookBackHours,
};

//------------------------------------------------------------------------------
// ADX filter constants
//------------------------------------------------------------------------------
const ADX_PERIOD = filterSettings.ADX_PERIOD; // Period of ADX

// Parameters for filtering with ADX
const adxFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterWithAdx,
  filterSettings.adxBatchSize
);
adxFilter.dataGetterParam = {
  dataType: ["h", "l", "c"],
  barSize: filterSettings.adxBarSize,
  lookBackHours: filterSettings.adxLookBackHours,
};

//------------------------------------------------------------------------------
// MACD filter constants
//------------------------------------------------------------------------------
const MACD_PERIOD = filterSettings.MACD_PERIOD;

const MACD_RELEVANT_NUM_BARS = filterSettings.MACD_RELEVANT_NUM_BARS;

// Parameters for filtering with MACD
const macdFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterWithMacd,
  filterSettings.macdBatchSize
);
macdFilter.dataGetterParam = {
  dataType: ["c"],
  barSize: filterSettings.macdBarSize,
  lookBackHours: filterSettings.macdLookBackHours,
};

//------------------------------------------------------------------------------
// ATR filter constants
//------------------------------------------------------------------------------
const ATR_PERIOD = filterSettings.ATR_PERIOD;
const ATR_THRESHHOLD = filterSettings.atrThreshhold;

// Parameters for filtering with MACD
const atrFilter = new FilterParams(
  alpaca.getHistoricalData,
  filterWithAtr,
  filterSettings.atrBatchSize
);
atrFilter.dataGetterParam = {
  dataType: ["h", "l", "c"],
  barSize: filterSettings.atrBarSize,
  lookBackHours: filterSettings.atrLookBackHours,
};

//------------------------------------------------------------------------------
// Check if this stock should be traded based on its price
// \param Object data: Object containing price data
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
function filterByPrice(data) {
  if (data >= LOWEST_PRICE && data <= HIGHEST_PRICE) {
    return true;
  }

  return false;
}

//------------------------------------------------------------------------------
// Check if this stock should be traded based on its daily volume
// \param Object data: Object containing daily volume data
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
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

//------------------------------------------------------------------------------
// Check if this stock should be traded based on its volume
// \param Object data: Object containing volume data
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
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

//------------------------------------------------------------------------------
// Check if this stock should be traded based on its spread
// \param Object data: Object containing data of the last quote
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
function filterBySpread(data) {
  if (!("ap" in data) || !("bp" in data)) {
    console.error("filterBySpread is missing parameters");
    return false;
  }

  if (data.ap === 0 || data.bp === 0) return false;

  const spreadPercent = (data.ap - data.bp) / data.ap;
  if (spreadPercent < MAX_ACCEPTABLE_SPREAD) return true;

  return false;
}

//------------------------------------------------------------------------------
// Check if this stock should be traded based on EMA
// \param Object data: Object containing close data as EMA's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
async function filterWithEma(data) {
  if (!("c" in data)) {
    console.error("filterWithEma missing parameters");
    return false;
  }

  const closingPrices = data.c;
  const ema = await indicators.getEMA(closingPrices, [EMA_PERIOD]);

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

//------------------------------------------------------------------------------
// Check if this stock should be traded based on ADX
// \param Object data: Object containing high, low, and close data as
// ADX's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
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

//------------------------------------------------------------------------------
// Check if this stock should be traded based on ATR
// \param Object data: Object containing high, low, close data as ATR's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
async function filterWithAtr(data) {
  if (!("h" in data) || !("l" in data) || !("c" in data)) {
    console.error("filterWithAtr is missing parameters");
    return false;
  }

  const { h: highPrices, l: lowPrices, c: closePrices } = data;
  const atr = await indicators.getADX(
    [highPrices, lowPrices, closePrices],
    [ATR_PERIOD]
  );

  if (atr / closePrices > ATR_THRESHHOLD) {
    return [true, atr];
  }

  return [false, -1];
}

//------------------------------------------------------------------------------
// Check if this stock should be traded based on MACD
// \param Object data: Object containing closing data as MACD's input
// \return true if this stock should be traded based on this filter
//------------------------------------------------------------------------------
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

  const regression = linearRegression(macdAsCoord);
  if (macd.histogram.length >= 2) {
    const growingHistogram =
      macd.histogram[macd.histogram.length - 1] >=
      macd.histogram[macd.histogram.length - 2];
    if (
      regression.m > 0 &&
      growingHistogram &&
      macd.histogram[macd.histogram.length - 1] > 0
    ) {
      return true;
    }
  }

  return false;
}

export {
  atrFilter,
  priceFilter,
  dailyVolumeFilter,
  macdFilter,
  recentVolumeFilter,
  spreadFilter,
  emaFilter,
  adxFilter,
};
