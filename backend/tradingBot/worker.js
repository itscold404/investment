import { workerData, parentPort } from "worker_threads";

//========================================================================
// Purpose: Manage when to sell stocks
//========================================================================

//------------------------------------------------------------------------------
// Constants and Globals
//------------------------------------------------------------------------------
const CHECK_MOMENTUM_SEC = 5; // How often to check the momentum of this ticker
let ticker = workerData.ticker; // Ticker symbol this worker is managing

//------------------------------------------------------------------------------
// Inform parent what stock has been sold
//------------------------------------------------------------------------------
function notifyPositionClosed() {
  parentPort.postMessage(ticker);
}

//------------------------------------------------------------------------------
// Check if this stock still has momentum to continue
//------------------------------------------------------------------------------
async function checkMomentum() {}

//------------------------------------------------------------------------------
// Main Logic
//------------------------------------------------------------------------------
// Message from parent means new ticker assigned
parentPort.on("message", (message) => {
  ticker = message;
});

setInterval(async () => {
  checkMomentum();
}, CHECK_MOMENTUM_SEC * 1000);
