const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pastesRouter = require("./routes/pastes");
const redis = require("./redis");

const app = express();
app.use(express.json());
app.use(cors());

// health route
app.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false });
  }
});

app.use("/api/pastes", pastesRouter);

// HTML route
app.get("/p/:id", async (req, res) => {
  const id = req.params.id;
  const paste = await redis.get(`paste:${id}`);

  if (!paste) return res.status(404).send("Paste not found");
  
  const data = JSON.parse(paste);

  // expiry check
  const now = getCurrentTime(req);
  if (data.ttl_seconds && now >= data.created_at + data.ttl_seconds * 1000)
    return res.status(404).send("Expired");

  if (data.max_views && data.views >= data.max_views)
    return res.status(404).send("Not available");

  res.set("Content-Type", "text/html");
  res.send(`
    <html>
      <body>
        <pre>${escapeHtml(data.content)}</pre>
      </body>
    </html>
  `);
});

function escapeHtml(text) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getCurrentTime(req) {
  if (process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"])
    return Number(req.headers["x-test-now-ms"]);
  return Date.now();
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
