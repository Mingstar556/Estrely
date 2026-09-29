const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'estrely-gateway', timestamp: new Date().toISOString() });
});

router.get('/status', (req, res) => {
  const connectedClientsCount = req.app.get('io') ? req.app.get('io').engine.clientsCount : 0;
  
  res.json({
    gateway: 'online',
    python_backend: 'reachable',
    connected_clients: connectedClientsCount
  });
});

module.exports = router;
