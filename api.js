// Reusable fetch wrapper: apiRequest
// - Default baseUrl: https://vmthdbkpnejquzwinjnd.supabase.co/rest/v1/
// - Supports: query params, JSON body, FormData, timeout, retries, Authorization
const DEFAULT_BASE_URL = 'https://vmthdbkpnejquzwinjnd.supabase.co/rest/v1/';

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    baseUrl = DEFAULT_BASE_URL,
    headers = {},
    params,
    body,
    timeoutMs = 10000,
    retries = 0,
    authToken,
    parseJson = true,
    signal: userSignal,
  } = options;

  const url = new URL(path, baseUrl);
  if (params && typeof params === 'object') {
    Object.keys(params).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const signal = userSignal || controller.signal;

  const finalHeaders = Object.assign({}, headers);
  if (authToken) finalHeaders['Authorization'] = `Bearer ${authToken}`;

  const fetchOpts = { method, headers: finalHeaders, signal };

  if (body != null) {
    if (body instanceof FormData) {
      fetchOpts.body = body;
    } else if (typeof body === 'string') {
      fetchOpts.body = body;
      fetchOpts.headers['Content-Type'] = fetchOpts.headers['Content-Type'] || 'text/plain;charset=utf-8';
    } else {
      fetchOpts.body = JSON.stringify(body);
      fetchOpts.headers['Content-Type'] = fetchOpts.headers['Content-Type'] || 'application/json;charset=utf-8';
    }
  }

  try {
    let response;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        response = await fetch(url.toString(), fetchOpts);
        break;
      } catch (err) {
        lastError = err;
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      }
    }
    clearTimeout(timeout);

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const data = parseJson && contentType.includes('application/json') && text ? JSON.parse(text) : text;

    if (!response.ok) {
      const err = new Error('API request failed');
      err.status = response.status;
      err.statusText = response.statusText;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Request timed out');
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  }
}

// Attach to window for quick use in non-module pages
if (typeof window !== 'undefined') window.apiRequest = apiRequest;

export async function get(url, options = {}) {
  return apiRequest(url, { ...options, method: 'GET' });
}

if (typeof window !== 'undefined') window.apiGet = get;

export default apiRequest;
