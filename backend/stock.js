class Stock {
  symbol = "";
  dayPercentChange = 0; // Percent change of stock today
  daySentScore = 0; // Overall sentiment score today
  weekSentScore = 0; // Overall sentiment score this week
  monthSentScore = 0; // Overall sentiment score this month
  // posNewsList = new Map(); // [title, url] of positive news
  // neuNewsList = new Map(); // [title, url] of neutral news
  // negNewsList = new Map(); // [title, url] of negative news

  // Map of all news within the set time range. Map of a map
  // Format is:
  // {article_url: {
  //      date: "the date as a string in UTC"
  //      title: "the title of the article"
  //      description: "description(polygon.io) or summary(alpaca) add sentiment to description for polygon.io"
  //    }
  // }
  news = new Map();

  constructor(symbol, percentChange) {
    this.symbol = symbol;
    this.dayPercentChange = percentChange;
  }
}

export default Stock;
