/**
 * Days to Expiry — Public.com API Proxy Server
 *
 * Proxies requests from your dashboard to api.public.com,
 * bypassing browser CORS restrictions.
 *
 * Deploy free on Render.com, Railway.app, or Fly.io
 */

const express  = require("express");
const cors     = require("cors");
const fetch    = require("node-fetch");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "dte-public-proxy", timestamp: new Date().toISOString() });
});

// ── Public.com proxy ─────────────────────────────────────────────────────────
// All /public/* requests are forwarded to https://api.public.com/userapigateway/*
//
// Dashboard sends:
//   GET  /public/option-details/{accountId}/greeks?symbols=AAPL260220C00205000,...
//   POST /public/marketdata/{accountId}/option-chain   body: { instrument, expirationDate }
//   GET  /public/trading/account
//
// Headers required from dashboard:
//   Authorization: Bearer <token>
//   X-Public-Account-Id: <accountId>   (optional, proxy can inject it)

app.all("/public/*", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

    // Strip /public prefix → forward to Public API
    const publicPath = req.path.replace(/^\/public/, "");
    const queryString = Object.keys(req.query).length
      ? "?" + new URLSearchParams(req.query).toString()
      : "";
    const publicUrl = "https://api.public.com/userapigateway" + publicPath + queryString;

    console.log("[proxy]", req.method, publicUrl);

    const fetchOpts = {
      method:  req.method,
      headers: {
        "Authorization": authHeader,
        "Accept":        "application/json",
        "Content-Type":  "application/json",
      },
    };
    if (req.method !== "GET" && req.body && Object.keys(req.body).length) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(publicUrl, fetchOpts);
    const contentType = upstream.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[proxy error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("Public.com proxy running on port " + PORT);
  console.log("Health: http://localhost:" + PORT + "/health");
});
