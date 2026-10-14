import { createPrivateKey, createPublicKey } from 'crypto';
import { config } from './env.js';

const FINIK_ENDPOINTS = {
  beta: 'https://beta.api.acquiring.averspay.kg',
  prod: 'https://api.acquiring.averspay.kg',
};

// Published by Finik for webhook verification:
// https://www.finik.kg/documentation/web-sdk/reference/
const FINIK_PUBLIC_KEYS = {
  prod: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF/PUmhMPPidcMxhZBPb
BSGJoSphmCI+h6ru8fG8guAlcPMVlhs+ThTjw2LHABvciwtpj51ebJ4EqhlySPyT
hqSfXI6Jp5dPGJNDguxfocohaz98wvT+WAF86DEglZ8dEsfoumojFUy5sTOBdHEu
g94B4BbrJvjmBa1YIx9Azse4HFlWhzZoYPgyQpArhokeHOHIN2QFzJqeriANO+wV
aUMta2AhRVZHbfyJ36XPhGO6A5FYQWgjzkI65cxZs5LaNFmRx6pjnhjIeVKKgF99
4OoYCzhuR9QmWkPl7tL4Kd68qa/xHLz0Psnuhm0CStWOYUu3J7ZpzRK8GoEXRcr8
tQIDAQAB
-----END PUBLIC KEY-----`,
  beta: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwlrlKz/8gLWd1ARWGA/8
o3a3Qy8G+hPifyqiPosiTY6nCHovANMIJXk6DH4qAqqZeLu8pLGxudkPbv8dSyG7
F9PZEAryMPzjoB/9P/F6g0W46K/FHDtwTM3YIVvstbEbL19m8yddv/xCT9JPPJTb
LsSTVZq5zCqvKzpupwlGS3Q3oPyLAYe+ZUn4Bx2J1WQrBu3b08fNaR3E8pAkCK27
JqFnP0eFfa817VCtyVKcFHb5ij/D0eUP519Qr/pgn+gsoG63W4pPHN/pKwQUUiAy
uLSHqL5S2yu1dffyMcMVi9E/Q2HCTcez5OvOllgOtkNYHSv9pnrMRuws3u87+hNT
ZwIDAQAB
-----END PUBLIC KEY-----`,
};

const normalizePem = (value) => (
  typeof value === 'string' ? value.trim().replace(/\\n/g, '\n') : ''
);

const isValidHttpsUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const getFinikBaseUrl = () => FINIK_ENDPOINTS[config.finik.mode];

export const getFinikPrivateKey = () => normalizePem(config.finik.privateKey);

export const getFinikPublicKey = () => (
  normalizePem(config.finik.publicKey) || FINIK_PUBLIC_KEYS[config.finik.mode]
);

export const isFinikConfigured = () => Boolean(
  config.finik.apiKey
  && config.finik.accountId
  && getFinikPrivateKey().includes('BEGIN')
  && isValidHttpsUrl(config.finik.webhookUrl)
);

export const getFinikWebhookHost = () => {
  if (!isValidHttpsUrl(config.finik.webhookUrl)) return null;
  return new URL(config.finik.webhookUrl).host;
};

export const assertFinikConfigured = () => {
  if (isFinikConfigured()) return;

  const error = new Error(
    'Онлайн-оплата Finik пока не настроена. Проверьте API-ключ, RSA-ключ, счёт и webhook URL.'
  );
  error.status = 503;
  error.code = 'FINIK_NOT_CONFIGURED';
  throw error;
};

export const validateFinikConfiguration = () => {
  if (config.finik.webhookUrl && !isValidHttpsUrl(config.finik.webhookUrl)) {
    throw new Error('❌ FINIK_WEBHOOK_URL must be an absolute HTTPS URL');
  }
  if (config.finik.webhookUrl) {
    const webhookUrl = new URL(config.finik.webhookUrl);
    if (
      webhookUrl.pathname !== '/api/billing/finik/webhook'
      || webhookUrl.search
      || webhookUrl.hash
    ) {
      throw new Error('❌ FINIK_WEBHOOK_URL must use the exact /api/billing/finik/webhook path without query or hash');
    }
  }
  if (config.nodeEnv === 'production') {
    let frontendUrl;
    try {
      frontendUrl = new URL(config.frontendUrl);
    } catch {
      throw new Error('❌ FRONTEND_URL must be an absolute URL');
    }
    if (frontendUrl.protocol !== 'https:') {
      throw new Error('❌ FRONTEND_URL must use HTTPS in production');
    }
  }

  const privateKey = getFinikPrivateKey();
  if (config.finik.privateKey && !privateKey.includes('PRIVATE KEY')) {
    throw new Error('❌ FINIK_PRIVATE_KEY must contain a PEM private key');
  }
  if (privateKey) {
    try {
      createPrivateKey(privateKey);
    } catch {
      throw new Error('❌ FINIK_PRIVATE_KEY is not a valid PEM private key');
    }
  }

  const publicKey = getFinikPublicKey();
  if (!publicKey.includes('BEGIN PUBLIC KEY')) {
    throw new Error('❌ FINIK_PUBLIC_KEY must contain a PEM public key');
  }
  try {
    createPublicKey(publicKey);
  } catch {
    throw new Error('❌ FINIK_PUBLIC_KEY is not a valid PEM public key');
  }
};

validateFinikConfiguration();
