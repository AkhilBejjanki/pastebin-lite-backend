const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on("error", (err) => console.error("Redis Error", err));

redis.connect().catch(err => console.error("Failed to connect to Redis:", err));

module.exports = redis;
