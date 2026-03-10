// ============================================================
// calculadora.js — Módulo 2: Calculadora Inversa
// Calcula precio máximo a pagar por kg de nuez con cáscara
// ============================================================

import {
  getNumInput, setEl, formatCurrency, formatPct, showToast
} from "./utils.js";

// ── Inicialización ────────────────────────────────────────
export function initCalculadora() {
  document.getElementById("btn-calcular-inv")?.addEventListener("click", calcularInversa);

  // Recalcular al cambiar cualquier input
  ["precio-venta-prom", "margen-deseado", "rendimiento-calc",
   "costo-transporte-calc", "costo-produccion-calc",
   "costo-packaging-calc", "costo-otros-calc"
  ].forEach(id => {
    document.getElementById(id)?.addEventListener("input", calcularInversa);
  });
}

// ── Cálculo principal ─────────────────────────────────────
export function calcularInversa() {
  const precioVenta      = getNumInput("precio-venta-prom");
  const margenDeseado    = getNumInput("margen-deseado");
  const rendimiento      = getNumInput("rendimiento-calc");
  const costoTransporte  = getNumInput("costo-transporte-calc");
  const costoProduccion  = getNumInput("costo-produccion-calc");
  const costoPackaging   = getNumInput("costo-packaging-calc");
  const costoOtros       = getNumInput("costo-otros-calc");

  // Validación
  if (!precioVenta || !margenDeseado || !rendimiento) {
    return; // no mostrar error, simplemente no calcular
  }

  if (margenDeseado >= 100) {
    showToast("El margen deseado no puede ser 100% o mayor.", "error");
    return;
  }

  // ── Lógica de cálculo inverso ─────────────────────────
  //
  // Precio de venta promedio = PPP ($/kg limpio)
  // Margen = (Facturación - CostoTotal) / Facturación
  //
  // Por cada KG de nuez CON CÁSCARA producimos:
  //   kg_limpio = rendimiento/100  kg limpios
  //
  // Facturación por kg cáscara = PPP * rendimiento/100
  //
  // CostoTotal por kg cáscara =
  //   PrecioKgCascara + (costos_por_kg_limpio * rendimiento/100)
  //
  // Margen = (Facturación - CostoTotal) / Facturación
  // => CostoTotal = Facturación * (1 - margen/100)
  // => PrecioKgCascara = CostoTotal - (costos_operativos * rend/100)

  const rend             = rendimiento / 100;
  const facturacionPorKgCasc = precioVenta * rend;

  // Costo total permitido por kg cáscara (dado el margen deseado)
  const costoTotalPermitidoPorKgCasc = facturacionPorKgCasc * (1 - margenDeseado / 100);

  // Costos operativos ya expresados en $/kg limpio → convertir a $/kg cáscara
  const costosOpPorKgLimpio = costoTransporte + costoProduccion + costoPackaging + costoOtros;
  const costosOpPorKgCasc   = costosOpPorKgLimpio * rend;

  // Precio máximo disponible para la materia prima
  const precioMaximo = costoTotalPermitidoPorKgCasc - costosOpPorKgCasc;

  // ── Cálculos adicionales para el desglose ────────────
  const costoTotalKgLimpio    = precioVenta * (1 - margenDeseado / 100);
  const gananciaKgLimpio      = precioVenta - costoTotalKgLimpio;
  const facturacionTotalRef   = precioVenta * 1000 * rend; // referencia para 1000 kg cáscara

  // ── Renderizar resultado ──────────────────────────────
  const resultado = document.getElementById("resultado-inverso");
  if (resultado) resultado.classList.remove("hidden");

  // Número grande
  const bigNumber = document.getElementById("precio-maximo-display");
  if (bigNumber) bigNumber.textContent = formatCurrency(precioMaximo);

  // Métricas secundarias
  setEl("inv-facturacion-kg",  formatCurrency(facturacionPorKgCasc));
  setEl("inv-costo-op-kg",     formatCurrency(costosOpPorKgCasc));
  setEl("inv-costo-total-kg",  formatCurrency(costoTotalPermitidoPorKgCasc));
  setEl("inv-ganancia-kg",     formatCurrency(gananciaKgLimpio));

  // Semáforo de viabilidad
  const semaforo = document.getElementById("semaforo-inverso");
  if (semaforo) {
    if (precioMaximo > 0) {
      semaforo.className  = "rentabilidad-alert excelente";
      semaforo.innerHTML  = `
        <span class="alert-icon">✅</span>
        <div>
          <div class="alert-title">PRECIO MÁXIMO: ${formatCurrency(precioMaximo)} / kg</div>
          <div class="alert-desc">
            Con este precio y ${rendimiento}% de rendimiento, lográs el margen de ${margenDeseado}% deseado.
          </div>
        </div>
      `;
    } else {
      semaforo.className  = "rentabilidad-alert no-rentable";
      semaforo.innerHTML  = `
        <span class="alert-icon">🚫</span>
        <div>
          <div class="alert-title">INVIABLE CON ESOS PARÁMETROS</div>
          <div class="alert-desc">
            Los costos operativos superan el margen posible. Revisá rendimiento, costos o margen deseado.
          </div>
        </div>
      `;
    }
  }

  // Tabla de escenarios: variando rendimiento ±5
  _renderEscenarios(precioVenta, margenDeseado, rendimiento, costosOpPorKgLimpio);
}

// ── Tabla de escenarios alternativos ─────────────────────
function _renderEscenarios(precioVenta, margenDeseado, rendimientoBase, costosOpPorKgLimpio) {
  const tbody = document.getElementById("tbody-escenarios");
  if (!tbody) return;

  const escenarios = [
    rendimientoBase - 10,
    rendimientoBase - 5,
    rendimientoBase,
    rendimientoBase + 5,
    rendimientoBase + 10
  ].filter(r => r > 0 && r <= 100);

  tbody.innerHTML = escenarios.map(rend => {
    const r                   = rend / 100;
    const facturPorKgCasc     = precioVenta * r;
    const costoPermitido      = facturPorKgCasc * (1 - margenDeseado / 100);
    const costosOpKgCasc      = costosOpPorKgLimpio * r;
    const precioMax           = costoPermitido - costosOpKgCasc;
    const esBase              = rend === rendimientoBase;

    return `
      <tr ${esBase ? 'style="background:var(--accent-dim)"' : ""}>
        <td class="mono ${esBase ? "text-accent fw-bold" : ""}">
          ${rend.toFixed(0)}% ${esBase ? "← actual" : ""}
        </td>
        <td class="mono">${formatCurrency(facturPorKgCasc)}</td>
        <td class="mono ${precioMax > 0 ? "text-green" : "text-red"} fw-bold">
          ${precioMax > 0 ? formatCurrency(precioMax) : "Inviable"}
        </td>
        <td>
          <span class="badge ${precioMax > 0 ? "badge-green" : "badge-red"}">
            ${precioMax > 0 ? "Viable" : "No viable"}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}
