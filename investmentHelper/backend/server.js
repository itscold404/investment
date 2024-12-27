import Alpaca from "@alpacahq/alpaca-trade-api";
import dotevn from "dotenv";
import express from "express";
import polygonBot from "./polygonBot.js";

dotevn.config({ path: "../.env" });

//----------------------------------------------------------------------------------------------------
// Constants and Globals
//----------------------------------------------------------------------------------------------------
const port = process.env.VITE_BACKEND_PORT;
const PAPER_API = process.env.API_KEY;
const PAPER_SECRET = process.env.SECRET_API_KEY;
const polyBot = polygonBot.create(process.env.POLYGON_BASE_URL, process.env.POLYGON_API_KEY);

//----------------------------------------------------------------------------------------------------
// Connection things
//----------------------------------------------------------------------------------------------------
const alpacaPaper = new Alpaca({
  keyId: PAPER_API,
  secretKey: PAPER_SECRET,
  paper: true,
});

const backend = express();

//----------------------------------------------------------------------------------------------------
// Translate error messages to be user understandable
//----------------------------------------------------------------------------------------------------
function translate_error(err) {
  if (err.message.includes("401")) {
    console.log("401: check your API keys");
  } else if (err.message.includes("403")) {
    console.log("403: check your API keys");
  } else {
    console.log(err.message);
  }
}

//----------------------------------------------------------------------------------------------------
// Print Alpaca paper trading account information
//----------------------------------------------------------------------------------------------------
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

//----------------------------------------------------------------------------------------------------
// Stock suggestion page functions
//----------------------------------------------------------------------------------------------------
backend.get("/stockSuggestions", async (req, res) => {
  let thing = polyBot.getStockSuggestions();
  console.log(thing);
});

backend.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
