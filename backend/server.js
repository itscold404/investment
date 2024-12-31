import Alpaca from "@alpacahq/alpaca-trade-api";
import dotevn from "dotenv";
import express from "express";
import cors from "cors";
import newsBot from "./newsBot.js";

dotevn.config({ path: "../.env" });

//------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------
const BACKEND_PORT = process.env.VITE_BACKEND_PORT;
const FRONT_PORT = process.env.FRONT_END_PORT;
const PAPER_API = process.env.ALPACA_PAPER_API_KEY;
const PAPER_SECRET = process.env.ALPACA_SECRET_API_KEY;

// TODO: remove this after testing. Should be called when front end decides
// the range
// await newsBot.fillStocksList(5, 10);
// await newsBot.fillStockNews();

//------------------------------------------------------------------------
// Connection things
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
      origin: `http://localhost:${FRONT_PORT}`, // Only talk to this port
    })
  )
  .use(express.json());

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
    const account = await alpacaPaper.getAccount();
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
  console.log("received button press");
  let lower = req.body.lowerBound;
  let upper = req.body.upperBound;
  let stocks = await newsBot.getStockSuggestions(lower, upper);
  res.json({ stocks: stocks });
});

backend.listen(BACKEND_PORT, () => {
  console.log(`Server running on http://localhost:${BACKEND_PORT}`);
});
