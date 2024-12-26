import { createRouter, createWebHistory } from "vue-router";
import HelpSelectionPage from "../components/HelpSelectionPage.vue";
import StockSuggestionPage from "../components/StockSuggestionPage.vue";

const routes = [
  {
    path: "/",
    name: "Help Selection Page",
    component: HelpSelectionPage,
  },
  {
    path: "/StockSuggestionPage",
    name: "Stock Suggestion Page",
    component: StockSuggestionPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
