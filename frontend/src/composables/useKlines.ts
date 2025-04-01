import { ref, readonly } from 'vue';
import { fetchBinanceKlines, type Kline } from '../services/binanceAPI';

export function useKlines() {
  const klines = ref<Kline[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Funksjon for å laste data, tar parametere
  async function loadKlines(
    symbol: string,
    interval: string,
    limit: number = 1000, // Standard til maks per request
    startTime?: number,
    endTime?: number
  ) {
    isLoading.value = true;
    error.value = null;
    klines.value = []; // Tømmer forrige resultat

    try {
      const fetchedKlines = await fetchBinanceKlines(symbol, interval, limit, startTime, endTime);
      klines.value = fetchedKlines;
      console.log(`useKlines: Hentet ${klines.value.length} klines for ${symbol} ${interval}`);
    } catch (err: any) {
      console.error("useKlines: Feil under henting:", err);
      error.value = err.message || 'Ukjent feil ved henting av klines.';
      klines.value = []; // Sørg for at den er tom ved feil
    } finally {
      isLoading.value = false;
    }
  }

  // Returnerer reaktive referanser (men klines som readonly for å unngå ekstern modifikasjon)
  // og funksjonen for å laste data
  return {
    klines: readonly(klines), // Brukere av composable kan lese, men ikke direkte sette klines
    isLoading: readonly(isLoading),
    error: readonly(error),
    loadKlines // Funksjon for å initiere lasting
  };
}