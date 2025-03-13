import rssFeedURLs from "../../data/rss_URLs.js";
import dotevn from "dotenv";
import Stock from "./stock.js";
import https from "https";
import fs from "fs";
import Parser from "rss-parser";
import WebSocket from "ws";
import { Mutex } from "async-mutex";
import OpenAI from "openai";
import { httpGET, httpPOST, alpacaGET } from "../util/httpUtil.js";
import { certLocation } from "../util/certs.js";

dotevn.config({ path: "../../.env" });

//==============================================================================
// Purpose: helper class for getting and processing news
//==============================================================================

const newsBot = {
  //----------------------------------------------------------------------------
  // Constants and global variables
  //----------------------------------------------------------------------------
  POLYGON_BASE_URL: process.env.POLYGON_BASE_URL, // Polygon.io base url
  POLYGON_API_KEY: process.env.POLYGON_API_KEY, // Polygon.io API key
  ALPACA_API_KEY: process.env.ALPACA_PAPER_API_KEY, // Polygon.io base url
  ALPACA_SECRET: process.env.ALPACA_SECRET_API_KEY, // Polygon.io API key
  RELEVANT_DATE: 1, // Number of days that passed of relevant news article
  ENABLE_POLYGON_API: false, // Make or not make API calls to Polygon.io
  ML_PORT: process.env.ML_PORT, //Port for sentiment analysis API

  // How often to fetch from RSS feed in minutes. Default is 10
  RSS_REFRESH: 10,

  // URL for Alpaca's websocket news
  ALPACA_WEBSOCKET_NEWS_URL: "wss://stream.data.alpaca.markets/v1beta1/news",

  // URL for Alpaca's websocket news
  ALPACA_WEBSOCKET_TEST_NEWS_URL:
    "wss://stream.data.sandbox.alpaca.markets/v1beta1/news",

  // Number of news in liveNews before removing old news
  LIVE_NEWS_ARRAY_LIMIT: 100,

  // Number of articles to receive per API call to Polygon.io and
  // Alpaca for stock news
  ARTICLE_LIMIT_PER_CALL: 50,

  // Number of stocks per API request to Alpaca for news
  STOCK_PER_REQUEST_PATCH: 60,

  // Cert for HTTPS communication
  HTTPS_AGENT: new https.Agent({
    ca: fs.readFileSync(certLocation),
  }),

  // OpenAI
  openai: new OpenAI({
    apiKey: process.env.OPEN_AI_KEY,
  }),

  // All stocks, as a Stock object in the stock market with percent
  // change within [returnLowerBound, returnHigherBound].
  // This hashmap is formatted: {"stock_symbol": Stock}
  stocks: new Map(),

  // Map of long name of stocks to their ticket symbol
  longNameToSymbol: new Map(),

  // RSS feed parser
  rssParser: new Parser(),

  // All URL's to listen for RSS feeds
  rssFeedURLs: rssFeedURLs,

  // All news gathered from RSS feeds as this bot is running. To be
  // displayed to front-end.
  // Elements should be {title: "title", url: "url"}
  liveNews: [],

  // RSS news queued to be processed (fetching their organization name).
  // Elements are ["title", ...]
  queuedRSSNews: [],

  // Websocket news queued to be processed (fetching their organization name).
  // Elements are [{title: "news title", symbols: ["ticker symbols", ...]}, ...]
  queuedWebsocketNews: [],

  // Set of stocks from todays news
  todayPotentialStockSet: new Set(),

  // Mutex used to add to liveNews array
  liveNewsMutex: new Mutex(),

  // Mutex used to add to queuedRSSNews array
  queuedRSSNewsMutex: new Mutex(),

  // Mutex used to add to queuedWebsocketNews array
  queuedWebsocketNewsMutex: new Mutex(),

  containsSpecial: [], // for testing purposes

  //----------------------------------------------------------------------------
  // Initialize the bot
  // int rssRefresh: How often to fetch from RSS feeds
  //----------------------------------------------------------------------------
  init_bot(rssRefresh) {
    this.RSS_REFRESH = rssRefresh;

    // Get news through RSS Feeds, but make a call on program startup
    this.fetchRSS();
    setInterval(async () => {
      await this.fetchRSS();
    }, this.RSS_REFRESH * 60 * 1000);

    // Process all news every 30 seconds
    let rateAllNewsTime = 0.5;
    setInterval(async () => {
      await this.processRawNews();
    }, rateAllNewsTime * 60 * 1000);

    // Start getting news from Alpaca websocket
    this.listenAlpacaWebsocket();
    return newsBot;
  },

  //----------------------------------------------------------------------------
  // Add news from RSS feeds and Alpaca websocket (live news) with mutex to
  // the BEGINNING of liveNews array.
  // string newsTitle: Title of the article
  // string url: URL of the article
  //----------------------------------------------------------------------------
  async addLiveNews(newsTitle, url) {
    let newsToAdd = { title: newsTitle, url: url };
    const relaseFunc = await this.liveNewsMutex.acquire();

    try {
      try {
        this.liveNews.unshift(newsToAdd);

        if (this.liveNews.length > this.LIVE_NEWS_ARRAY_LIMIT) {
          this.liveNews.pop();
        }
      } finally {
        relaseFunc();
      }
    } catch (err) {
      console.error("Failed to aquire liveNewsMutex", err);
    }
  },

  //----------------------------------------------------------------------------
  // Add news from RSS feeds and Alpaca websocket (live news) with mutex to
  // the rawNews array.
  // string newsTitle: Title of the article
  //----------------------------------------------------------------------------
  async addRSSNews(newsTitle) {
    const relaseFunc = await this.queuedRSSNewsMutex.acquire();
    try {
      try {
        this.queuedRSSNews.push(newsTitle);
      } finally {
        relaseFunc();
      }
    } catch (err) {
      console.error("Failed to aquire queuedRSSNewsMutex", err);
    }
  },

  //----------------------------------------------------------------------------
  // Add news from RSS feeds and Alpaca websocket (live news) with mutex to
  // the rawNews array.
  // map newsMap: object of news article formatted like this :
  //              {title: "title", symbols: ["SYM", "BOLS", ...]}
  //----------------------------------------------------------------------------
  async addWebsocketNews(newsMap) {
    const relaseFunc = await this.queuedWebsocketNewsMutex.acquire();

    try {
      try {
        this.queuedWebsocketNews.push(newsMap);
      } finally {
        relaseFunc();
      }
    } catch (err) {
      console.error("Failed to aquire queuedWebsocketNewsMutex", err);
    }
  },

  //----------------------------------------------------------------------------
  // Check if the UTC date is within the Time specified
  // String utcDate: the UTC Date as a string (ex. 2024-05-10T20:15:00Z)
  // return true if the UTC date is within. false otherwise
  //----------------------------------------------------------------------------
  withinRelevantDate(utcDate) {
    const now = new Date();
    const targetDate = new Date(utcDate);
    const diff = now.getTime() - targetDate.getTime();
    const diffInDays = diff / (1000 * 60 * 60 * 24);

    return diffInDays <= this.RELEVANT_DATE;
  },

  //----------------------------------------------------------------------------
  // Check if the RSS feed news should be added depending on its publishing
  // date and time
  // Date pubDate: the UTC Date
  // return true if it should be added. false otherwise
  //----------------------------------------------------------------------------
  shouldAddRssFeed(pubDate) {
    // If pubDate is older than currtime - RSS_REFRESH, then we know that
    // this news from the rss feed has already been seen/processed
    const now = new Date();
    const refresh = this.RSS_REFRESH * 60 * 1000;
    const timeDiff = now.getTime() - pubDate;

    return timeDiff <= refresh;
  },

  //----------------------------------------------------------------------------
  // Ask OpenAI for impact score of current news
  // array of arrays of texts: array of array(s) of strings to search for
  //                           organizations
  // return the list of scores for each news
  //----------------------------------------------------------------------------
  async askOpenAI(texts) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        store: true,
        messages: [{ role: "user", content: "write a haiku about ai" }],
      });

      completion.then((result) => console.log(result.choices[0].message));
    } catch (err) {
      console.log("Error with OpenAI news processing:", err);
    }
  },

  //----------------------------------------------------------------------------
  // Populate the list of stocks with percent change of
  // [lowerBound, upperBound]
  //
  // int lowerBound: Lower bound of stock price change for 1 day
  // int upperBound: Higher bound of stock price change for 1 day
  //----------------------------------------------------------------------------
  async fillStocksList(lowerBound, upperBound) {
    let queryURL = `${this.POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${this.POLYGON_API_KEY}`;
    // let queryURL = `${this.POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=PAYC&apiKey=${this.POLYGON_API_KEY}`;

    console.log(lowerBound, upperBound);

    const response = await httpGET(queryURL);
    if (!response) return;
    const allStocks = response.data.tickers;

    allStocks.forEach((s) => {
      const percentChange = s.todaysChangePerc;
      const lastMarketPrice = s.min.c;
      if (lowerBound < percentChange && percentChange < upperBound) {
        let stock = new Stock(s.ticker, percentChange, lastMarketPrice);
        this.stocks.set(s.ticker, stock);
      }
    });
  },

  //----------------------------------------------------------------------------
  // Populate the list of stocks with news using Alpaca (which gets news
  // from Benzinga) and Polygon.io
  //----------------------------------------------------------------------------
  async fillStockNews() {
    // Populate news using Polygon.io API
    // TODO: could put this in a promise to get news without blocking and update
    // front end later
    if (this.ENABLE_POLYGON_API) {
      console.log("Requesting news from Polygon.io... this may take a bit...");
      for (const [key, value] of this.stocks) {
        // use ".gte" after "utc" for articles on and after the date or ".lte" for on and before
        const queryURL = `${this.POLYGON_BASE_URL}/v2/reference/news?ticker=${key}&order=desc&limit=${this.ARTICLE_LIMIT_PER_CALL}&sort=published_utc&apiKey=${this.POLYGON_API_KEY}`;
        const response = await httpGET(queryURL);
        if (!response) return;
        const news = response.data.results;

        news.forEach((newsArticle) => {
          // Only add relevant news
          if (this.withinRelevantDate(newsArticle.published_utc)) {
            let newsMap = new Map();
            newsMap.set("date", newsArticle.published_utc);
            newsMap.set("title", newsArticle.title);

            // For Polygon.io, get the sentiment reasoning for this stock, if it
            // exists, and add it to the description
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
            this.stocks.get(key).numNews += 1;
          }
        });
      }
    }

    // Find the date within relevant range
    let date = new Date();
    const day = date.getDate() - this.RELEVANT_DATE;
    date.setDate(day);

    // Populate news using Alpaca API
    console.log("Requesting news from Alpaca");
    const queryURL = "https://data.alpaca.markets/v1beta1/news";
    let numStocks = 0; // Which "index" this loop is on
    let numBatchesSent = 0; // Number of batches of requests sent to the API
    let articleCount = 0; // Number of total articles received
    let maxArticles = 0; // Maximum number of articles received from a request from a batch
    const stockBatch = []; // The batch of stock symbols to request news of
    for (const key of this.stocks.keys()) {
      numStocks += 1;
      stockBatch.push(key);

      // Send API calls in batches or if this is the last stock in the list
      if (
        numStocks % this.STOCK_PER_REQUEST_PATCH === 0 ||
        numStocks === this.stocks.size
      ) {
        const symbols = stockBatch.join(",");

        console.log("Requesting news on batch:", symbols);

        numBatchesSent += 1;
        const params = {
          symbols: symbols,
          start: date,
          limit: this.ARTICLE_LIMIT_PER_CALL,
        };

        const response = await alpacaGET(queryURL, params);
        if (!response) continue;
        const news = response.data.news;

        // For each article, add the news article to related stocks if not already added
        let findMax = 0;
        news.forEach((newsArticle) => {
          articleCount += 1;
          findMax += 1;
          newsArticle.symbols.forEach((ticker) => {
            if (
              this.stocks.has(ticker) &&
              !this.stocks.get(ticker).news.has(newsArticle.url)
            ) {
              let newNews = new Map();
              newNews.set("date", newsArticle.created_at);
              newNews.set("title", newsArticle.headline);

              // Could experiment with adding newsArticle.content to description but content
              // seems to be html code
              newNews.set("description", newsArticle.summary);

              // Populate the infomation of the stock
              let mostRecent = this.stocks.get(ticker).newestNewsDate;
              let currDate = new Date(newsArticle.created_at);
              if (mostRecent === "" || mostRecent >= currDate) {
                this.stocks.get(ticker).newestNewsDate = currDate;
              }
              this.stocks.get(ticker).news.set(newsArticle.url, newNews);
              this.stocks.get(ticker).numNews += 1;
            }
          });
        });

        if (findMax > maxArticles) {
          maxArticles = findMax;
        }

        // Empty the parameter to fill with next batch of stock symbols
        stockBatch = [];
      }
    }

    console.log("**Alpaca has a limit of 50 articles per page**");
    console.log("This iteration:");
    console.log(
      "       Stocks per batch request:",
      this.STOCK_PER_REQUEST_PATCH
    );
    console.log("       Number of stocks:", numStocks);
    console.log(
      "       Average articles per page:",
      articleCount / numBatchesSent
    );
    console.log("       Max articles per page:", maxArticles);
  },

  //----------------------------------------------------------------------------
  // Perform sentiment Analysis all news on the stocks. Sends all news
  // in one batch.
  //----------------------------------------------------------------------------
  async getSentimentAnalysisAllNews() {
    // Create two arrays, one of identifiers and one of value's to run in
    // sentiment analysis. Send as one batch to take advantage of
    // transformers parellel processing and reduce sending request overhead
    const id = []; // Array of [stock symbol, url]
    const newsToAnalyze = []; // Array of [title + description]

    for (const [key, stock] of this.stocks) {
      for (const url of stock.news.keys()) {
        let currID = [key, url];
        id.push(currID);

        let currNewsTitle = stock.news.get(url).get("title");
        let currNewsDesc = stock.news.get(url).get("description");
        let ValueToProcess = currNewsTitle.concat(" ").concat(currNewsDesc);
        newsToAnalyze.push(ValueToProcess);
      }
    }

    // Perform sentiment analysis with ML.py
    const response = await httpPOST(
      `https://localhost:${this.ML_PORT}/analyze`,
      [newsToAnalyze]
    );
    if (!response) return;
    const scores = response.data["results"][0];
    console.log("new post scores:", scores);

    // Log a sanity check
    console.log("Ensure the numbers below are the same:");
    console.log(
      "       Number of news sent to be processed:",
      newsToAnalyze.length
    );
    console.log("       Number of ids created", id.length);
    console.log(
      "       Number of scores returned from processing",
      scores.length
    );

    // Populate our map of all stocks with the analysis results
    if (scores.length === id.length && scores.length === newsToAnalyze.length) {
      for (let i = 0; i < id.length; ++i) {
        const analysisScore = scores[i];
        const symbol = id[i][0];
        const url = id[i][1];

        if (analysisScore === 1) {
          this.stocks.get(symbol).posNewsList.push([url, newsToAnalyze[i]]);
        } else if (analysisScore === -1) {
          this.stocks.get(symbol).negNewsList.push([url, newsToAnalyze[i]]);
        } else {
          this.stocks.get(symbol).neuNewsList.push([url, newsToAnalyze[i]]);
        }

        this.stocks.get(symbol).sentScore += analysisScore;
      }
    } else {
      console.error(
        "LENGTH OF SCORES FROM SENTIMENT ANALYSIS DOES NOT MATCH LENGTH OF ID'S"
      );
    }
  },

  //----------------------------------------------------------------------------
  // Get recommendations for what stocks to buy based on the news
  // int lower: lower bounds as a percent
  // int upper: upperbound as a percent
  //----------------------------------------------------------------------------
  async getStockSuggestions(lower, upper) {
    await this.fillStocksList(lower, upper);
    await this.fillStockNews();
    await this.getSentimentAnalysisAllNews();
    return Array.from(this.stocks.values());
  },

  //----------------------------------------------------------------------------
  // Fetch news from RSS. Populate the array of live news
  //----------------------------------------------------------------------------
  async fetchRSS() {
    try {
      const feedPromises = this.rssFeedURLs.map((url) =>
        this.rssParser.parseURL(url)
      );
      const feeds = await Promise.all(feedPromises);

      const rssFeedsPromises = feeds.map(async (feed) => {
        try {
          // Just grab the newest from the feed as feeds do not update requently
          // enough
          const newest = feed["items"][0];
          const pubDate = new Date(newest["pubDate"]);

          if (this.shouldAddRssFeed(pubDate)) {
            const url = newest["link"];
            const title = newest["title"];
            console.log(title, url);
            await Promise.all([
              this.addLiveNews(title, url),
              this.addRSSNews(title),
            ]);
          }
        } catch (err) {
          console.error("Error with processing RSS feed data: ", err);
        }
      });

      await Promise.all(rssFeedsPromises);
    } catch (err) {
      console.error("Error with receiving data from RSS feed: ", err);
    }
  },

  //----------------------------------------------------------------------------
  // Start listening to Alpaca's websocket
  //----------------------------------------------------------------------------
  async listenAlpacaWebsocket() {
    const ws = new WebSocket(this.ALPACA_WEBSOCKET_NEWS_URL);

    ws.on("open", () => {
      console.log("Connected to Alpaca websocket");

      ws.send(
        JSON.stringify({
          action: "auth",
          key: this.ALPACA_API_KEY,
          secret: this.ALPACA_SECRET,
        })
      );
    });

    ws.on("message", async (d) => {
      const message = JSON.parse(d)[0];

      if (message.T === "success" && message.msg === "authenticated") {
        console.log("Authenticated in Alpaca websocket");
        ws.send(
          JSON.stringify({
            action: "subscribe",
            news: ["*"],
          })
        );
      } else if (message.T === "n") {
        this.addLiveNews(message.headline, message.url);
        const involvedTickers = [];
        for (const symbol of message.symbols) {
          involvedTickers.push(symbol);
        }

        this.addWebsocketNews({
          title: message.headline,
          symbols: involvedTickers,
        });
        const currTime = new Date().toISOString();
        console.log(
          "Web socket:",
          currTime,
          message.headline,
          message.url,
          involvedTickers
        );
      } else {
        console.log("Recieved unrecognized data from Alpaca", message);
      }
    });

    ws.on("error", (err) => {
      console.log("Websocket error:", err);
    });

    ws.on("close", () => {
      console.log("Alpaca websocket closed");
    });
  },

  //----------------------------------------------------------------------------
  // Process the raw news before clearing it. Add potential stock tickers
  // to todayPotentialStockSet.
  //----------------------------------------------------------------------------
  async processRawNews() {
    // Create a copy of news to prevent holding onto the lock
    const relaseFuncRSS = await this.queuedRSSNewsMutex.acquire();
    let rssNewsForProcess = this.queuedRSSNews;
    this.queuedRSSNews = [];
    relaseFuncRSS();

    const relaseFuncWebsocket = await this.queuedWebsocketNewsMutex.acquire();
    const copyWebsocketNews = this.queuedWebsocketNews;
    this.queuedWebsocketNews = [];
    relaseFuncWebsocket();

    // Get the sentiment analysis scores
    const websocketNewsForProcess = [];
    for (let i = 0; i < copyWebsocketNews.length; ++i) {
      websocketNewsForProcess.push(copyWebsocketNews[i]["title"]);
    }

    // TODO: need to find way to kill/prevent this process if ML.py is not up
    // Perform sentiment analysis with ML.py
    const scoreData = await httpPOST(
      `https://localhost:${this.ML_PORT}/analyze`,
      [rssNewsForProcess, websocketNewsForProcess]
    );
    if (!scoreData) return;
    const scores = scoreData.data["results"];
    console.log(scores);

    if (scores.length == 0) {
      console.log("Analysis API is down");
      return;
    }
    // Filter for RSS news worth processing more. Add good websocket news symbol to set
    const rssScores = scores[0];
    const wsScores = scores[1];
    const processMoreRSS = [];

    for (let i = 0; i < rssScores.length; ++i) {
      if (rssScores[i] >= 0.75) {
        processMoreRSS.push(rssNewsForProcess[i]);
      }
    }
    for (let i = 0; i < wsScores.length; ++i) {
      if (wsScores[i] >= 0.75) {
        for (let symbol of copyWebsocketNews[i]["symbols"]) {
          this.todayPotentialStockSet.add(symbol);
        }
      }
    }

    // Check list to remove part of sentence after special character "&#""
    // This only happens in RSS news
    try {
      for (let i = 0; i < processMoreRSS.length; ++i) {
        const specialIndex = processMoreRSS[i].indexOf("&#");
        if (specialIndex !== -1) {
          this.containsSpecial.push(processMoreRSS[i]);
          processMoreRSS[i] = processMoreRSS[i].substring(0, specialIndex);
          console.log("SPECIAL CHARACTERS DETECTED", this.containsSpecial);
        }
      }
    } catch (err) {
      console.error("Error with processing news", err);
    }

    // Find organizations within text with ML.py
    const orgData = await httpPOST(
      `https://localhost:${this.ML_PORT}/findTickers`,
      processMoreRSS
    );
    if (!orgData) return;
    const orgs = orgData.data["symbols"];
    for (const org of orgs) {
      this.todayPotentialStockSet.add(org);
    }
  },
};

export default newsBot;
