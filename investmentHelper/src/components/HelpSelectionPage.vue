<template>
  <div>
    <h1>{{ "How can I help you?" }}</h1>
    <div class="card">
      <button type="button" @click="goToSuggestions">Stock Suggestions</button>
      <button type="button" @click="goToTesting">Paper Trading Test</button>
      <button type="button" @click="goToTrading">!ACTUAL Trading!</button>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    goToSuggestions() {
      this.$router.push("/StockSuggestionPage");
    },
    goToTesting() {},
    goToTrading() {},
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

button {
  width: 300px;
  padding: 10px;
  font-size: 24px;
  border: 2px solid #000000;
  border-radius: 5px;
  background-color: white;
}
</style>
