import { createRouter, createWebHistory } from "vue-router";
import HelpSelectionPage from "../components/HelpSelectionPage.vue";
import StockSuggestionPage from "../components/StockSuggestionPage.vue";

const routes = [
  {
    path: "/",
    name: "HelpSelectionPage",
    component: HelpSelectionPage,
  },
  {
    path: "/StockSuggestionPage",
    name: "StockSuggestionPage",
    component: StockSuggestionPage,
  },
  // {
  //   path: "/PaperTrading",
  //   name: "Paper Trading",
  //   component: // fill later,
  // },
  // {
  //   path: "/RealTrading",
  //   name: "Real Trading",
  //   component: // fill later,
  // },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
