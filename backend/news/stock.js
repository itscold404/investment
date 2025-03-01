//=======================================================================
// Purpose: a stock object
//=======================================================================

class Stock {
  symbol = "";
  dayPercentChange = 0; // Percent change of stock today
  lastPrice = 0; // Last market price of this stock
  sentScore = 0; // The sentement score of the news searched for
  numNews = 0; // The number of news articles within the relevant period
  newestNewsDate = ""; // The most recent date of the news on this stock
  posNewsList = []; // Array of [url, title+description] of positive news
  neuNewsList = []; // Array of [url, title+description] of neutral news
  negNewsList = []; // Array of [url, title+description] of negative news

  // Map of all news within the set time range. Map of a map
  // Format is:
  // {article_url: {
  //      date: "the date as a string in UTC"
  //      title: "the title of the article"
  //      description: "description(polygon.io) or summary(alpaca) add sentiment to description for polygon.io"
  //      sentiment: "Positive or Negative"
  //    }
  // }
  news = new Map();

  constructor(symbol, percentChange, price) {
    this.symbol = symbol;
    this.dayPercentChange = percentChange.toFixed(2);
    this.lastPrice = price;
  }
}

export default Stock;
