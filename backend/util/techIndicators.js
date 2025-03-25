import { atr } from "technicalindicators";

//==============================================================================
// Purpose: puts indicators generated from TechnicalIndicators in a common
// format. Mainly used for worker_threads
//==============================================================================

//------------------------------------------------------------------------------
// Use the technicalindicators library to calculate an indicator
// \param string indicator: the indicator to calculate for
// \param Object inputs: input for the indicator. The values required for each
// indicator is mentioned below
// \return indicator values. Format is mentioned below
//------------------------------------------------------------------------------
function getIndicator(indicator, inputs) {
  switch (indicator) {
    case "atr":
      // \param Object inputs should include:
      //      low: array<float> of low price data
      //      high: array<float> of high price data
      //      close: array<float> of closing price data
      //      period: an int that represents the period to calculate
      // \return ATR values as array<float>
      return atr(inputs);
    default:
      return null;
  }
}

export { getIndicator };
