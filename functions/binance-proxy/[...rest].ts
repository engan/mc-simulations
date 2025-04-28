// functions/binance-proxy.ts (Revidert for Pages Functions)
import type { PagesFunction } from '@cloudflare/workers-types'; // Importer typer

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/binance-proxy/, '/api/v3');
  const binanceUrl = `https://api.binance.com${path}${url.search}`;

  const res = await fetch(binanceUrl, {
    method: request.method,
    headers: request.headers,
    body: ['GET','HEAD'].includes(request.method) ? undefined : request.body  
  });

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
    headers
  });
}
