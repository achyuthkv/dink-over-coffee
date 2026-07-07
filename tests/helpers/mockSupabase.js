/**
 * Creates a mock Supabase client that simulates the fluent query builder API.
 * Use `mockSupabase.__setResponse(table, response)` to control what data is returned.
 *
 * Supports: .from(table).select/insert/update/delete().eq().single()/maybeSingle()
 * Also supports: .auth.getUser() and .rpc()
 */
export function createMockSupabase() {
  const responses = new Map();
  let callLog = [];
  let authResponse = { data: { user: null }, error: { message: 'Not authenticated' } };
  let rpcResponse = { data: null, error: { message: 'function does not exist' } };

  function makeChain(table) {
    const chain = {
      _table: table,
      _method: null,
      _filters: [],

      select(...args) {
        chain._method = chain._method || 'select';
        chain._selectArgs = args;
        return chain;
      },
      insert(data) {
        chain._method = 'insert';
        chain._insertData = data;
        return chain;
      },
      update(data) {
        chain._method = 'update';
        chain._updateData = data;
        return chain;
      },
      delete() {
        chain._method = 'delete';
        return chain;
      },
      eq(col, val) {
        chain._filters.push({ type: 'eq', col, val });
        return chain;
      },
      neq(col, val) {
        chain._filters.push({ type: 'neq', col, val });
        return chain;
      },
      gt(col, val) {
        chain._filters.push({ type: 'gt', col, val });
        return chain;
      },
      gte(col, val) {
        chain._filters.push({ type: 'gte', col, val });
        return chain;
      },
      lt(col, val) {
        chain._filters.push({ type: 'lt', col, val });
        return chain;
      },
      in(col, vals) {
        chain._filters.push({ type: 'in', col, vals });
        return chain;
      },
      order(col, opts) {
        chain._filters.push({ type: 'order', col, opts });
        return chain;
      },
      single() {
        callLog.push({ table, method: chain._method, filters: chain._filters, terminal: 'single' });
        const resp = getResponse(table);
        return Promise.resolve(resp);
      },
      maybeSingle() {
        callLog.push({ table, method: chain._method, filters: chain._filters, terminal: 'maybeSingle' });
        const resp = getResponse(table);
        return Promise.resolve(resp);
      },
      then(resolve, reject) {
        callLog.push({ table, method: chain._method, filters: chain._filters, terminal: 'then' });
        const resp = getResponse(table);
        return Promise.resolve(resp).then(resolve, reject);
      },
    };
    return chain;
  }

  function getResponse(table) {
    if (responses.has(table)) {
      const queue = responses.get(table);
      if (Array.isArray(queue) && queue.length > 0) {
        return queue.shift();
      }
      if (!Array.isArray(queue)) {
        return queue;
      }
    }
    return { data: null, error: null };
  }

  const mockClient = {
    from(table) {
      return makeChain(table);
    },

    auth: {
      getUser(token) {
        callLog.push({ method: 'auth.getUser', token });
        return Promise.resolve(authResponse);
      },
    },

    rpc(fnName, params) {
      callLog.push({ method: 'rpc', fnName, params });
      return Promise.resolve(rpcResponse);
    },

    /** Set a single response for a table (will be returned on every query) */
    __setResponse(table, response) {
      responses.set(table, response);
    },

    /** Queue multiple responses for a table (consumed in order) */
    __queueResponses(table, responseArray) {
      responses.set(table, [...responseArray]);
    },

    /** Set the auth.getUser response */
    __setAuthResponse(response) {
      authResponse = response;
    },

    /** Set the rpc response */
    __setRpcResponse(response) {
      rpcResponse = response;
    },

    __getCallLog() {
      return callLog;
    },

    __reset() {
      responses.clear();
      callLog = [];
      authResponse = { data: { user: null }, error: { message: 'Not authenticated' } };
      rpcResponse = { data: null, error: { message: 'function does not exist' } };
    }
  };

  return mockClient;
}
