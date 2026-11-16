import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const PAYLOAD_VERSION = 'v1';

const createConfigurationError = () => {
  const error = new Error('Безопасное хранение реквизитов Finik пока не настроено. Обратитесь в поддержку.');
  error.status = 503;
  error.code = 'FINIK_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED';
  return error;
};

const getEncryptionKey = () => {
  const encoded = String(config.finik.credentialsEncryptionKey || '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw createConfigurationError();

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw createConfigurationError();
  return key;
};

export const encryptFinikCredential = (plaintext) => {
  const normalized = String(plaintext || '');
  if (!normalized) throw new Error('Finik credential cannot be empty');

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PAYLOAD_VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
};

export const decryptFinikCredential = (payload) => {
  const [version, ivEncoded, tagEncoded, encryptedEncoded, ...extra] = String(payload || '').split('.');
  if (
    version !== PAYLOAD_VERSION
    || !ivEncoded
    || !tagEncoded
    || !encryptedEncoded
    || extra.length
  ) {
    const error = new Error('Stored Finik credential is invalid');
    error.code = 'FINIK_CREDENTIAL_INVALID';
    throw error;
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivEncoded, 'base64'));
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    const error = new Error('Stored Finik credential cannot be decrypted');
    error.code = 'FINIK_CREDENTIAL_DECRYPTION_FAILED';
    throw error;
  }
};

export const assertFinikCredentialEncryptionConfigured = () => {
  getEncryptionKey();
};
