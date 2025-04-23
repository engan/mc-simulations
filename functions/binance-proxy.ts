// functions/binance-proxy.ts (Revidert for Pages Functions)
import type { PagesFunction, EventContext } from '@cloudflare/workers-types' // Importer typer

// Definer funksjonen med PagesFunction signaturen
export const onRequest: PagesFunction = async (context) => {
  console.log("ULTRA MINIMAL TEXT PROXY FUNCTION INVOKED");

  const headers = new Headers({
    'Access-Control-Allow-Origin': '*' // Kun CORS
  });
  // Returner bare en enkel tekststreng
  return new Response('Proxy Reached!', { headers: headers, status: 200 });

  /*
  const { request } = context // Hent request fra context
  const url = new URL(request.url)

  // Anta at denne funksjonen er mappet til ruten /binance-proxy/*
  // Fjern prefixet for å få tak i resten av stien til Binance
  const binanceApiPath = url.pathname.replace('/binance-proxy', '/api/v3')
  const binanceUrl = `https://api.binance.com${binanceApiPath}${url.search}`

  console.log(`Pages Function Proxying request to: ${binanceUrl}`)

  const proxyRequest = new Request(binanceUrl, {
    method: request.method,
    headers: request.headers,
    body:
      request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
    redirect: 'manual', // Viktig for å håndtere redirects korrekt
  })

  try {
    const response = await fetch(proxyRequest) // fetch returnerer Response (global eller workers-type)
    const newHeaders = new Headers(response.headers)
    // Sett CORS-headere (bruk spesifikt domene i prod)
    const origin = request.headers.get('Origin')
    // For utvikling/testing kan '*' brukes, men i prod bør du sette
    // ditt pages.dev domene eller et egendefinert domene.
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS') // OPTIONS trengs for preflight
    newHeaders.set('Access-Control-Allow-Headers', '*') // Tillat alle headers i requesten

    // Håndter OPTIONS preflight request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: newHeaders })
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  } catch (error) {
    console.error('Error in Pages Function proxy:', error)
    return new Response('Proxy error', { status: 500 })
  }
  */
}
