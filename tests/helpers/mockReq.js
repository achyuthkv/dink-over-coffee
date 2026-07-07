/**
 * Creates mock request/response objects for testing Vercel serverless handlers.
 */
export function createMockReq({ method = 'POST', body = {}, headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

export function createMockRes() {
  const res = {
    _status: null,
    _json: null,
    _headers: {},

    status(code) {
      res._status = code;
      return res;
    },

    json(data) {
      res._json = data;
      return res;
    },

    setHeader(key, value) {
      res._headers[key] = value;
      return res;
    },

    getHeader(key) {
      return res._headers[key];
    },
  };

  return res;
}
