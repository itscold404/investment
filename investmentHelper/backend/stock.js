class Stock {
  symbol = "";
  dayPercentChange = 0; // Percent change of stock today
  numPosNews = 0; // Number of positive news
  numNeuNews = 0; // Number of neutral news
  numNegNews = 0; // Number of negative news
  posNewsList = []; // [title, url] of positive news
  neuNewsList = []; // [title, url] of neutral news
  negNewsList = []; // [title, url] of negative news

  constructor(symbol, percentChange) {
    this.symbol = symbol;
    this.dayPercentChange = percentChange;
  }

  //------------------------------------------------------------------------
  // Sets the number and news list
  // type: type of news (1 for positive, 0 for neutral, -1 for negative)
  //------------------------------------------------------------------------
  setPosNews(type, numNews, newsList) {
    if (type == 1) {
      this.numPosNews = numNews;
      this.posNewsList = newsList;
    } else if (type == 0) {
      this.numNeuNews = numNews;
      this.neuNewsList = newsList;
    } else {
      this.numNegNews = numNews;
      this.negNewsList = newsList;
    }
  }
}

export default Stock;
