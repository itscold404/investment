<!-- Page to display stock suggestions -->
<template>
  <div>
    <div class="card">
      <button id="back-button" type="button" @click="goBack"><== Back</button>

      <!-- Form to input upper and lower bound stock price change range -->
      <div v-if="!loading && !receivedData">
        <h2>Find stocks with daily move(%)</h2>
        <p>Lower bound:</p>
        <input
          id="lower-input"
          class="input-bars"
          v-model="lowerBound"
          placeholder="5"
          type="number"
        />
        <p>Upper bound</p>
        <input
          id="upper-input"
          class="input-bars"
          v-model="upperBound"
          placeholder="30"
          type="number"
        />
        <button id="find-stocks-button" type="button" @click="findStocks">Find Stocks!</button>
      </div>

      <!-- Loading screen -->
      <div v-else-if="loading && !receivedData">
        <h2>Hang tight... this might take a bit</h2>
      </div>

      <!-- Retractable list of stock info -->
      <div v-else-if="!loading && receivedData">
        <h2>Yipeeee we have data!!</h2>
        <button id="sort-newest" type="button" @click="sortStocks('newest')">
          Sort: Newest News
        </button>
        <button id="sort-num-news" type="button" @click="sortStocks('mostNews')">
          Sort: # of News
        </button>
        <button id="sort-percent-change" type="button" @click="sortStocks('percentChange')">
          Sort: % Change
        </button>
        <button id="sort-percent-change" type="button" @click="sortStocks('sentScore')">
          Sort: Sentiment Score
        </button>

        <div v-for="(stock, index) in sortedStocks" :key="stock.symbol" class="stock-item">
          <div class="stock-summary" @click="toggleStock(index)">
            {{ stock.symbol }} -- Price:${{ stock.dayPercentChange }}, 1D Change:
            {{ stock.dayPercentChange }}%, Average Sentiment: {{ stock.sentScore }}
          </div>

          <div class="stock-details" v-if="expandedIndex === index">
            <h3>{{ stock.symbol }}</h3>
            <h3>Positive News</h3>
            <div v-for="pn in stock.posNewsList" :key="pn[0] + stock.symbol">
              <p>{{ pn[1] }}</p>
              <a :href="pn[0]" target="_blank">LINK</a>
              <p>----------</p>
            </div>
            <h3>Neutral News</h3>
            <div v-for="nen in stock.neuNewsList" :key="nen[0] + stock.symbol">
              <p>{{ nen[1] }}</p>
              <a :href="nen[0]" target="_blank">LINK</a>
              <p>----------</p>
            </div>
            <h3>Negative News</h3>
            <div v-for="negn in stock.negNewsList" :key="negn[0] + stock.symbol">
              <p>{{ negn[1] }}</p>
              <a :href="negn[0]" target="_blank">LINK</a>
              <p>----------</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Screen -->
      <div v-else-if="receivedError">
        <h2>Well... that's unexpected... you got an error</h2>
      </div>

      <!-- *Shrug -->
      <div v-else>
        <h2>Something funky is going on</h2>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
const backend_port = import.meta.env.VITE_BACKEND_PORT;
export default {
  data() {
    return {
      loading: false,
      receivedData: false,
      receivedError: false,
      lowerBound: 5,
      upperBound: 30,
      stocks: {},
      expandedIndex: null,
      sortStocksBy: "newest",
    };
  },
  methods: {
    goBack() {
      this.$router.push({ name: "HelpSelectionPage" });
    },

    //------------------------------------------------------------------------
    // Request stock news from the server
    //------------------------------------------------------------------------
    async findStocks() {
      this.loading = true;
      this.receivedData = false;
      this.receivedError = false;

      try {
        console.log(this.loading, this.receivedData);
        const response = await axios.post(`http://localhost:${backend_port}/stockSuggestions`, {
          lowerBound: this.lowerBound,
          upperBound: this.upperBound,
        });
        this.stocks = response.data["stocks"];

        console.log(this.stocks);

        this.loading = false;
        this.receivedData = true;
      } catch (err) {
        this.loading = false;
        this.receivedError = true;
        console.error("Error requesting suggestion from server", err);
      }
    },

    //------------------------------------------------------------------------
    // Expand the stock information when click on the item
    //------------------------------------------------------------------------
    toggleStock(index) {
      if (index === this.expandedIndex) {
        this.expandedIndex = null;
      } else {
        this.expandedIndex = index;
      }
    },

    //------------------------------------------------------------------------
    // Expand the stock information when click on the item
    //------------------------------------------------------------------------
    sortStocks(attribute) {
      this.sortStocksBy = attribute;
    },
  },
  computed: {
    //------------------------------------------------------------------------
    // Sort stocks based on selected attribute
    //------------------------------------------------------------------------
    sortedStocks() {
      const stocksCopy = [...this.stocks];

      if (this.sortStocksBy === "mostNews") {
        // Sort by which stock has the most news. If there is a tie, sort by
        // newest news then by highest sentiment score
        stocksCopy.sort((a, b) => {
          if (a.numNews === b.numNews) {
            if (a.newestNewsDate === b.newestNewsDate) {
              return a.sentScore < b.sentScore ? 1 : -1;
            }
            return a.newestNewsDate < b.newestNewsDate ? 1 : -1;
          }
          return a.numNews < b.numNews ? 1 : -1;
        });
      } else if (this.sortStocksBy === "percentChange") {
        // Sort by which stock has highest percent change. If there is a tie,
        // sort by newest news then by most news
        stocksCopy.sort((a, b) => {
          if (a.dayPercentChange === b.dayPercentChange) {
            if (a.newestNewsDate === b.newestNewsDate) {
              return a.numNews < b.numNews ? 1 : -1;
            }
            return a.newestNewsDate < b.newestNewsDate ? 1 : -1;
          }
          return a.dayPercentChange < b.dayPercentChange ? 1 : -1;
        });
      } else if (this.sortStocksBy === "sentScore") {
        // Sort by which stock has highest sentiment score. If there is a tie,
        // sort by newest news then by most news
        stocksCopy.sort((a, b) => {
          if (a.sentScore === b.sentScore) {
            if (a.newestNewsDate === b.newestNewsDate) {
              return a.numNews < b.numNews ? 1 : -1;
            }
            return a.newestNewsDate < b.newestNewsDate ? 1 : -1;
          }
          return a.sentScore < b.sentScore ? 1 : -1;
        });
      } else {
        // Default: Sort by which stock has the newest news. If there is a tie,
        // sort by higest percent change, number of news then by highest sentiment score
        stocksCopy.sort((a, b) => {
          if (a.newestNewsDate === b.newestNewsDate) {
            if (a.dayPercentChange === b.dayPercentChange) {
              if (a.numNews === b.numNews) {
                return a.sentScore < b.sentScore ? 1 : -1;
              }
              return a.numNews < b.numNews ? 1 : -1;
            }
            return a.dayPercentChange < b.dayPercentChange ? 1 : -1;
          }
          return a.newestNewsDate < b.newestNewsDate ? 1 : -1;
        });
      }

      return stocksCopy;
    },
  },
};
</script>

<style>
.card {
  display: flex;
  flex-direction: column;
  gap: 30px;
  align-items: center;
}

.input-bars {
  width: 150px;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #000000;
  border-radius: 5px;
  background-color: white;
}

#back-button {
  width: 100px;
  padding: 10px;
  font-size: 12px;
  border: 2px solid #000000;
  border-radius: 5px;
  background-color: white;
}

#find-stocks-button {
  width: 100px;
  padding: 10px;
  font-size: 12px;
  border: 2px solid #000000;
  border-radius: 5px;
  background-color: white;
}

.stock-item {
  border: 1px solid #000000;
  margin-bottom: 8px;
  border-radius: 4px;
}

.stock-summary {
  padding: 8px;
  cursor: pointer;
  background-color: #0320fb42;
  font-weight: bold;
}

.stock-summary:hover {
  background-color: #1100ff8f;
}

.stock-details {
  padding: 4px;
  margin: 0 auto;
  max-width: 600px;
  word-wrap: break-word;
  justify-content: center;
}

.stock-details p {
  margin: 4px 0;
  line-height: 1.2;
}
</style>
