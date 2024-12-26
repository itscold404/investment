import Alpaca from "@alpacahq/alpaca-trade-api";
import dotevn from "dotenv";
import express from "express";

dotevn.config({ path: "../.env" });

const backend = express();
const port = process.env.VITE_BACKEND_PORT;

const alpaca = new Alpaca({
  keyId: process.env.API_KEY,
  secretKey: process.env.SECRET_API_KEY,
  paper: true,
});

//------------------------------------------------------------------------------------
// Translate error messages to be user understandable
//------------------------------------------------------------------------------------
function translate_error(err) {
  if (err.message.includes("401")) {
    console.log("401: check your API keys");
  } else if (err.message.includes("403")) {
    console.log("403: check your API keys");
  } else {
    console.log(err.message);
  }
}

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

backend.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
