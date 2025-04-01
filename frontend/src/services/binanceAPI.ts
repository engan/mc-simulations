// Definerer strukturen for et behandlet candlestick-objekt
export interface Kline {
    timestamp: number; // Starttidspunkt for intervallet (millisekunder)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }
  
  // Definerer (delvis) strukturen på rådata fra Binance API
  // [Open time, Open, High, Low, Close, Volume, Close time, Quote asset volume, Number of trades, Taker buy base asset volume, Taker buy quote asset volume, Ignore]
  type BinanceRawKline = [
    number, // Open time
    string, // Open
    string, // High
    string, // Low
    string, // Close
    string, // Volume
    number, // Close time
    string, // Quote asset volume
    number, // Number of trades
    string, // Taker buy base asset volume
    string, // Taker buy quote asset volume
    string  // Ignore.
  ];
  
  // Base-URL for Binance Spot API v3
  const BINANCE_API_BASE_URL = 'https://api.binance.com/api/v3';
  
  /**
   * Henter historiske Klines (candlesticks) fra Binance API.
   *
   * @param symbol Handelsparet (f.eks. 'SOLUSDT').
   * @param interval Tidsrammen (f.eks. '1m', '5m', '1h', '1d').
   * @param limit Maks antall klines å hente (maks 1000, default 500).
   * @param startTime Starttidspunkt (Unix millisekunder, valgfritt).
   * @param endTime Sluttidspunkt (Unix millisekunder, valgfritt).
   * @returns Et Promise som resolver til en array av Kline-objekter.
   * @throws Kaster en Error hvis API-kallet feiler eller data ikke kan parses.
   */
  export async function fetchBinanceKlines(
    symbol: string,
    interval: string,
    limit: number = 500, // Hent færre som standard for å unngå for store requests i starten
    startTime?: number,
    endTime?: number
  ): Promise<Kline[]> {
  
    // Bygg URL med query parametere
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(), // Sørg for store bokstaver
      interval: interval,
      limit: limit.toString(),
    });
  
    if (startTime) {
      params.append('startTime', startTime.toString());
    }
    if (endTime) {
      params.append('endTime', endTime.toString());
    }
  
    const url = `${BINANCE_API_BASE_URL}/klines?${params.toString()}`;
    console.log(`Fetching data from: ${url}`); // Nyttig for debugging
  
    try {
      const response = await fetch(url);
  
      if (!response.ok) {
        // Prøv å lese feilmelding fra Binance hvis mulig
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (e) { /* Ignorer parse-feil for feilmeldingen */ }
        throw new Error(`Binance API error: ${response.status} ${response.statusText}. ${errorBody ? `Message: ${errorBody.msg} (Code: ${errorBody.code})` : ''}`);
      }
  
      const rawData: BinanceRawKline[] = await response.json();
  
      // Map rådata til ønsket Kline-struktur
      const klines: Kline[] = rawData.map((k: BinanceRawKline) => ({
        timestamp: k[0], // Open time
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        // k[6] er Close time, vi bruker Open time (k[0]) som hoved-timestamp
      }));
  
      return klines;
  
    } catch (error) {
      console.error("Failed to fetch Binance klines:", error);
      // Re-throw feilen slik at komponenten som kaller kan håndtere den
      throw error;
    }
  }
  
  // --- Viktige Merknader ---
  // 1. Rate Limits: Binance har strenge rate limits. Ved henting av store mengder
  //    data (f.eks. all historikk) må du lage logikk for å hente i chunks (maks 1000
  //    om gangen) med pauser mellom kallene. Start gjerne med å hente de siste
  //    1000 punktene ved å kun spesifisere 'limit=1000'.
  // 2. Feilhåndtering: Forbedre gjerne feilhåndteringen ytterligere.
  // 3. CORS: Direkte kall fra frontend *kan* i noen tilfeller gi CORS-feil,
  //    spesielt i produksjon. Under lokal utvikling med Vite (`localhost`) fungerer
  //    det ofte greit. Hvis du får CORS-feil, må du vurdere en enkel backend-proxy.
  // 4. Full Historikk: For å hente *all* historikk må du iterativt kalle API-et
  //    bakover i tid. Start med å hente de siste 1000, bruk `startTime` fra den
  //    *tidligste* mottatte kline som `endTime` for neste kall, og fortsett til
  //    du har hentet nok data eller API-et ikke returnerer mer.