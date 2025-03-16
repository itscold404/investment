import axios from "axios";
import { certLocation } from "../util/certs.js";
import dotevn from "dotenv";
import fs from "fs";
import https from "https";
dotevn.config({ path: "../../.env" });

//==============================================================================
// Purpose: Buys suitable stocks and assigns workers to manage the stock
//==============================================================================

//------------------------------------------------------------------------------
// Constants and globals
//------------------------------------------------------------------------------
const HTTPS_AGENT = new https.Agent({ ca: fs.readFileSync(certLocation) });
const ALPACA_HEADER = {
  "APCA-API-KEY-ID": process.env.ALPACA_API_KEY,
  "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET,
};

//------------------------------------------------------------------------------
// HTTP GET function
// \param string queryURL: the url to request
// \return the data from the request url
//------------------------------------------------------------------------------
async function httpGET(queryURL) {
  try {
    let response = await axios.put(queryURL);
    return response;
  } catch (err) {
    console.error("Failed to make PUT rquest to", queryURL, ":", err);
    return null;
  }
}

//------------------------------------------------------------------------------
// HTTP PUT function
// \param string queryURL: the url to request
// \param array<any> data: the data to send to
// \param array<string> names: the names for the data to send. Used
// as the field name of the object sent
//------------------------------------------------------------------------------
async function httpPUT(queryURL, data, names) {
  if (!data || !names || data.length !== names.length) return;

  let mail = {};

  for (let i = 0; i < data.length; i++) {
    mail[names[i]] = data[i];
  }

  try {
    await axios.put(queryURL, mail, { httpsAgent: HTTPS_AGENT });
  } catch (err) {
    console.error("Failed to make PUT rquest to", queryURL, ":", err);
  }
}

//------------------------------------------------------------------------------
// HTTP POST function
// \param string queryURL: the url to request
// \param array<any> data: the data to send to the master
// as the field name of the object sent to the master
// \return the data object. If an error occures, return null instead
//------------------------------------------------------------------------------
async function httpPOST(queryURL, data) {
  try {
    const response = await axios.post(queryURL, data, {
      httpsAgent: HTTPS_AGENT,
    });
    return response;
  } catch (err) {
    console.error("Failed to make POST request to", queryURL, ":", err);
  }

  return null;
}

//------------------------------------------------------------------------------
// HTTP GET function specifically for Alpaca
// \param string queryURL: the url to request
// \param object params: object containing parameters for this query
// \return the data from the request url
//------------------------------------------------------------------------------
async function alpacaGET(queryURL, params) {
  try {
    const response = await axios.get(queryURL, {
      headers: ALPACA_HEADER,
      params,
    });
    return response;
  } catch (err) {
    console.error("Failed to make GET request to Alpaca's", queryURL, ":", err);
  }

  return null;
}

export { httpGET, httpPUT, httpPOST, alpacaGET };
