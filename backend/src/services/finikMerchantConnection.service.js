import { generateKeyPairSync, randomUUID } from 'crypto';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { getFinikBaseUrl } from '../config/finik.js';
import { signFinikRequest } from '../utils/finikSignature.js';
import {
  assertFinikCredentialEncryptionConfigured,
  decryptFinikCredential,
  encryptFinikCredential,
} from '../utils/finikCredentialEncryption.js';

const PUBLIC_FINIK_SETUP_URL = 'https://www.finik.kg/documentation/web-sdk/';

const createHttpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const normalizeRequiredText = (value, field, maxLength) => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw createHttpError(400, `Некорректное поле ${field}`, 'FINIK_CONNECTION_VALIDATION_FAILED');
  }
  return normalized;
};

const maskAccountId = (value) => {
  const normalized = String(value || '');
  if (!normalized) return null;
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}••••${normalized.slice(-2)}`;
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
};

const getApiKeyLast4 = (encryptedValue) => {
  if (!encryptedValue) return null;
  try {
    return decryptFinikCredential(encryptedValue).slice(-4) || null;
  } catch {
    return null;
  }
};

export const serializeFinikMerchantConnection = (connection, { includePublicKey = false } = {}) => {
  if (!connection) {
    return {
      status: 'NOT_STARTED',
      connected: false,
      mode: config.finik.mode,
      merchantName: null,
      accountIdMasked: null,
      apiKeyLast4: null,
      publicKeyPem: null,
      lastTestedAt: null,
      lastError: null,
    };
  }

  return {
    status: connection.status,
    connected: connection.status === 'ACTIVE',
    mode: connection.mode,
    merchantName: connection.merchantName,
    accountIdMasked: maskAccountId(connection.accountId),
    apiKeyLast4: getApiKeyLast4(connection.apiKeyEncrypted),
    publicKeyPem: includePublicKey ? connection.publicKeyPem : null,
    credentialVersion: connection.credentialVersion,
    lastTestedAt: connection.lastTestedAt,
    lastError: connection.lastError,
    disabledAt: connection.disabledAt,
  };
};

export const startFinikMerchantConnection = async (ownerId) => {
  assertFinikCredentialEncryptionConfigured();
  const existing = await prisma.finikMerchantConnection.findUnique({ where: { ownerId } });
  if (existing?.status === 'ACTIVE') {
    throw createHttpError(
      409,
      'Finik уже подключён. Сначала отключите текущее подключение перед заменой ключей.',
      'FINIK_CONNECTION_ALREADY_ACTIVE'
    );
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const nextVersion = existing ? existing.credentialVersion + 1 : 1;
  const data = {
    status: 'DRAFT',
    mode: config.finik.mode,
    merchantName: null,
    accountId: null,
    apiKeyEncrypted: null,
    privateKeyEncrypted: encryptFinikCredential(privateKey),
    publicKeyPem: publicKey,
    credentialVersion: nextVersion,
    lastTestedAt: null,
    lastError: null,
    disabledAt: null,
  };

  const connection = existing
    ? await prisma.finikMerchantConnection.update({ where: { id: existing.id }, data })
    : await prisma.finikMerchantConnection.create({ data: { ownerId, ...data } });

  return {
    connection: serializeFinikMerchantConnection(connection, { includePublicKey: true }),
    instructionsUrl: PUBLIC_FINIK_SETUP_URL,
  };
};

const parseFinikError = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return `HTTP ${response.status}`;
  try {
    const payload = JSON.parse(text);
    return String(payload.ErrorMessage || payload.error || payload.message || `HTTP ${response.status}`)
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 300);
  } catch {
    return `HTTP ${response.status}`;
  }
};

const verifyCredentialsWithFinik = async ({ apiKey, privateKey, accountId, merchantName, mode }) => {
  if (mode !== config.finik.mode) {
    throw createHttpError(409, 'Среда Finik изменилась. Начните подключение заново.', 'FINIK_MODE_MISMATCH');
  }
  if (!config.finik.webhookUrl) {
    throw createHttpError(
      503,
      'Webhook Finik не настроен на сервере OimoQR. Обратитесь в поддержку.',
      'FINIK_WEBHOOK_NOT_CONFIGURED'
    );
  }

  const baseUrl = getFinikBaseUrl();
  const path = '/v1/payment';
  const timestamp = Date.now().toString();
  const now = Date.now();
  const body = {
    Amount: 1,
    CardType: 'FINIK_QR',
    PaymentId: randomUUID(),
    RedirectUrl: new URL('/dashboard/settings?finik_connection_test=1', `${config.frontendUrl.replace(/\/$/, '')}/`).toString(),
    Lang: 'ru',
    Data: {
      accountId,
      name_en: merchantName,
      webhookUrl: config.finik.webhookUrl,
      description: 'Проверка подключения OimoQR — оплачивать не нужно',
      startDate: now,
      endDate: now + 5 * 60 * 1000,
      additionalData: [{
        fieldId: 'oimoqrConnectionTest',
        name: 'OimoQR connection test',
        isHidden: true,
        value: 'true',
      }],
    },
  };
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
    console.error('Finik connection verification request failed:', error.message);
    throw createHttpError(502, 'Finik временно недоступен. Повторите проверку позже.', 'FINIK_API_ERROR');
  }

  const location = response.headers.get('location');
  if (response.status === 302 && location) return true;
  if (response.ok) {
    const payload = await response.json().catch(() => null);
    if (payload?.paymentUrl || payload?.url || payload?.redirectUrl || location) return true;
  }

  const reason = await parseFinikError(response);
  console.warn('Finik rejected merchant connection verification:', { status: response.status, reason });
  const error = createHttpError(
    response.status === 401 || response.status === 403 ? 400 : 502,
    response.status === 401 || response.status === 403
      ? 'Finik отклонил API-ключ или подпись. Проверьте данные подключения.'
      : 'Finik не подтвердил подключение. Проверьте Account ID и повторите попытку.',
    'FINIK_CONNECTION_VERIFICATION_FAILED'
  );
  error.internalReason = reason;
  throw error;
};

const markConnectionError = async (connectionId, error) => {
  const safeMessage = String(error?.message || 'Не удалось проверить подключение').slice(0, 300);
  return prisma.finikMerchantConnection.update({
    where: { id: connectionId },
    data: { status: 'ERROR', lastError: safeMessage, lastTestedAt: new Date() },
  });
};

export const completeFinikMerchantConnection = async (ownerId, input) => {
  assertFinikCredentialEncryptionConfigured();
  const accountId = normalizeRequiredText(input.accountId, 'Account ID', 200);
  const apiKey = normalizeRequiredText(input.apiKey, 'API key', 500);
  const merchantName = normalizeRequiredText(input.merchantName || 'OimoQR Merchant', 'название мерчанта', 120);
  const existing = await prisma.finikMerchantConnection.findUnique({ where: { ownerId } });
  if (!existing || !existing.privateKeyEncrypted || !existing.publicKeyPem) {
    throw createHttpError(409, 'Сначала начните подключение и получите публичный ключ.', 'FINIK_CONNECTION_NOT_STARTED');
  }
  if (existing.status === 'ACTIVE') {
    throw createHttpError(409, 'Finik уже подключён.', 'FINIK_CONNECTION_ALREADY_ACTIVE');
  }

  let connection;
  try {
    connection = await prisma.finikMerchantConnection.update({
      where: { id: existing.id },
      data: {
        status: 'VERIFYING',
        accountId,
        apiKeyEncrypted: encryptFinikCredential(apiKey),
        merchantName,
        lastError: null,
        disabledAt: null,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw createHttpError(409, 'Этот счёт Finik уже подключён к другому владельцу.', 'FINIK_ACCOUNT_ALREADY_CONNECTED');
    }
    throw error;
  }

  try {
    const privateKey = decryptFinikCredential(connection.privateKeyEncrypted);
    await verifyCredentialsWithFinik({ apiKey, privateKey, accountId, merchantName, mode: connection.mode });
    const active = await prisma.finikMerchantConnection.update({
      where: { id: connection.id },
      data: { status: 'ACTIVE', lastTestedAt: new Date(), lastError: null, disabledAt: null },
    });
    return serializeFinikMerchantConnection(active);
  } catch (error) {
    await markConnectionError(connection.id, error).catch((persistError) => {
      console.error('Unable to persist Finik connection verification error:', persistError.message);
    });
    throw error;
  }
};

export const testFinikMerchantConnection = async (ownerId) => {
  assertFinikCredentialEncryptionConfigured();
  const connection = await prisma.finikMerchantConnection.findUnique({ where: { ownerId } });
  if (!connection?.accountId || !connection.apiKeyEncrypted || !connection.privateKeyEncrypted) {
    throw createHttpError(409, 'Подключение Finik ещё не заполнено.', 'FINIK_CONNECTION_INCOMPLETE');
  }

  try {
    await verifyCredentialsWithFinik({
      apiKey: decryptFinikCredential(connection.apiKeyEncrypted),
      privateKey: decryptFinikCredential(connection.privateKeyEncrypted),
      accountId: connection.accountId,
      merchantName: connection.merchantName || 'OimoQR Merchant',
      mode: connection.mode,
    });
    const active = await prisma.finikMerchantConnection.update({
      where: { id: connection.id },
      data: { status: 'ACTIVE', lastTestedAt: new Date(), lastError: null, disabledAt: null },
    });
    return serializeFinikMerchantConnection(active);
  } catch (error) {
    await markConnectionError(connection.id, error).catch(() => {});
    throw error;
  }
};

export const disconnectFinikMerchantConnection = async (ownerId) => prisma.$transaction(async (tx) => {
  const existing = await tx.finikMerchantConnection.findUnique({ where: { ownerId } });
  if (!existing) return null;
  await tx.restaurant.updateMany({ where: { ownerId }, data: { finikEnabled: false } });
  return tx.finikMerchantConnection.update({
    where: { id: existing.id },
    data: { status: 'DISABLED', disabledAt: new Date(), lastError: null },
  });
});

export const getFinikMerchantCredentialsById = async (connectionId) => {
  const connection = await prisma.finikMerchantConnection.findUnique({ where: { id: connectionId } });
  if (!connection?.apiKeyEncrypted || !connection.privateKeyEncrypted || !connection.accountId) return null;
  return {
    connectionId: connection.id,
    ownerId: connection.ownerId,
    status: connection.status,
    mode: connection.mode,
    merchantName: connection.merchantName || 'OimoQR Merchant',
    accountId: connection.accountId,
    apiKey: decryptFinikCredential(connection.apiKeyEncrypted),
    privateKey: decryptFinikCredential(connection.privateKeyEncrypted),
    credentialVersion: connection.credentialVersion,
  };
};

export const getActiveFinikMerchantCredentialsForRestaurant = async (restaurantId) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      owner: { select: { finikMerchantConnection: true } },
    },
  });
  const connection = restaurant?.owner?.finikMerchantConnection;
  if (!connection || connection.status !== 'ACTIVE' || connection.mode !== config.finik.mode) return null;
  return getFinikMerchantCredentialsById(connection.id);
};

export const FINIK_CONNECTION_INSTRUCTIONS_URL = PUBLIC_FINIK_SETUP_URL;
