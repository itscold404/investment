import axios from "axios";

const polygonBot = {
  baseURL: "/", // Polygon.io base url
  apiKey: "/", // Polygon.io API key
  returnLowerBound: 3, // Lower bound of stock price change for 1 day
  returnHigherBound: 40, // Higher bound of stock price change for 1 day

  // All stocks in the stock market with percent change [returnLowerBound, returnHigherBound]
  stocks: [],

  //------------------------------------------------------------------------------------------------------
  // Constructor
  //------------------------------------------------------------------------------------------------------
  create(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.fillStocksList();
    return this;
  },

  //------------------------------------------------------------------------------------------------------
  // Populate the list of stocks
  //------------------------------------------------------------------------------------------------------
  async fillStocksList() {
    let queryURL = `${this.baseURL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${this.apiKey}`;

    try {
      const response = await axios.get(queryURL);
      const allStocks = response.data.tickers;

      allStocks.forEach((s) => {
        let percentChange = s.todaysChangePerc;
        if (this.returnLowerBound < percentChange && percentChange < this.returnHigherBound) {
          this.stocks.push(s.ticker);
        }
      });
      console.log(this.stocks);
    } catch (err) {
      console.error("Error querying Polygon.io to get stock symbols:", err);
    }
  },

  //------------------------------------------------------------------------------------------------------
  // Get recommendations for what stocks to buy
  //------------------------------------------------------------------------------------------------------
  async getStockSuggestions() {
    return 0;
  },
};

export default polygonBot;
