const crypto = require("crypto");

function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers["x-request-id"];
  const requestId = typeof incomingId === "string" && incomingId.length > 0 && incomingId.length <= 64
    ? incomingId
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

module.exports = { requestIdMiddleware };
