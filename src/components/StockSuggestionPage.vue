<!-- Page to display stock suggestions -->
<template>
  <div>
    <div class="card">
      <button id="back-button" type="button" @click="goBack"><== Back</button>
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
      <div v-else-if="loading && !receivedData">
        <h2>Hang tight... this might take a bit</h2>
      </div>
      <div v-else-if="!loading && receivedData">
        <h2>Yipeeee we have data!!</h2>
      </div>
      <div v-else-if="receivedError">
        <h2>Well... that's unexpected... you got an error</h2>
      </div>
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
    };
  },
  methods: {
    goBack() {
      this.$router.push({ name: "HelpSelectionPage" });
    },
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
        let data = response.data;

        this.loading = false;
        this.receivedData = true;
      } catch (err) {
        this.loading = false;
        this.receivedError = true;
        console.error("Error requesting suggestion from server", err);
      }
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
</style>
