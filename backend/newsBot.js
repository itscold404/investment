import axios from "axios";
import dotevn from "dotenv";
import Stock from "./stock.js";

dotevn.config({ path: "../.env" });

const newsBot = {
  baseURL: process.env.POLYGON_BASE_URL, // Polygon.io base url
  apiKey: process.env.POLYGON_API_KEY, // Polygon.io API key
  relevantDate: 30, // Number of days that passed of relevant news article

  // TODO: make it so that these values can be set by the front end
  returnLowerBound: -30, // Lower bound of stock price change for 1 day
  returnHigherBound: 30, // Higher bound of stock price change for 1 day

  // All stocks, as a Stock object in the stock market with percent
  // change [returnLowerBound, returnHigherBound]
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
  // Check if the UTC date is within the Time specified
  // utcDate: the UTC Date as a string (ex. 2024-05-10T20:15:00Z)
  //------------------------------------------------------------------------
  withinRelevantTime(utcDate) {
    const now = new Date();
    const targetDate = new Date(utcDate);
    const diff = now.getTime() - targetDate.getTime();
    const diffInDays = diff / (1000 * 60 * 60 * 24);

    return diffInDays <= this.relevantDate;
  },

  //------------------------------------------------------------------------
  // Populate the list of stocks
  //------------------------------------------------------------------------
  async fillStocksList() {
    // let queryURL = `${this.baseURL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${this.apiKey}`;
    let queryURL = `${this.baseURL}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=KULR&apiKey=${this.apiKey}`;

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
  // Populate the list of stocks with news using Alpaca (which gets news
  // from Benzinga)
  //------------------------------------------------------------------------
  async fillStockNews() {
    let limit = "10"; //number of news articles to fetch
    console.log(this.stocks);
    for (const s of this.stocks) {
      try {
        // use ".gte" after "utc" for articles on and after the date or ".lte" for on and before
        let queryURL = `${this.baseURL}/v2/reference/news?ticker=${s.symbol}&order=desc&limit=${limit}&sort=published_utc&apiKey=${this.apiKey}`;
        console.log(queryURL);
        const response = await axios.get(queryURL);
        const news = response.data;

        news.results.forEach((newsArticle) => {
          // Only relevant news
          if (this.withinRelevantTime(newsArticle.published_utc)) {
            console.log(newsArticle);
            let newsMap = new Map();
            newsMap.set("date", newsArticle.published_utc);
            newsMap.set("title", newsArticle.title);

            // For Polygon.io, get the sentiment reasoning, if it exists, and add it to the
            // description
            let descr = newsArticle.description;
            if (newsArticle.hasOwnProperty("insights")) {
              newsArticle.insights.forEach((insight) => {
                if (insight.ticker === s.symbol) {
                  descr = descr.concat(" ").concat(insight.sentiment_reasoning);
                }
              });
            }
            newsMap.set("description", descr);
            s.news.set(newsArticle.article_url, newsMap);
          }
        });
      } catch (err) {
        console.error("Error querying Polygon.io to get stock news", err);
      }
    }

    for (const s of this.stocks) {
    }

    console.log(this.stocks[0].news);
  },

  //------------------------------------------------------------------------
  // Get recommendations for what stocks to buy based on the news
  //------------------------------------------------------------------------
  async getStockSuggestions() {
    return 0;
  },
};

export default newsBot;
