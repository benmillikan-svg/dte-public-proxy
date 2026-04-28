const express = require("express");
const fetch   = require("node-fetch");
const app     = express();
const PORT    = process.env.PORT || 3001;

app.use(express.json());

// ── Explicit CORS — handle preflight for every route ─────────────────────────
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", function(req, res) {
  res.json({ status: "ok", service: "dte-public-proxy", timestamp: new Date().toISOString() });
});

// ── Public.com proxy ──────────────────────────────────────────────────────────
app.all("/public/*", async function(req, res) {
  try {
    var authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

    var publicPath  = req.path.replace(/^\/public/, "");
    var queryString = Object.keys(req.query).length
      ? "?" + new URLSearchParams(req.query).toString()
      : "";
    var publicUrl = "https://api.public.com/userapigateway" + publicPath + queryString;

    console.log("[proxy]", req.method, publicUrl);

    var fetchOpts = {
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

    var upstream = await fetch(publicUrl, fetchOpts);
    var contentType = upstream.headers.get("content-type") || "";
    var data = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[proxy error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log("Public.com proxy running on port " + PORT);
  console.log("Health: http://localhost:" + PORT + "/health");
});
