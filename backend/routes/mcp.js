const express = require("express");
const {
  callConnector,
  connectorStatus,
  listConnectors,
  registerCustomConnector,
  deleteCustomConnector,
} = require("../services/mcp");

const router = express.Router();

router.get("/connectors", (req, res) => {
  res.json({ success: true, connectors: listConnectors() });
});

router.get("/connectors/:id", (req, res) => {
  const status = connectorStatus(req.params.id);
  if (!status) return res.status(404).json({ error: "Connector not found" });
  res.json({ success: true, connector: status });
});

router.post("/connectors", (req, res) => {
  try {
    const { id, name, description, actions, endpoint, headers } = req.body || {};
    const created = registerCustomConnector({ id, name, description, actions, endpoint, headers });
    res.status(201).json({ success: true, connector: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/connectors/:id", (req, res) => {
  const result = deleteCustomConnector(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post("/call", async (req, res) => {
  const { connectorId, action, params } = req.body || {};
  if (!connectorId || !action) {
    return res.status(400).json({
      error: "connectorId and action are required",
    });
  }

  const result = await callConnector({ connectorId, action, params });
  res.status(result.success ? 200 : 409).json(result);
});

module.exports = router;

