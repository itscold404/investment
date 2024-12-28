<!-- Page to display stock suggestions -->
<template>
  <div>
    <div class="card">
      <p>hello</p>
      <button type="button" @click="goBack">"<=="</button>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    goBack() {
      this.$router.push({ name: "HelpSelectionPage" });
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

button {
  width: 300px;
  padding: 10px;
  font-size: 24px;
  border: 2px solid #000000;
  border-radius: 5px;
  background-color: white;
}
</style>
