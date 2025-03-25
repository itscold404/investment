//==============================================================================
// Purpose: stock filter parameter settings in one place
//==============================================================================

// TODO: start using this in filterhelper.js
const filterSettings = {
  //----------------------------------------------------------------------------
  // Price filter settings
  //----------------------------------------------------------------------------
  LOWEST_PRICE: 10, // Lowest price of a stock we will buy
  HIGHEST_PRICE: 50, // Highest price of a stock we will buy
  priceBatchSize: 12000, // How many ticker to put into one data request batch

  //----------------------------------------------------------------------------
  // Daily Volume settings
  //----------------------------------------------------------------------------
  // Minumum average daily volume of stock we will buy
  MINIMUM_DAILY_VOLUME: 2000000,

  // How many ticker to put into one data request batch
  dailyVolumeBatchSize: 2000,

  dailyVolumeBarSize: "1Day", // Bar type to use for filtering
  dailyVolumeLookBackHour: 168, // Number of hours ago to get data for

  //----------------------------------------------------------------------------
  // Recent Volume settings
  //----------------------------------------------------------------------------
  // Minimum average volume per 15 minutes we will buy. Change if
  // MINIMUM_DAILY_VOLUME (above changes)
  MIN_VOL_PER_15: 2000000 / 6.5 / 4,
  recentVolumeBatchSize: 200, // How many ticker to put into one data request batch
  recentVolumeBarSize: "15Min", // Bar type to use for filtering
  recentVolumeLookBackHours: 10, // TODO: CHANGE TO .5 WHEN DONE TESTING

  //----------------------------------------------------------------------------
  // Spread filter settings
  //----------------------------------------------------------------------------
  // Maximum acceptable spread of a stock as a percent of it's price
  MAX_ACCEPTABLE_SPREAD: 0.02,

  spreadBatchSize: 150, // How many ticker to put into one data request batch

  //----------------------------------------------------------------------------
  // EMA filter settings
  //----------------------------------------------------------------------------
  EMA_PERIOD: 20, // Period of EMA
  emaBatchSize: 80, // How many ticker to put into one data request batch
  emaBarSize: "5Min", // Bar type to use for filtering
  emaLookBackHours: 10, // TODO: CHANGE TO 2 WHEN DONE TESTING

  //----------------------------------------------------------------------------
  // ADX filter settings
  //----------------------------------------------------------------------------
  ADX_PERIOD: 5, // Period of ADX
  adxBatchSize: 40, // How many ticker to put into one data request batch
  adxBarSize: "15Min", // Bar type to use for filtering
  adxLookBackHours: 10, // TODO: CHANGE TO 2 WHEN DONE TESTING

  //----------------------------------------------------------------------------
  // MACD filter settings
  //----------------------------------------------------------------------------
  MACD_PERIOD: [12, 26, 9], // Period for MACD indicator
  MACD_RELEVANT_NUM_BARS: 3, // Number of latest bars to account
  macdBatchSize: 40, // How many ticker to put into one data request batch
  macdBarSize: "5Min", // Bar type to use for filtering
  macdLookBackHours: 10, // TODO: CHANGE TO 3 WHEN DONE TESTING
};

export { filterSettings };
