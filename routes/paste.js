const express = require("express");
const { v4: uuid } = require("uuid");
const router = express.Router();
const redis = require("../redis");

function getCurrentTime(req) {
  if (process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"])
    return Number(req.headers["x-test-now-ms"]);
  return Date.now();
}

// CREATE PASTE
router.post("/", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || !content.trim())
    return res.status(400).json({ error: "content required" });

  if (ttl_seconds && ttl_seconds < 1)
    return res.status(400).json({ error: "ttl_seconds invalid" });

  if (max_views && max_views < 1)
    return res.status(400).json({ error: "max_views invalid" });

  const id = uuid();
  const now = Date.now();

  const data = {
    id,
    content,
    created_at: now,
    ttl_seconds: ttl_seconds || null,
    max_views: max_views || null,
    views: 0
  };

  await redis.set(`paste:${id}`, JSON.stringify(data));

  return res.json({
    id,
    url: `${process.env.BASE_URL}/p/${id}`
  });
});


// GET PASTE API
router.get("/:id", async (req, res) => {
  const paste = await redis.get(`paste:${req.params.id}`);
  if (!paste) return res.status(404).json({ error: "Not found" });

  const data = JSON.parse(paste);
  const now = getCurrentTime(req);

  // TTL
  if (data.ttl_seconds && now >= data.created_at + data.ttl_seconds * 1000)
    return res.status(404).json({ error: "Expired" });

  // Views
  if (data.max_views && data.views >= data.max_views)
    return res.status(404).json({ error: "View limit exceeded" });

  data.views++;
  await redis.set(`paste:${data.id}`, JSON.stringify(data));

  res.json({
    content: data.content,
    remaining_views: data.max_views ? data.max_views - data.views : null,
    expires_at: data.ttl_seconds
      ? new Date(data.created_at + data.ttl_seconds * 1000)
      : null
  });
});

module.exports = router;
