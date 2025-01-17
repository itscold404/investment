import Alpaca from "@alpacahq/alpaca-trade-api";
import dotevn from "dotenv";
import express from "express";
import cors from "cors";
import newsBot from "./newsBot.js";
import https from "https";
import fs from "fs";

dotevn.config({ path: "../.env" });

//------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------
var isPaperTrading = true;
const BACKEND_PORT = process.env.VITE_BACKEND_PORT;
const FRONT_PORT = process.env.FRONT_END_PORT;
const PAPER_API = process.env.ALPACA_PAPER_API_KEY;
const PAPER_SECRET = process.env.ALPACA_SECRET_API_KEY;

//------------------------------------------------------------------------
// Setup and connections
//------------------------------------------------------------------------
const alpacaPaper = new Alpaca({
  keyId: PAPER_API,
  secretKey: PAPER_SECRET,
  paper: true,
});

const backend = express();
backend
  .use(
    cors({
      origin: `https://localhost:${FRONT_PORT}`, // Only talk to this port
    })
  )
  .use(express.json());

let options = {
  key: fs.readFileSync("../cert/key.pem"),
  cert: fs.readFileSync("../cert/cert.pem"),
};

https.createServer(options, backend).listen(BACKEND_PORT, () => {
  console.log(`Server running on https://localhost:${BACKEND_PORT}`);
});

// Initialize the newsBot
// use prime number to prevent overlap with other timers?
const FEED_REFRESH_IN_SECONDS = 421;
// const FEED_REFRESH_IN_MINUTES = 0.1; // remove after testing
var nb = newsBot.init_bot(FEED_REFRESH_IN_SECONDS);

//------------------------------------------------------------------------
// Translate error messages to be user understandable
//------------------------------------------------------------------------
function translate_error(err) {
  if (err.message.includes("401")) {
    console.log("401: check your API keys");
  } else if (err.message.includes("403")) {
    console.log("403: check your API keys");
  } else {
    console.log(err.message);
  }
}

//------------------------------------------------------------------------
// Print Alpaca paper trading account information
//------------------------------------------------------------------------
backend.get("/test/printAccount", async (req, res) => {
  try {
    if (isPaperTrading) {
      const account = await alpacaPaper.getAccount();
      console.log(account);
    } else {
      // TODO: set up non-paper trading
    }
    console.log("*******************************");
    console.log("*** SERVER CONNECTION VALID ***");
    console.log("*******************************");
  } catch (err) {
    res.status(500).json({ error: err.message });
    translate_error(err);
  }
});

//------------------------------------------------------------------------
// Stock suggestion page functions
//------------------------------------------------------------------------
backend.post("/stockSuggestions", async (req, res) => {
  let lower = req.body.lowerBound;
  let upper = req.body.upperBound;
  let stocks = await nb.getStockSuggestions(lower, upper);
  res.json({ stocks: stocks });
});
