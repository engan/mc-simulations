import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname.replace('/binance-proxy', '/api/v3');
  const binanceUrl = `https://api.binance.com${path}${url.search}`;

  const proxyRequest = new Request(binanceUrl, {
    method: request.method,
    headers: request.headers,
    body: !['GET','HEAD'].includes(request.method) ? request.body : undefined,
    redirect: 'manual',
  });

  try {
    const res = await fetch(proxyRequest);
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response('Proxy error', { status: 500 });
  }
};
