// ============================================================
// charts.js — Módulo de gráficos con Chart.js
// Todos los gráficos de la aplicación
// ============================================================

import { VARIEDADES, COLORES_VARIEDAD, formatCurrency, formatPct } from "./utils.js";

// Tema global Chart.js — oscuro
const CHART_DEFAULTS = {
  color:    "#8b92a8",
  font:     { family: "'IBM Plex Mono', monospace", size: 11 }
};

/** Aplica defaults globales de Chart.js */
export function initChartDefaults() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.color           = CHART_DEFAULTS.color;
  Chart.defaults.font.family     = CHART_DEFAULTS.font.family;
  Chart.defaults.font.size       = CHART_DEFAULTS.font.size;
  Chart.defaults.plugins.tooltip.backgroundColor = "#1a1e2a";
  Chart.defaults.plugins.tooltip.borderColor      = "#252a38";
  Chart.defaults.plugins.tooltip.borderWidth      = 1;
  Chart.defaults.plugins.tooltip.padding          = 10;
  Chart.defaults.plugins.legend.labels.padding    = 16;
}

/**
 * Gráfico de dona — Distribución de variedades.
 * @param {string} canvasId
 * @param {Object} kgVariedad - { v1: 45, v2: 30, ... }
 * @returns {Chart}
 */
export function crearGraficoVariedades(canvasId, kgVariedad) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Destruir instancia previa si existe
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const labels = VARIEDADES.map(v => v.nombre);
  const data   = VARIEDADES.map(v => kgVariedad[v.key] || 0);
  const colors = VARIEDADES.map(v => COLORES_VARIEDAD[v.key]);

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + "cc"),
        borderColor:     colors,
        borderWidth:     1,
        hoverOffset:     8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 8,
            font: { size: 10 }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.parsed.toFixed(1)} kg (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Gráfico de barras — Facturación por variedad.
 * @param {string} canvasId
 * @param {Object} facturacionVariedad - { v1: 1200, v2: 800, ... }
 * @returns {Chart}
 */
export function crearGraficoFacturacion(canvasId, facturacionVariedad) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const labels = VARIEDADES.map(v => v.nombre.split(" ").slice(-2).join(" ")); // nombre corto
  const data   = VARIEDADES.map(v => facturacionVariedad[v.key] || 0);
  const colors = VARIEDADES.map(v => COLORES_VARIEDAD[v.key]);

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Facturación ($)",
        data,
        backgroundColor: colors.map(c => c + "99"),
        borderColor:     colors,
        borderWidth:     1,
        borderRadius:    4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` $ ${ctx.parsed.y.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#252a38" },
          ticks: { maxRotation: 45, font: { size: 9 } }
        },
        y: {
          grid: { color: "#252a38" },
          ticks: {
            callback: (val) => "$ " + (val / 1000).toFixed(0) + "k"
          }
        }
      }
    }
  });
}

/**
 * Gráfico de líneas — Historial de rentabilidad por lote.
 * @param {string} canvasId
 * @param {Array} lotes - Array de lotes ordenados por fecha
 * @returns {Chart}
 */
export function crearGraficoRentabilidad(canvasId, lotes) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const labels  = lotes.map(l => l.numeroLote || l.id?.substring(0,8));
  const margins = lotes.map(l => l.margenPct || 0);

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Margen %",
        data: margins,
        borderColor:     "#c8902b",
        backgroundColor: "rgba(200,144,43,0.1)",
        borderWidth:     2,
        pointRadius:     5,
        pointBackgroundColor: margins.map(m =>
          m >= 25 ? "#2ecc71" : m >= 10 ? "#f1c40f" : "#e74c3c"
        ),
        pointBorderColor: "#0d0f12",
        pointBorderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Margen: ${ctx.parsed.y.toFixed(1)}%`
          }
        },
        annotation: {
          annotations: {
            lineVerde:  { type: "line", yMin: 25, yMax: 25, borderColor: "#2ecc7155", borderWidth: 1, borderDash: [4,4] },
            lineAmarillo: { type: "line", yMin: 10, yMax: 10, borderColor: "#f1c40f55", borderWidth: 1, borderDash: [4,4] }
          }
        }
      },
      scales: {
        x: { grid: { color: "#252a38" } },
        y: {
          grid: { color: "#252a38" },
          ticks: { callback: (val) => val + "%" }
        }
      }
    }
  });
}

/**
 * Gráfico de barras horizontales — Comparación de proveedores.
 * @param {string} canvasId
 * @param {Array} proveedores
 * @param {string} campo - campo a comparar ('rendimientoPromedio', etc.)
 * @returns {Chart}
 */
export function crearGraficoProveedores(canvasId, proveedores, campo = "rendimientoPromedio") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const labels = proveedores.map(p => p.nombre);
  const data   = proveedores.map(p => p[campo] || 0);

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "rgba(200,144,43,0.4)",
        borderColor:     "#c8902b",
        borderWidth:     1,
        borderRadius:    4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x.toFixed(1)}`
          }
        }
      },
      scales: {
        x: { grid: { color: "#252a38" } },
        y: { grid: { display: false } }
      }
    }
  });
}

/**
 * Gráfico de eficiencia (gauge simulado con dona).
 * @param {string} canvasId
 * @param {number} eficienciaPct - 0 a 100
 * @returns {Chart}
 */
export function crearGaugeEficiencia(canvasId, eficienciaPct) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const color = eficienciaPct >= 80 ? "#2ecc71" :
                eficienciaPct >= 50 ? "#f1c40f" : "#e74c3c";

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [eficienciaPct, 100 - eficienciaPct],
        backgroundColor: [color + "cc", "#1a1e2a"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      rotation: -90,
      circumference: 180,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });
}
