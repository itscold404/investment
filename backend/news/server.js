import { alpaca } from "../util/alpaca.js";
import dotevn from "dotenv";
import express from "express";
import cors from "cors";
import newsBot from "./newsBot.js";
import https from "https";
import fs from "fs";
import { keyLocation, certLocation } from "../util/certs.js";

dotevn.config({ path: "../../.env" });

//========================================================================
// Purpose: server for news
//========================================================================

//------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------
const BACKEND_PORT = process.env.VITE_BACKEND_PORT;
const FRONT_PORT = process.env.FRONT_END_PORT;

//------------------------------------------------------------------------
// Setup and connections
//------------------------------------------------------------------------
const backend = express();
backend
  .use(
    cors({
      origin: `https://localhost:${FRONT_PORT}`, // Only talk to this port
    })
  )
  .use(express.json());

let options = {
  key: fs.readFileSync(keyLocation),
  cert: fs.readFileSync(certLocation),
};

https.createServer(options, backend).listen(BACKEND_PORT, () => {
  console.log(`Server running on https://localhost:${BACKEND_PORT}`);
});

// Initialize the newsBot
const FEED_REFRESH_IN_MINUTES = 10;
var nb = newsBot.init_bot(FEED_REFRESH_IN_MINUTES);

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
    const account = await alpaca.getAccount();
    console.log(account);
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
