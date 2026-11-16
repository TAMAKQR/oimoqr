import { config } from '../config/env.js';
import { getFinikBaseUrl, getFinikPrivateKey } from '../config/finik.js';
import { signFinikRequest } from '../utils/finikSignature.js';

const createHttpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const validatePaymentUrl = (value, { baseUrl, mode }) => {
  let url;
  try {
    url = new URL(value, `${baseUrl}/`);
  } catch {
    throw createHttpError(502, 'Finik вернул некорректную ссылку на оплату', 'FINIK_INVALID_PAYMENT_URL');
  }
  const allowedHosts = mode === 'beta'
    ? new Set(['beta.qr.finik.kg'])
    : new Set(['qr.finik.kg']);
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw createHttpError(502, 'Finik вернул небезопасную ссылку на оплату', 'FINIK_INVALID_PAYMENT_URL');
  }
  return url.toString();
};

const parseUpstreamError = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return `HTTP ${response.status}`;
  try {
    const payload = JSON.parse(text);
    return String(payload.ErrorMessage || payload.error || payload.message || `HTTP ${response.status}`);
  } catch {
    return `HTTP ${response.status}`;
  }
};

export const requestFinikPaymentUrl = async (body, credentialOverride = null) => {
  const hasCredentialOverride = credentialOverride !== null;
  const mode = hasCredentialOverride ? credentialOverride.mode : config.finik.mode;
  const apiKey = hasCredentialOverride ? credentialOverride.apiKey : config.finik.apiKey;
  const privateKey = hasCredentialOverride ? credentialOverride.privateKey : getFinikPrivateKey();
  const baseUrl = getFinikBaseUrl(mode);
  if (!baseUrl || !apiKey || !privateKey) {
    throw createHttpError(503, 'Реквизиты Finik не настроены.', 'FINIK_NOT_CONFIGURED');
  }
  const path = '/v1/payment';
  const timestamp = Date.now().toString();
  const requestData = {
    httpMethod: 'POST',
    path,
    headers: {
      Host: new URL(baseUrl).host,
      'x-api-key': apiKey,
      'x-api-timestamp': timestamp,
    },
    queryStringParameters: null,
    body,
  };
  const signature = signFinikRequest(requestData, privateKey);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'x-api-timestamp': timestamp,
        signature,
      },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(config.finik.requestTimeoutMs),
    });
  } catch (error) {
    console.error('Finik create-payment request failed:', error.message);
    throw createHttpError(502, 'Finik временно недоступен. Повторите попытку позже.', 'FINIK_API_ERROR');
  }

  const location = response.headers.get('location');
  if (response.status === 302 && location) {
    return validatePaymentUrl(location, { baseUrl, mode });
  }

  if (response.ok) {
    const payload = await response.json().catch(() => null);
    const paymentUrl = payload?.paymentUrl || payload?.url || payload?.redirectUrl || location;
    if (paymentUrl) return validatePaymentUrl(paymentUrl, { baseUrl, mode });
  }

  const upstreamMessage = await parseUpstreamError(response);
  console.error('Finik create-payment rejected:', { status: response.status, message: upstreamMessage });
  throw createHttpError(502, 'Finik не смог создать платёж. Повторите попытку позже.', 'FINIK_PAYMENT_CREATE_FAILED');
};
