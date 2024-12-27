import axios from "axios";
import dotevn from "dotenv";
import Stock from "./stock.js";

dotevn.config({ path: "../.env" });

const polygonBot = {
  baseURL: process.env.POLYGON_BASE_URL, // Polygon.io base url
  apiKey: process.env.POLYGON_API_KEY, // Polygon.io API key

  // TODO: make it so that these values can be set by the front end
  returnLowerBound: 10, // Lower bound of stock price change for 1 day
  returnHigherBound: 30, // Higher bound of stock price change for 1 day

  // All stocks in the stock market with percent change
  // [returnLowerBound, returnHigherBound]
  stocks: [],

  //------------------------------------------------------------------------
  // Sorts the list of stocks in decending 1 day percent change
  //------------------------------------------------------------------------
  sortStockDescending() {
    this.stocks.sort((a, b) => b.dayPercentChange - a.dayPercentChange);
  },

  //------------------------------------------------------------------------
  // Sorts the list of stocks in decending 1 day percent change
  //------------------------------------------------------------------------
  sortStockAscending() {
    this.stocks.sort((a, b) => a.dayPercentChange - b.dayPercentChange);
  },

  //------------------------------------------------------------------------
  // Populate the list of stocks
  //------------------------------------------------------------------------
  async fillStocksList() {
    let queryURL = `${this.baseURL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${this.apiKey}`;

    try {
      const response = await axios.get(queryURL);
      const allStocks = response.data.tickers;

      allStocks.forEach((s) => {
        let percentChange = s.todaysChangePerc;
        if (this.returnLowerBound < percentChange && percentChange < this.returnHigherBound) {
          let stock = new Stock(s.ticker, percentChange);
          this.stocks.push(stock);
        }
      });
      this.sortStockDescending();
      console.log(this.stocks);
      console.log(this.stocks.length);
    } catch (err) {
      console.error("Error querying Polygon.io to get stock symbols:", err);
    }
  },

  //------------------------------------------------------------------------
  // Populate the list of stocks with news
  //------------------------------------------------------------------------
  async fillStockNews() {},

  //------------------------------------------------------------------------
  // Get recommendations for what stocks to buy based on the news
  //------------------------------------------------------------------------
  async getStockSuggestions() {
    return 0;
  },
};

export default polygonBot;
