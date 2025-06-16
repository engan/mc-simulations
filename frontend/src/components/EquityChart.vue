<template>
  <div class="chart-container">
    <h3>Equity Curve</h3>
    <apexchart
      v-if="chartSeries[0]?.data.length > 0"
      type="line"
      height="400"
      :options="chartOptions"
      :series="chartSeries"
    ></apexchart>
    <p v-else>No equity data to display.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EquityPoint } from '@/types/common_strategy_types';

// Definerer at komponenten forventer å motta equityCurve som en "prop"
const props = defineProps<{
  equityCurve: EquityPoint[];
  maxPoints?: number; // Valgfri prop for å begrense antall punkter i grafen
}>();

// Formaterer dataene fra Rust til det formatet ApexCharts forventer
const chartSeries = computed(() => {
  let dataPoints = props.equityCurve;

  // --- NY LOGIKK FOR SAMPLING ---
  if (props.maxPoints && dataPoints.length > props.maxPoints) {
    console.log(`Sampling equity curve from ${dataPoints.length} to ${props.maxPoints} points for performance.`);
    const sampledData = [];
    const step = Math.floor(dataPoints.length / props.maxPoints);
    for (let i = 0; i < dataPoints.length; i += step) {
      sampledData.push(dataPoints[i]);
    }
    dataPoints = sampledData;
  }
  // --- SLUTT PÅ NY LOGIKK ---

  return [
    {
      name: 'Equity',
      data: dataPoints.map(point => ({
        x: point.timestamp,
        y: parseFloat(point.equity.toFixed(2)),
      })),
    },
  ];
});

// Konfigurasjon for hvordan grafen skal se ut
const chartOptions = computed(() => ({
  chart: {
    id: 'equity-curve',
    foreColor: '#ccc', // Lys tekstfarge for mørkt tema
    toolbar: {
      show: true,
      tools: {
        download: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true
      }
    }
  },
  xaxis: {
    type: 'datetime',
    labels: {
      datetimeUTC: false, // Viser tid i lokal tidssone
      style: {
        colors: '#ccc'
      }
    },
  },
  yaxis: {
    title: {
      text: 'Equity (USDT)',
      style: {
        color: '#ccc'
      }
    },
    labels: {
      formatter: (value: number) => `${value.toFixed(2)}`,
       style: {
        colors: '#ccc'
      }
    }
  },
  tooltip: {
    theme: 'dark',
    x: {
      format: 'dd MMM yyyy - HH:mm',
    },
  },
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  grid: {
    borderColor: '#555',
  },
  colors: ['#008FFB'], // Blåfarge for linjen
}));
</script>

<style scoped>
.chart-container {
  margin-top: 2rem;
  background-color: #1e1e1e;
  padding: 1rem;
  border-radius: 5px;
}
</style>