import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  buildFinikCanonicalRequest,
  signFinikRequest,
  verifyFinikSignature,
} from './finikSignature.js';

const requestData = {
  httpMethod: 'POST',
  path: '/v1/payment',
  headers: {
    Host: 'beta.api.acquiring.averspay.kg',
    'x-api-timestamp': '1700000000000',
    'x-api-key': 'test-key',
    'content-type': 'application/json',
  },
  queryStringParameters: null,
  body: {
    PaymentId: '00000000-0000-4000-8000-000000000000',
    Amount: 1500,
    Data: { accountId: 'test-account', webhookUrl: 'https://example.com/webhook' },
    CardType: 'FINIK_QR',
  },
};

test('canonicalizes requests exactly like the documented Finik authorizer', () => {
  assert.equal(buildFinikCanonicalRequest(requestData), [
    'post',
    '/v1/payment',
    'host:beta.api.acquiring.averspay.kg&x-api-key:test-key&x-api-timestamp:1700000000000',
    '{"Amount":1500,"CardType":"FINIK_QR","Data":{"accountId":"test-account","webhookUrl":"https://example.com/webhook"},"PaymentId":"00000000-0000-4000-8000-000000000000"}',
  ].join('\n'));
});

test('signs and verifies RSA-SHA256 requests and rejects tampering', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const signature = signFinikRequest(requestData, privateKey);
  assert.equal(verifyFinikSignature(requestData, publicKey, signature), true);
  assert.equal(verifyFinikSignature({
    ...requestData,
    body: { ...requestData.body, Amount: 1501 },
  }, publicKey, signature), false);
});
