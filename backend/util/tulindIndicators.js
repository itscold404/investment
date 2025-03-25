import tulind from "tulind";
import { promisify } from "util";

//==============================================================================
// Purpose: puts indicators generated from tulind in a common format. Mainly
// used for scanning large quantity of stocks as its C foundation provides
// efficient computation.
//
// Note: does not work well with JS's worker_threads
//==============================================================================

//------------------------------------------------------------------------------
// Calcualte the Average True Range (ATR)
// \param array hlc: array of array of[ hight, low, close ] data
// \param array period: period to calculate ATR
// \return an array with ATR data or null if there
// is an error
//------------------------------------------------------------------------------
async function getATR(hlc, period) {
  const atr_async = promisify(tulind.indicators.atr.indicator);
  const atr_val = async (data, period) => {
    try {
      const result = await atr_async(data, period);
      return result[0];
    } catch (err) {
      console.error("Failed to calculate ATR-", err);
      return null;
    }
  };

  const result = await atr_val(hlc, period);
  return result;
}

//------------------------------------------------------------------------------
// Calcualte the Moving Average Convergence/Divergence (MACD)
// \param array c: array of close data
// \param array periods: array of integers of length 3 representing:
//                       [Short EMA period, Long EMA period, Signal Line EMA period]
// \return an object where
//        {
//          macdLine: [array representing macdLine],
//          signalLine: [array representing signalLine],
//          histogram: [array representing histogram]
//        }
// or if there is an error, return null
//------------------------------------------------------------------------------
async function getMACD(c, periods) {
  const macd_async = promisify(tulind.indicators.macd.indicator);
  const macd_val = async (close, periods) => {
    try {
      const result = await macd_async(close, periods);
      const [macdLine, signalLine, histogram] = result;
      return {
        macdLine: macdLine,
        signalLine: signalLine,
        histogram: histogram,
      };
    } catch (err) {
      console.error("Failed to calculate MACD-", err);
      return null;
    }
  };

  const result = await macd_val([c], periods);
  return result;
}

//------------------------------------------------------------------------------
// Calcualte the Exponential Moving Average (EMA)
// \param array c: array of close data
// \param array period: number of data points for calculation
// \return an array with EMA data or if there is an error,
// return null
//------------------------------------------------------------------------------
async function getEMA(c, period) {
  const ema_async = promisify(tulind.indicators.ema.indicator);
  const ema_val = async (close, period) => {
    try {
      const result = await ema_async(close, period);
      return result[0];
    } catch (err) {
      console.error("Failed to calculate EMA-", err);
      return null;
    }
  };
  const result = await ema_val([c], period);
  return result;
}

//------------------------------------------------------------------------------
// Calcualte the Average Directional Movement Index (ADX)
// \param array hlc: array of array of[ hight, low, close ] data
// \param array period: number of data points for calculation in an array
// \return an array with ADX data or if there is an error,
// return null
//------------------------------------------------------------------------------
async function getADX(hlc, period) {
  const adx_async = promisify(tulind.indicators.adx.indicator);
  const adx_val = async (close, period) => {
    try {
      const result = await adx_async(close, period);
      return result[0];
    } catch (err) {
      console.error("Failed to calculate ADX-", err);
      return null;
    }
  };
  const result = await adx_val(hlc, period);
  return result;
}

export { getADX, getATR, getEMA, getMACD };
