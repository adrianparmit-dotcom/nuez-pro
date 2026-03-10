// ============================================================
// simulador.js — Módulo 1: Simulador de Compra
// Lógica completa de cálculo y renderizado del simulador
// ============================================================

import {
  getNumInput, getStrInput, setEl,
  calcKgLimpio, calcKgPorVariedad, calcFacturacionVariedad,
  calcPrecioPponderado, sumObj, calcCostoHH, calcHorasLote,
  calcCostoProduccion, calcCostoPackaging, calcCostoTotal,
  calcRentabilidad, formatCurrency, formatKg, formatPct, formatNum,
  showToast, VARIEDADES, COLORES_VARIEDAD
} from "./utils.js";

import {
  crearGraficoVariedades,
  crearGraficoFacturacion
} from "./charts.js";

import { guardarSimulacion, obtenerSimulaciones, eliminarSimulacion } from "./db.js";

// ── Estado local del simulador ────────────────────────────
let resultadoActual = null;  // Último resultado calculado
let chartVariedades = null;
let chartFacturacion = null;

// ── Inicialización ────────────────────────────────────────
export function initSimulador() {
  // Construir filas de variedades dinámicamente
  _renderVariedadesTable();

  // Botones principales
  document.getElementById("btn-calcular")?.addEventListener("click", calcular);
  document.getElementById("btn-guardar")?.addEventListener("click", guardarResultado);
  document.getElementById("btn-limpiar")?.addEventListener("click", limpiarFormulario);

  // Recalcular cuando cambia rendimiento (para mostrar kg limpio en tiempo real)
  document.getElementById("rendimientoPct")?.addEventListener("input", _actualizarKgLimpio);
  document.getElementById("kgCascara")?.addEventListener("input",      _actualizarKgLimpio);

  // Cargar historial de simulaciones
  _cargarHistorial();

  // Marcar step 1 como activo
  _setStep(1);
}

// ── Render de tabla de variedades ─────────────────────────
function _renderVariedadesTable() {
  const tbody = document.getElementById("tbody-variedades");
  if (!tbody) return;

  tbody.innerHTML = VARIEDADES.map((v, i) => `
    <tr data-v="${i + 1}" class="variety-table">
      <td>
        <div class="variety-name-cell">
          <span class="dot"></span>
          ${v.nombre}
        </div>
      </td>
      <td>
        <div class="pct-input-group">
          <div class="input-wrapper suffix">
            <input type="number" id="pct_${v.key}" min="0" max="100" step="0.1"
                   placeholder="0" oninput="window._simOnPctChange()">
            <span class="input-suffix">%</span>
          </div>
        </div>
      </td>
      <td class="mono" id="kg_${v.key}">—</td>
      <td>
        <div class="input-wrapper">
          <span class="input-prefix">$</span>
          <input type="number" id="precio_${v.key}" min="0" step="0.01" placeholder="0.00">
        </div>
      </td>
      <td class="mono text-accent" id="fact_${v.key}">—</td>
    </tr>
  `).join("");

  // Exponer callback global para onchange en inputs
  window._simOnPctChange = _onPctChange;
}

// ── Callback al cambiar porcentajes ──────────────────────
function _onPctChange() {
  const total = VARIEDADES.reduce((acc, v) => acc + (getNumInput(`pct_${v.key}`) || 0), 0);
  const indicator = document.getElementById("pct-total-indicator");
  if (!indicator) return;

  indicator.textContent = `Σ porcentajes: ${total.toFixed(1)}%`;
  indicator.className = "pct-total-indicator " +
    (Math.abs(total - 100) < 0.1 ? "ok" : total > 100 ? "over" : "under");

  // Si hay kg limpio calculado, actualizar kg por variedad en vivo
  if (resultadoActual?.kgLimpio) {
    _mostrarKgVariedad(resultadoActual.kgLimpio);
  }
}

// ── Actualiza kg limpio en tiempo real ───────────────────
function _actualizarKgLimpio() {
  const kgCascara     = getNumInput("kgCascara");
  const rendimientoPct = getNumInput("rendimientoPct");

  if (kgCascara && rendimientoPct) {
    const kgLimpio = calcKgLimpio(kgCascara, rendimientoPct);
    setEl("display-kg-limpio", formatKg(kgLimpio));
  }
}

// ── Muestra kg por variedad en la tabla ──────────────────
function _mostrarKgVariedad(kgLimpio) {
  VARIEDADES.forEach(v => {
    const pct = getNumInput(`pct_${v.key}`);
    const kg  = kgLimpio * (pct / 100);
    setEl(`kg_${v.key}`, formatKg(kg));
  });
}

// ── Función principal de cálculo ─────────────────────────
export function calcular() {
  // 1. Leer inputs
  const kgCascara      = getNumInput("kgCascara");
  const precioCascara  = getNumInput("precioCascara");
  const transporte     = getNumInput("transporte");
  const sueldos        = getNumInput("sueldos");
  const operarios      = getNumInput("operarios");
  const horasDiarias   = getNumInput("horasDiarias");
  const cuotaMaquina   = getNumInput("cuotaMaquina");
  const diasMes        = getNumInput("diasMes");
  const precioBolsa    = getNumInput("precioBolsa");
  const precioCaja     = getNumInput("precioCaja");
  const costoEnvio     = getNumInput("costoEnvio");
  const kgMaquinaDia   = getNumInput("kgMaquinaDia");
  const rendimientoPct = getNumInput("rendimientoPct");

  // Validación básica
  if (!kgCascara || !precioCascara) {
    showToast("Completá al menos los kg y precio de nuez con cáscara.", "error");
    return;
  }
  if (!rendimientoPct) {
    showToast("Ingresá el rendimiento estimado del lote.", "error");
    return;
  }

  // 2. Kg limpio
  const kgLimpio = calcKgLimpio(kgCascara, rendimientoPct);

  // 3. Porcentajes y kg por variedad
  const porcentajes = {};
  const kgVariedad  = {};
  VARIEDADES.forEach(v => {
    porcentajes[v.key] = getNumInput(`pct_${v.key}`);
    kgVariedad[v.key]  = kgLimpio * (porcentajes[v.key] / 100);
  });

  // Verificar que los % sumen ~100
  const sumPct = Object.values(porcentajes).reduce((a, b) => a + b, 0);
  if (sumPct > 0 && Math.abs(sumPct - 100) > 1) {
    showToast(`Los porcentajes suman ${sumPct.toFixed(1)}%. Deben sumar 100%.`, "error");
    return;
  }

  // 4. Precios y facturación
  const precios = {};
  VARIEDADES.forEach(v => { precios[v.key] = getNumInput(`precio_${v.key}`); });

  const facturacionVariedad = calcFacturacionVariedad(kgVariedad, precios);
  const facturacionTotal    = sumObj(facturacionVariedad);
  const precioPpond         = calcPrecioPponderado(facturacionTotal, kgLimpio);

  // 5. Costos
  const compraMP      = kgCascara * precioCascara;
  const horasLote     = calcHorasLote(kgCascara, kgMaquinaDia, horasDiarias);
  const costoProduccion = calcCostoProduccion({
    sueldos, horasDiarias, diasMes, operarios, horasLote, cuotaMaquina
  });
  const packaging     = calcCostoPackaging(kgLimpio, precioBolsa, precioCaja);
  const transporteVenta = (kgLimpio / 5) * costoEnvio; // estimado por bolsa de 5kg

  const costoTotal    = calcCostoTotal({
    compraMateriaPrima: compraMP,
    transporte,
    costoProduccion,
    packaging,
    transporteVenta
  });

  const costoRealKgLimpio = kgLimpio > 0 ? costoTotal / kgLimpio : 0;

  // 6. Rentabilidad
  const { ganancia, margenPct, estado } = calcRentabilidad(facturacionTotal, costoTotal);

  // 7. Guardar resultado para posible guardado en DB
  resultadoActual = {
    kgCascara, precioCascara, transporte, sueldos, operarios,
    horasDiarias, cuotaMaquina, diasMes, precioBolsa, precioCaja,
    costoEnvio, kgMaquinaDia, rendimientoPct,
    kgLimpio, porcentajes, kgVariedad, precios,
    facturacionVariedad, facturacionTotal, precioPpond,
    compraMP, horasLote, costoProduccion, packaging, transporteVenta,
    costoTotal, costoRealKgLimpio,
    ganancia, margenPct, estado
  };

  // 8. Renderizar resultados
  _renderResultados(resultadoActual);

  // 9. Actualizar gráficos
  _actualizarGraficos(kgVariedad, facturacionVariedad);

  // 10. Actualizar tabla de variedades con facturación
  VARIEDADES.forEach(v => {
    setEl(`kg_${v.key}`,   formatKg(kgVariedad[v.key]));
    setEl(`fact_${v.key}`, formatCurrency(facturacionVariedad[v.key]));
  });

  // 11. Mostrar panel de resultados
  document.getElementById("resultados-panel")?.classList.remove("hidden");
  document.getElementById("resultados-panel")?.scrollIntoView({ behavior: "smooth" });

  _setStep(4);
  showToast("Simulación calculada correctamente.", "success");
}

// ── Render del panel de resultados ───────────────────────
function _renderResultados(r) {
  // KPIs principales
  setEl("res-facturacion",      formatCurrency(r.facturacionTotal));
  setEl("res-costo-total",      formatCurrency(r.costoTotal));
  setEl("res-ganancia",         formatCurrency(r.ganancia));
  setEl("res-margen",           formatPct(r.margenPct));
  setEl("res-kg-limpio",        formatKg(r.kgLimpio));
  setEl("res-precio-ppond",     formatCurrency(r.precioPpond));
  setEl("res-costo-kg-limpio",  formatCurrency(r.costoRealKgLimpio));
  setEl("res-horas-lote",       formatNum(r.horasLote, 1) + " hs");

  // Desglose de costos
  setEl("desg-compra-mp",       formatCurrency(r.compraMP));
  setEl("desg-transporte",      formatCurrency(r.transporte));
  setEl("desg-produccion",      formatCurrency(r.costoProduccion));
  setEl("desg-packaging",       formatCurrency(r.packaging));
  setEl("desg-transp-venta",    formatCurrency(r.transporteVenta));
  setEl("desg-total",           formatCurrency(r.costoTotal));

  // Alerta de rentabilidad
  const alertEl = document.getElementById("rentabilidad-alert");
  if (alertEl) {
    const configs = {
      "excelente":    { icon: "🟢", title: "¡COMPRA EXCELENTE!", desc: `Margen del ${r.margenPct.toFixed(1)}% — Muy rentable` },
      "aceptable":    { icon: "🟡", title: "COMPRA ACEPTABLE",   desc: `Margen del ${r.margenPct.toFixed(1)}% — Rentable pero ajustada` },
      "no-rentable":  { icon: "🔴", title: "COMPRA NO RENTABLE", desc: `Margen del ${r.margenPct.toFixed(1)}% — No conviene comprar` }
    };
    const cfg = configs[r.estado];
    alertEl.className = `rentabilidad-alert ${r.estado}`;
    alertEl.innerHTML = `
      <span class="alert-icon">${cfg.icon}</span>
      <div>
        <div class="alert-title">${cfg.title}</div>
        <div class="alert-desc">${cfg.desc}</div>
      </div>
    `;
  }

  // Color del métric de ganancia
  const gananciaCard = document.getElementById("card-ganancia");
  if (gananciaCard) {
    gananciaCard.className = "metric-card " +
      (r.estado === "excelente" ? "green" : r.estado === "aceptable" ? "yellow" : "red");
  }
}

// ── Gráficos ──────────────────────────────────────────────
function _actualizarGraficos(kgVariedad, facturacionVariedad) {
  chartVariedades  = crearGraficoVariedades("chart-variedades", kgVariedad);
  chartFacturacion = crearGraficoFacturacion("chart-facturacion", facturacionVariedad);
}

// ── Guardar simulación en Firestore ──────────────────────
async function guardarResultado() {
  if (!resultadoActual) {
    showToast("Primero calculá la simulación.", "error");
    return;
  }

  try {
    const btn = document.getElementById("btn-guardar");
    if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

    await guardarSimulacion(resultadoActual);
    showToast("Simulación guardada en la base de datos.", "success");
    await _cargarHistorial();
  } catch (err) {
    console.error("Error al guardar:", err);
    showToast("Error al guardar. Verificá la conexión a Firebase.", "error");
  } finally {
    const btn = document.getElementById("btn-guardar");
    if (btn) { btn.disabled = false; btn.textContent = "💾 Guardar simulación"; }
  }
}

// ── Historial de simulaciones ────────────────────────────
async function _cargarHistorial() {
  const tbody = document.getElementById("tbody-historial");
  if (!tbody) return;

  try {
    const sims = await obtenerSimulaciones();

    if (!sims.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:24px">
        No hay simulaciones guardadas aún.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = sims.slice(0, 20).map(s => `
      <tr>
        <td class="text-muted text-xs">${formatFechaSimple(s.creadoEn)}</td>
        <td class="mono">${formatKg(s.kgCascara)}</td>
        <td class="mono">${formatCurrency(s.precioCascara)}</td>
        <td class="mono">${formatPct(s.rendimientoPct, 0)}</td>
        <td class="mono text-accent">${formatCurrency(s.facturacionTotal)}</td>
        <td class="mono">${formatCurrency(s.costoTotal)}</td>
        <td class="mono ${s.estado === 'excelente' ? 'text-green' : s.estado === 'aceptable' ? 'text-yellow' : 'text-red'}">
          ${formatPct(s.margenPct)}
        </td>
        <td>
          <span class="badge badge-${s.estado === 'excelente' ? 'green' : s.estado === 'aceptable' ? 'yellow' : 'red'}">
            ${s.estado === 'excelente' ? 'Excelente' : s.estado === 'aceptable' ? 'Aceptable' : 'No rentable'}
          </span>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="window._eliminarSim('${s.id}')">🗑</button>
        </td>
      </tr>
    `).join("");

    // Exponer función global para eliminar
    window._eliminarSim = async (id) => {
      if (!confirm("¿Eliminar esta simulación?")) return;
      await eliminarSimulacion(id);
      showToast("Simulación eliminada.", "info");
      _cargarHistorial();
    };

  } catch (err) {
    console.error("Error al cargar historial:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center" style="padding:24px">
      Error al cargar. Verificá la conexión a Firebase.
    </td></tr>`;
  }
}

// ── Limpiar formulario ────────────────────────────────────
function limpiarFormulario() {
  if (!confirm("¿Limpiar todo el formulario?")) return;
  document.querySelectorAll("#simulador-form input[type='number']").forEach(el => el.value = "");
  document.getElementById("resultados-panel")?.classList.add("hidden");
  resultadoActual = null;
  _setStep(1);
  showToast("Formulario limpiado.", "info");
}

// ── Stepper visual ────────────────────────────────────────
function _setStep(n) {
  document.querySelectorAll(".step").forEach((el, i) => {
    el.classList.remove("active", "done");
    if (i + 1 < n)  el.classList.add("done");
    if (i + 1 === n) el.classList.add("active");
  });
}

// ── Helper fecha simple ───────────────────────────────────
function formatFechaSimple(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"2-digit" });
}
