// functions/binance-proxy/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async ({ request }) => { // Hent request direkte
  const url = new URL(request.url);
  // path vil nå inneholde /binance-proxy/klines
  // Vi fjerner /binance-proxy og erstatter med /api/v3
  const path = url.pathname.replace('/binance-proxy', '/api/v3');
  const binanceUrl = `https://api.binance.com${path}${url.search}`;

  console.log(`Proxying request (via index.ts) to: ${binanceUrl}`); // Ny loggmelding

  // Lag en ny forespørsel til Binance API (litt mer robust sjekk for body)
   const shouldHaveBody = !(request.method === 'GET' || request.method === 'HEAD');
   const proxyRequest = new Request(binanceUrl, {
     method: request.method,
     headers: request.headers,
     body: shouldHaveBody ? request.body : undefined,
     redirect: 'manual',
   });

  try {
    const response = await fetch(proxyRequest);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS'); // Sørg for OPTIONS
    newHeaders.set('Access-Control-Allow-Headers', '*'); // Kan begrenses mer i prod

    // Håndter OPTIONS preflight (viktig for CORS med visse headere/metoder)
     if (request.method === 'OPTIONS') {
       return new Response(null, { headers: newHeaders });
     }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error('Error in proxy worker (index.ts):', error);
    return new Response('Proxy error', { status: 500 });
  }
};