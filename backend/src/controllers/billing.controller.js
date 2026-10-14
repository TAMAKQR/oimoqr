import { isFinikConfigured } from '../config/finik.js';
import {
  createBillingPayment,
  getBillingPayment,
  getBillingStatus,
  processFinikWebhook,
  verifyFinikWebhook,
} from '../services/finikBilling.service.js';

export const startPayment = async (req, res, next) => {
  try {
    const { pricingTierId } = req.body;
    if (!pricingTierId || typeof pricingTierId !== 'string') {
      return res.status(400).json({ error: 'pricingTierId is required' });
    }

    const result = await createBillingPayment(req.user.id, pricingTierId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getSubscription = async (req, res, next) => {
  try {
    res.json(await getBillingStatus(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (req, res, next) => {
  try {
    res.json(await getBillingPayment(req.user.id, req.params.paymentId));
  } catch (error) {
    next(error);
  }
};

export const finikWebhook = async (req, res) => {
  if (!isFinikConfigured()) {
    return res.status(503).json({ error: 'Finik webhook is not configured' });
  }

  const verification = verifyFinikWebhook({
    body: req.body,
    headers: req.headers,
    method: req.method,
    path: req.path,
    query: req.query,
  });
  if (!verification.valid) {
    console.warn('Finik webhook signature verification failed:', verification.reason);
    return res.status(400).json({ error: 'Invalid Finik webhook signature' });
  }

  try {
    return res.json(await processFinikWebhook(req.body, {
      signature: req.headers.signature,
      apiTimestamp: req.headers['x-api-timestamp'],
    }));
  } catch (error) {
    console.error('Finik webhook processing failed:', {
      paymentId: req.body?.fields?.paymentId,
      message: error.message,
    });
    const status = Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({ error: 'Webhook processing failed', code: error.code });
  }
};
