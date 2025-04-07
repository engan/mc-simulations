import { ref, readonly } from 'vue';
import { fetchBinanceKlines, type Kline } from '../services/binanceAPI';

export function useKlines() {
  const klines = ref<Kline[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Funksjon for å laste data
  async function loadKlines(
    symbol: string,
    interval: string,
    totalLimit: number = 1000 // Betyr nå totalt antall ønsket
  ) {
    isLoading.value = true;
    error.value = null;
    klines.value = [];

    try {
      // Kaller den oppdaterte fetchBinanceKlines med totalLimit
      const fetchedKlines = await fetchBinanceKlines(symbol, interval, totalLimit);
      klines.value = fetchedKlines;
      console.log(`useKlines: Hentet ${klines.value.length} klines for ${symbol} ${interval} (requested ${totalLimit})`);
    } catch (err: any) {
      console.error("useKlines: Feil under henting:", err);
      error.value = err.message || 'Ukjent feil ved henting av klines.';
      klines.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  return {
    klines: readonly(klines),
    isLoading: readonly(isLoading),
    error: readonly(error),
    loadKlines // Funksjon for å initiere lasting
  };
}