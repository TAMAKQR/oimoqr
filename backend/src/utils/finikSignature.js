import { createSign, createVerify } from 'crypto';

const encodeCanonicalPart = (value) => encodeURI(decodeURI(String(value)));

const canonicalizeHeaders = (headers = {}) => {
  const host = headers.Host;
  if (!host) {
    throw new Error("Header 'Host' is required for Finik signature");
  }

  const apiHeaders = Object.keys(headers)
    .filter((key) => key.toLowerCase().startsWith('x-api-'))
    .sort()
    .map((key) => {
      const value = headers[key];
      if (value === undefined || value === null) {
        throw new Error(`Header '${key}' has no value`);
      }
      return `${key.toLowerCase()}:${String(value)}`;
    });

  return [`host:${String(host)}`, ...apiHeaders].join('&');
};

const canonicalizeQuery = (query = {}) => Object.keys(query || {})
  .sort()
  .map((key) => {
    const value = query[key] ?? '';
    if (Array.isArray(value) || typeof value === 'object') {
      throw new Error(`Unsupported Finik query parameter: ${key}`);
    }
    return `${encodeCanonicalPart(key)}=${encodeCanonicalPart(value)}`;
  })
  .join('&');

const canonicalizeBody = (body) => {
  if (!body) return '';
  const sortedBody = Object.entries(body)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce((result, [key, value]) => {
      result[key] = value;
      return result;
    }, {});
  return JSON.stringify(sortedBody);
};

export const buildFinikCanonicalRequest = ({
  httpMethod,
  path,
  headers,
  queryStringParameters,
  body,
}) => {
  if (!httpMethod) throw new Error('HTTP method is required for Finik signature');

  const parts = [
    String(httpMethod).toLowerCase(),
    decodeURI(path || ''),
    canonicalizeHeaders(headers),
  ];
  const query = canonicalizeQuery(queryStringParameters);
  if (query) parts.push(query);
  parts.push(canonicalizeBody(body));
  return parts.join('\n');
};

export const signFinikRequest = (requestData, privateKey) => {
  const signer = createSign('SHA256');
  signer.update(buildFinikCanonicalRequest(requestData));
  signer.end();
  return signer.sign(privateKey, 'base64');
};

export const verifyFinikSignature = (requestData, publicKey, signature) => {
  if (!signature || typeof signature !== 'string') return false;
  try {
    const verifier = createVerify('SHA256');
    verifier.update(buildFinikCanonicalRequest(requestData));
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
};
