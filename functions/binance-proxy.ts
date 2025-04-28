import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // Fjern kun /binance-proxy prefixet
  const binanceApiPath = url.pathname.replace('/binance-proxy', '/api/v3');
  const binanceUrl = `https://api.binance.com${binanceApiPath}${url.search}`;

  console.log(`Proxying request to: ${binanceUrl}`); // Behold gjerne denne loggen

  const proxyRequest = new Request(binanceUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual',
  });

  try {
    const response = await fetch(proxyRequest);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: newHeaders });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error('Error in proxy worker:', error);
    return new Response('Proxy error', { status: 500 });
  }
};