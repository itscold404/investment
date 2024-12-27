class Stock {
  symbol = "";
  dayPercentChange = 0; // Percent change of stock today
  news = new Map(); // List of all news within the set time range
  daySentScore = 0; // Overall sentiment score today
  weekSentScore = 0; // Overall sentiment score this week
  monthSentScore = 0; // Overall sentiment score this month
  posNewsList = new Map(); // [title, url] of positive news
  neuNewsList = new Map(); // [title, url] of neutral news
  negNewsList = new Map(); // [title, url] of negative news

  constructor(symbol, percentChange) {
    this.symbol = symbol;
    this.dayPercentChange = percentChange;
  }
}

export default Stock;
