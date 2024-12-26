<script setup>
defineProps({
  msg: String,
});
</script>

<template>
  <div>
    <h1>{{ msg }}</h1>
    <div class="card">
      <p>hello</p>
    </div>
  </div>
</template>

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
