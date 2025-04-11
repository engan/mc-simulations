export default {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      // Bytt ut '/api/binanceproxy' med den faktiske stien du vil bruke
      const binanceApiPath = url.pathname.replace('/api/binanceproxy', '/api/v3');
      const binanceUrl = `https://api.binance.com${binanceApiPath}${url.search}`;
  
      console.log(`Proxying request to: ${binanceUrl}`);
  
      // Lag en ny forespørsel til Binance API
      const proxyRequest = new Request(binanceUrl, {
        method: request.method,
        headers: request.headers, // Send med headers (kan filtreres om nødvendig)
        // Body trengs vanligvis ikke for klines-GET, men inkluderes for generell proxy
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      });
  
      try {
        const response = await fetch(proxyRequest);
        // Lag en ny respons for å kunne legge til CORS-headere
        const newHeaders = new Headers(response.headers);
        // Tillat forespørsler fra ditt Pages-domene (eller * for enkel demo)
        newHeaders.set('Access-Control-Allow-Origin', '*'); // Bør begrenses i prod
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Eksempel
  
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
  
      } catch (error) {
        console.error('Error in proxy worker:', error);
        return new Response('Proxy error', { status: 500 });
      }
    },
  };