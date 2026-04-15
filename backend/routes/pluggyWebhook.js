const express = require('express');
const router = express.Router();

async function handleItemCreated(itemId) {
  console.log('[Pluggy webhook] item/created:', itemId);
}

async function handleItemUpdated(itemId) {
  console.log('[Pluggy webhook] item/updated:', itemId);
}

async function handleItemError(itemId, error) {
  console.error('[Pluggy webhook] item/error:', itemId, error || {});
}

// POST /webhooks/pluggy
// Responde 2XX rapidamente e processa o evento de forma assíncrona.
router.post('/', async (req, res) => {
  const event = req.body || {};

  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      console.log('[Pluggy webhook] received:', event.event, '| eventId:', event.eventId);
      switch (event.event) {
        case 'item/created':
          await handleItemCreated(event.itemId);
          break;
        case 'item/updated':
          await handleItemUpdated(event.itemId);
          break;
        case 'item/error':
          await handleItemError(event.itemId, event.error);
          break;
        default:
          console.log('[Pluggy webhook] event ignored:', event.event);
      }
    } catch (err) {
      console.error('[Pluggy webhook] processing error:', err.message);
    }
  });
});

module.exports = router;
