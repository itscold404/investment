import dotevn from "dotenv";
import express from "express";
import fs from "fs";
import worker from "worker_threads";
import https from "https";
import { keyLocation, certLocation } from "../certs.js";
dotevn.config({ path: "../../.env" });

//------------------------------------------------------------------------
// Purpose: Buys suitable stocks and assigns workers to manage the stock
//------------------------------------------------------------------------

//------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------
const MASTER_PORT = process.env.MASTER_PORT; // Port number for this service
const MAX_WORKERS = 4; // Maximum number of workers running at all times
let potentialTickers = [];

let options = {
  key: fs.readFileSync(keyLocation),
  cert: fs.readFileSync(certLocation),
};

const app = express();
app.use(express.json());
https.createServer(options, app).listen(MASTER_PORT, () => {
  console.log(`Master running on port https://localhost:${MASTER_PORT}`);
});

//------------------------------------------------------------------------
// Put function to update the potential tickers
//------------------------------------------------------------------------
app.put("/updateTickers", (req, res) => {
  potentialTickers = req.body.potentialTickers;
  console.log(potentialTickers);
});
