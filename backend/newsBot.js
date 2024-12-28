import axios from "axios";
import dotevn from "dotenv";
import Stock from "./stock.js";

dotevn.config({ path: "../.env" });

const newsBot = {
  polygonBaseURL: process.env.POLYGON_BASE_URL, // Polygon.io base url
  polygonAPIKey: process.env.POLYGON_API_KEY, // Polygon.io API key
  alpacaAPIKey: process.env.ALPACA_PAPER_API_KEY, // Polygon.io base url
  alpacaSecret: process.env.ALPACA_SECRET_API_KEY, // Polygon.io API key
  relevantDate: 7, // Number of days that passed of relevant news article

  // Number of articles to receive per API call to Polygon.io and
  // Alpaca for stock news
  articleLimitPerCall: 50,

  // Number of stocks per API request to Alpaca for news
  stocksPerRequestBatch: 20,

  // TODO: make it so that these values can be set by the front-end
  returnLowerBound: 5, // Lower bound of stock price change for 1 day
  returnHigherBound: 30, // Higher bound of stock price change for 1 day

  nameToSymbol: new Map(), // Maps name of stock to its symbol

  // All stocks, as a Stock object in the stock market with percent
  // change within [returnLowerBound, returnHigherBound].
  // This hashmap is formatted: {stock_symbol: Stock}
  stocks: new Map(),

  //------------------------------------------------------------------------
  // Sorts the list of stocks in decending 1 day percent change
  //------------------------------------------------------------------------
  sortStockDescending(list) {
    // let sorted = list.sort((a, b) => b.dayPercentChange - a.dayPercentChange);
    // return sorted;
  },

  //------------------------------------------------------------------------
  // Sorts the list of stocks in decending 1 day percent change
  //------------------------------------------------------------------------
  sortStockAscending(list) {
    // let sorted = list.sort((a, b) => a.dayPercentChange - b.dayPercentChange);
    // return sorted;
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
    let queryURL = `${this.polygonBaseURL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${this.polygonAPIKey}`;
    // let queryURL = `${this.polygonBaseURL}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=TSLA&apiKey=${this.polygonAPIKey}`;

    try {
      const response = await axios.get(queryURL);
      const allStocks = response.data.tickers;

      allStocks.forEach((s) => {
        let percentChange = s.todaysChangePerc;
        if (this.returnLowerBound < percentChange && percentChange < this.returnHigherBound) {
          let stock = new Stock(s.ticker, percentChange);
          this.stocks.set(s.ticker, stock);
        }
      });
    } catch (err) {
      console.error("Error querying Polygon.io to get stock symbols:", err);
    }
  },

  //------------------------------------------------------------------------
  // Populate the list of stocks with news using Alpaca (which gets news
  // from Benzinga) and Polygon.io
  //------------------------------------------------------------------------
  async fillStockNews() {
    // Populate news using Polygon.io API
    console.log("Requesting news from Polygon.io... this may take a bit...");
    for (const [key, value] of this.stocks) {
      try {
        // use ".gte" after "utc" for articles on and after the date or ".lte" for on and before
        let queryURL = `${this.polygonBaseURL}/v2/reference/news?ticker=${key}&order=desc&limit=${this.articleLimitPerCall}&sort=published_utc&apiKey=${this.polygonAPIKey}`;
        const response = await axios.get(queryURL);
        const news = response.data;

        news.results.forEach((newsArticle) => {
          // Only relevant news
          if (this.withinRelevantTime(newsArticle.published_utc)) {
            let newsMap = new Map();
            newsMap.set("date", newsArticle.published_utc);
            newsMap.set("title", newsArticle.title);

            // For Polygon.io, get the sentiment reasoning, if it exists, and add it to the
            // description
            let descr = newsArticle.description;
            if (newsArticle.hasOwnProperty("insights")) {
              newsArticle.insights.forEach((insight) => {
                if (insight.ticker === key) {
                  descr = descr.concat(" ").concat(insight.sentiment_reasoning);
                }
              });
            }
            newsMap.set("description", descr);
            value.news.set(newsArticle.article_url, newsMap);
          }
        });
      } catch (err) {
        console.error("Error querying Polygon.io to get stock news", err);
      }
    }

    // Find the date within relevant range
    let date = new Date();
    let day = date.getDate() - this.relevantDate;
    date.setDate(day);

    // Populate news using Alpaca API
    console.log("Requesting news from Alpaca");
    let queryURL = "https://data.alpaca.markets/v1beta1/news";
    let headers = {
      "APCA-API-KEY-ID": this.alpacaAPIKey,
      "APCA-API-SECRET-KEY": this.alpacaSecret,
    };

    let numStocks = 0;
    let numPages = 0;
    let articleCount = 0;
    let maxArticles = 0;
    let stockBatch = [];
    for (const key of this.stocks.keys()) {
      numStocks += 1;
      stockBatch.push(key);

      // Send API calls in batches or if this is the last stock in the list
      if (numStocks % this.stocksPerRequestBatch == 0 || numStocks == this.stocks.size) {
        let symbols = stockBatch.join(",");

        console.log("Requesting news on batch:", symbols);

        numPages += 1; //remove after testing
        let params = {
          symbols: symbols,
          start: date,
          limit: this.articleLimitPerCall,
        };

        try {
          const response = await axios.get(queryURL, { headers, params });
          const news = response.data;

          // For each article, add the news article to related stocks if not already added
          let findMax = 0;
          news.news.forEach((newsArticle) => {
            articleCount += 1;
            findMax += 1;
            newsArticle.symbols.forEach((ticker) => {
              if (this.stocks.has(ticker) && !this.stocks.get(ticker).news.has(newsArticle.url)) {
                let newNews = new Map();
                newNews.set("date", newsArticle.created_at);
                newNews.set("title", newsArticle.headline);

                // Could experiment with adding newsArticle.content to description but content
                // seems to be html code
                newNews.set("description", newsArticle.summary);

                this.stocks.get(ticker).news.set(newsArticle.url, newNews);
              }
            });
          });
          if (findMax > maxArticles) {
            maxArticles = findMax;
          }
        } catch (err) {
          console.error("Error querying Alpaca to get stock news", err);
        }

        stockBatch = [];
      }
    }

    console.log("**Alpaca has a limit of 50 articles per page**");
    console.log("This iteration:");
    console.log("               Stocks per batch request:", this.stocksPerRequestBatch);
    console.log("               Number of stocks:", numStocks);
    console.log("               Average articles per page:", articleCount / numPages);
    console.log("               Max articles per page:", maxArticles);
  },

  //------------------------------------------------------------------------
  // Get recommendations for what stocks to buy based on the news
  //------------------------------------------------------------------------
  async getStockSuggestions() {
    return 0;
  },
};

export default newsBot;
