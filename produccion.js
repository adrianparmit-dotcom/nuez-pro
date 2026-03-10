// ============================================================
// produccion.js — Módulo 3: Registro de Producción Real
// Registro de lotes reales + comparación con teórico
// ============================================================

import {
  getNumInput, getStrInput, setEl,
  calcKgLimpio, calcKgPorVariedad, calcFacturacionVariedad,
  sumObj, calcPrecioPponderado, calcRentabilidad,
  calcKgHora, calcEficiencia, calcHorasEntreTiempos,
  formatCurrency, formatKg, formatPct, formatNum, formatFecha,
  showToast, generarNumeroLote, VARIEDADES
} from "./utils.js";

import { registrarLote, obtenerLotes, eliminarLote } from "./db.js";
import { crearGraficoVariedades } from "./charts.js";

// ── Inicialización ────────────────────────────────────────
export function initProduccion() {
  // Generar número de lote automático
  const numLoteEl = document.getElementById("prod-numero-lote");
  if (numLoteEl && !numLoteEl.value) {
    numLoteEl.value = generarNumeroLote();
  }

  // Botón generar nuevo número de lote
  document.getElementById("btn-nuevo-lote-num")?.addEventListener("click", () => {
    if (numLoteEl) numLoteEl.value = generarNumeroLote();
  });

  // Calcular duración en tiempo real
  ["prod-hora-inicio", "prod-hora-fin"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", _calcularDuracion);
  });

  // Recalcular eficiencia al cambiar inputs
  ["prod-kg-procesados", "prod-tiempo-muerto"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", _calcularEficienciaVivo);
  });

  // Construir tabla de variedades de producción real
  _renderVariedadesProduccion();

  // Botones
  document.getElementById("btn-registrar-lote")?.addEventListener("click", registrarLoteReal);
  document.getElementById("btn-limpiar-prod")?.addEventListener("click",   limpiarFormProd);

  // Frenadas dinámicas
  document.getElementById("btn-agregar-frenada")?.addEventListener("click", agregarFrenada);

  // Cargar historial
  _cargarHistorialLotes();
}

// ── Render tabla variedades producción ───────────────────
function _renderVariedadesProduccion() {
  const tbody = document.getElementById("tbody-variedades-prod");
  if (!tbody) return;

  tbody.innerHTML = VARIEDADES.map(v => `
    <tr>
      <td>${v.nombre}</td>
      <td>
        <div class="input-wrapper suffix">
          <input type="number" id="prod-pct-${v.key}" min="0" max="100" step="0.1"
                 placeholder="0" oninput="window._prodOnPctChange()">
          <span class="input-suffix">%</span>
        </div>
      </td>
      <td class="mono" id="prod-kg-${v.key}">—</td>
      <td>
        <div class="input-wrapper">
          <span class="input-prefix">$</span>
          <input type="number" id="prod-precio-${v.key}" min="0" step="0.01" placeholder="0.00"
                 oninput="window._prodOnPctChange()">
        </div>
      </td>
      <td class="mono text-accent" id="prod-fact-${v.key}">—</td>
    </tr>
  `).join("");

  window._prodOnPctChange = _onProdPctChange;
}

// ── Callback cambio % variedades ─────────────────────────
function _onProdPctChange() {
  const kgLimpio = _getKgLimpioProd();
  VARIEDADES.forEach(v => {
    const pct = getNumInput(`prod-pct-${v.key}`);
    const kg  = kgLimpio * (pct / 100);
    const precio = getNumInput(`prod-precio-${v.key}`);
    setEl(`prod-kg-${v.key}`,   formatKg(kg));
    setEl(`prod-fact-${v.key}`, formatCurrency(kg * precio));
  });
}

function _getKgLimpioProd() {
  const kgProcesados  = getNumInput("prod-kg-procesados");
  const rendimientoR  = getNumInput("prod-rendimiento-real");
  return calcKgLimpio(kgProcesados, rendimientoR);
}

// ── Calcular duración efectiva ────────────────────────────
function _calcularDuracion() {
  const inicio    = getStrInput("prod-hora-inicio");
  const fin       = getStrInput("prod-hora-fin");
  const horas     = calcHorasEntreTiempos(inicio, fin);
  const tiempoMuerto = getNumInput("prod-tiempo-muerto") / 60; // minutos → horas
  const horasEfectivas = Math.max(horas - tiempoMuerto, 0);

  setEl("display-horas-totales",    formatNum(horas, 2) + " hs");
  setEl("display-horas-efectivas",  formatNum(horasEfectivas, 2) + " hs");
}

// ── Calcular eficiencia en vivo ────────────────────────────
function _calcularEficienciaVivo() {
  const inicio       = getStrInput("prod-hora-inicio");
  const fin          = getStrInput("prod-hora-fin");
  const horas        = calcHorasEntreTiempos(inicio, fin);
  const tiempoMuerto = getNumInput("prod-tiempo-muerto") / 60;
  const horasEfec    = Math.max(horas - tiempoMuerto, 0);
  const kgProcesados = getNumInput("prod-kg-procesados");
  const kgMaquinaDia = getNumInput("prod-cap-teorica");
  const horasDiarias = getNumInput("prod-horas-turno") || 8;

  if (horasEfec > 0 && kgProcesados > 0) {
    const kgHoraReal = calcKgHora(kgProcesados, horasEfec);
    const eficiencia = calcEficiencia(kgHoraReal, kgMaquinaDia, horasDiarias);
    setEl("display-kg-hora",    formatNum(kgHoraReal, 1) + " kg/hs");
    setEl("display-eficiencia", formatPct(eficiencia));
    _actualizarRingEficiencia(eficiencia);
  }
}

// ── Ring de eficiencia ────────────────────────────────────
function _actualizarRingEficiencia(pct) {
  const circle = document.querySelector(".progress-circle");
  const text   = document.querySelector(".ring-text");
  if (!circle || !text) return;

  const circumference = 220;
  const offset = circumference - (pct / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  circle.className = "progress-circle " +
    (pct >= 80 ? "green" : pct >= 50 ? "yellow" : "red");
  text.textContent = pct.toFixed(0) + "%";
}

// ── Gestión de frenadas ───────────────────────────────────
let contadorFrenadas = 0;

function agregarFrenada() {
  contadorFrenadas++;
  const container = document.getElementById("frenadas-container");
  if (!container) return;

  const frenada = document.createElement("div");
  frenada.id = `frenada-${contadorFrenadas}`;
  frenada.className = "card mb-8";
  frenada.style.padding = "14px";
  frenada.innerHTML = `
    <div class="flex-between mb-8">
      <span class="text-xs text-muted">Frenada #${contadorFrenadas}</span>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('frenada-${contadorFrenadas}').remove()">
        ✕ Quitar
      </button>
    </div>
    <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr">
      <div class="form-group">
        <label>Hora</label>
        <input type="time" id="frenada-hora-${contadorFrenadas}">
      </div>
      <div class="form-group">
        <label>Duración (min)</label>
        <input type="number" id="frenada-dur-${contadorFrenadas}" min="0" placeholder="0">
      </div>
      <div class="form-group">
        <label>Motivo</label>
        <input type="text" id="frenada-motivo-${contadorFrenadas}" placeholder="ej: atasco, mantenimiento...">
      </div>
    </div>
  `;
  container.appendChild(frenada);
}

function _recolectarFrenadas() {
  const frenadas = [];
  for (let i = 1; i <= contadorFrenadas; i++) {
    const el = document.getElementById(`frenada-${i}`);
    if (!el) continue; // fue eliminada
    frenadas.push({
      hora:    document.getElementById(`frenada-hora-${i}`)?.value || "",
      duracion: parseFloat(document.getElementById(`frenada-dur-${i}`)?.value || 0),
      motivo:  document.getElementById(`frenada-motivo-${i}`)?.value || ""
    });
  }
  return frenadas;
}

// ── Registrar lote real ───────────────────────────────────
async function registrarLoteReal() {
  // Leer datos generales
  const numeroLote    = getStrInput("prod-numero-lote");
  const proveedor     = getStrInput("prod-proveedor");
  const fecha         = getStrInput("prod-fecha");
  const kgProcesados  = getNumInput("prod-kg-procesados");
  const horaInicio    = getStrInput("prod-hora-inicio");
  const horaFin       = getStrInput("prod-hora-fin");
  const numOperarios  = getNumInput("prod-operarios");
  const precioCascara = getNumInput("prod-precio-cascara");
  const tiempoMuerto  = getNumInput("prod-tiempo-muerto");
  const capTeorica    = getNumInput("prod-cap-teorica");
  const horasTurno    = getNumInput("prod-horas-turno") || 8;

  // Rendimiento real
  const rendimientoReal = getNumInput("prod-rendimiento-real");

  // Validación
  if (!proveedor || !fecha || !kgProcesados) {
    showToast("Completá al menos: proveedor, fecha y kg procesados.", "error");
    return;
  }

  // Calcular métricas
  const horas           = calcHorasEntreTiempos(horaInicio, horaFin);
  const horasEfectivas  = Math.max(horas - (tiempoMuerto / 60), 0);
  const kgLimpio        = calcKgLimpio(kgProcesados, rendimientoReal);
  const kgHora          = calcKgHora(kgProcesados, horasEfectivas || horas);
  const eficiencia      = calcEficiencia(kgHora, capTeorica, horasTurno);

  // Variedades
  const porcentajes = {};
  const kgVariedad  = {};
  const precios     = {};
  VARIEDADES.forEach(v => {
    porcentajes[v.key] = getNumInput(`prod-pct-${v.key}`);
    kgVariedad[v.key]  = kgLimpio * (porcentajes[v.key] / 100);
    precios[v.key]     = getNumInput(`prod-precio-${v.key}`);
  });

  const facturacionVariedad = calcFacturacionVariedad(kgVariedad, precios);
  const facturacionTotal    = sumObj(facturacionVariedad);
  const precioPpond         = calcPrecioPponderado(facturacionTotal, kgLimpio);

  // % Mariposa total
  const pctMariposaTotal = (porcentajes.v1 || 0) + (porcentajes.v2 || 0) + (porcentajes.v3 || 0);

  // Rentabilidad básica (solo materia prima + producción)
  const costoMP = kgProcesados * (precioCascara || 0);
  const { ganancia, margenPct, estado } = calcRentabilidad(facturacionTotal, costoMP);

  // Frenadas
  const frenadas = _recolectarFrenadas();

  // Objeto lote completo
  const lote = {
    numeroLote, proveedor, fecha,
    kgProcesados, horaInicio, horaFin, numOperarios, precioCascara,
    tiempoMuerto, capTeorica, horasTurno,
    rendimientoReal, kgLimpio,
    kgHora, eficiencia,
    porcentajes, kgVariedad, precios,
    facturacionVariedad, facturacionTotal, precioPpond,
    pctMariposaTotal,
    frenadas,
    ganancia, margenPct, estado,
    costoRealKgLimpio: kgLimpio > 0 ? costoMP / kgLimpio : 0
  };

  try {
    const btn = document.getElementById("btn-registrar-lote");
    if (btn) { btn.disabled = true; btn.textContent = "Registrando..."; }

    const id = await registrarLote(lote);
    showToast(`Lote ${numeroLote} registrado exitosamente.`, "success");

    // Mostrar resumen
    _mostrarResumenLote({ ...lote, id });

    // Nuevo número de lote para el próximo
    const numLoteEl = document.getElementById("prod-numero-lote");
    if (numLoteEl) numLoteEl.value = generarNumeroLote();

    // Recargar historial
    _cargarHistorialLotes();

  } catch (err) {
    console.error("Error al registrar lote:", err);
    showToast("Error al registrar. Verificá Firebase.", "error");
  } finally {
    const btn = document.getElementById("btn-registrar-lote");
    if (btn) { btn.disabled = false; btn.textContent = "✅ Registrar lote"; }
  }
}

// ── Resumen del lote recién registrado ───────────────────
function _mostrarResumenLote(lote) {
  const panel = document.getElementById("resumen-lote");
  if (!panel) return;

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="card-header">
      <span class="card-title-lg">Lote registrado: <span class="text-accent">${lote.numeroLote}</span></span>
      <span class="badge badge-${lote.estado === 'excelente' ? 'green' : lote.estado === 'aceptable' ? 'yellow' : 'red'}">
        ${lote.estado}
      </span>
    </div>
    <div class="grid-4 mt-16">
      <div class="metric-card">
        <div class="metric-label">Kg procesados</div>
        <div class="metric-value">${formatKg(lote.kgProcesados)}</div>
      </div>
      <div class="metric-card green">
        <div class="metric-label">Rendimiento real</div>
        <div class="metric-value">${formatPct(lote.rendimientoReal)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Kg/hora</div>
        <div class="metric-value">${formatNum(lote.kgHora, 1)}</div>
      </div>
      <div class="metric-card ${lote.eficiencia >= 80 ? 'green' : lote.eficiencia >= 50 ? 'yellow' : 'red'}">
        <div class="metric-label">Eficiencia</div>
        <div class="metric-value">${formatPct(lote.eficiencia)}</div>
      </div>
    </div>
    <div class="grid-3 mt-16">
      <div>
        <div class="metric-label">Facturación</div>
        <div class="text-mono text-accent fw-bold" style="font-size:18px">${formatCurrency(lote.facturacionTotal)}</div>
      </div>
      <div>
        <div class="metric-label">Precio prom. ponderado</div>
        <div class="text-mono fw-bold" style="font-size:18px">${formatCurrency(lote.precioPpond)}</div>
      </div>
      <div>
        <div class="metric-label">% Mariposa total</div>
        <div class="text-mono fw-bold" style="font-size:18px">${formatPct(lote.pctMariposaTotal)}</div>
      </div>
    </div>
  `;

  panel.scrollIntoView({ behavior: "smooth" });
}

// ── Historial de lotes ────────────────────────────────────
async function _cargarHistorialLotes() {
  const tbody = document.getElementById("tbody-historial-lotes");
  if (!tbody) return;

  try {
    const lotes = await obtenerLotes();

    if (!lotes.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:24px">
        No hay lotes registrados aún.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = lotes.slice(0, 30).map(l => `
      <tr>
        <td class="mono text-accent">${l.numeroLote || l.id?.substring(0,8)}</td>
        <td>${l.proveedor || "—"}</td>
        <td class="text-muted text-xs">${l.fecha || "—"}</td>
        <td class="mono">${formatKg(l.kgProcesados)}</td>
        <td class="mono">${formatPct(l.rendimientoReal)}</td>
        <td class="mono">${formatNum(l.kgHora, 1)}</td>
        <td class="mono ${l.eficiencia >= 80 ? 'text-green' : l.eficiencia >= 50 ? 'text-yellow' : 'text-red'}">
          ${formatPct(l.eficiencia)}
        </td>
        <td class="mono text-accent">${formatCurrency(l.facturacionTotal)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="window._verLote('${l.id}')">👁</button>
          <button class="btn btn-ghost btn-sm" onclick="window._eliminarLote('${l.id}')">🗑</button>
        </td>
      </tr>
    `).join("");

    // Exponer funciones globales
    window._verLote = (id) => {
      const lote = lotes.find(l => l.id === id);
      if (lote) _mostrarDetalleLote(lote);
    };

    window._eliminarLote = async (id) => {
      if (!confirm("¿Eliminar este lote?")) return;
      await eliminarLote(id);
      showToast("Lote eliminado.", "info");
      _cargarHistorialLotes();
    };

  } catch (err) {
    console.error("Error al cargar lotes:", err);
    tbody.innerHTML = `<tr><td colspan="9" class="text-muted text-center" style="padding:24px">
      Error al cargar. Verificá Firebase.
    </td></tr>`;
  }
}

// ── Detalle de lote (modal) ───────────────────────────────
function _mostrarDetalleLote(lote) {
  const overlay = document.getElementById("modal-lote");
  if (!overlay) return;

  const body = overlay.querySelector(".modal-body");
  if (!body) return;

  body.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="metric-label">Número de lote</div>
        <div class="text-mono text-accent fw-bold">${lote.numeroLote}</div>
      </div>
      <div>
        <div class="metric-label">Proveedor</div>
        <div class="fw-bold">${lote.proveedor}</div>
      </div>
      <div>
        <div class="metric-label">Fecha</div>
        <div>${lote.fecha}</div>
      </div>
      <div>
        <div class="metric-label">Kg procesados</div>
        <div class="text-mono">${formatKg(lote.kgProcesados)}</div>
      </div>
      <div>
        <div class="metric-label">Rendimiento real</div>
        <div class="text-mono ${lote.rendimientoReal >= 40 ? 'text-green' : 'text-yellow'}">
          ${formatPct(lote.rendimientoReal)}
        </div>
      </div>
      <div>
        <div class="metric-label">Kg/hora</div>
        <div class="text-mono">${formatNum(lote.kgHora, 1)}</div>
      </div>
      <div>
        <div class="metric-label">Eficiencia</div>
        <div class="text-mono ${lote.eficiencia >= 80 ? 'text-green' : 'text-yellow'}">
          ${formatPct(lote.eficiencia)}
        </div>
      </div>
      <div>
        <div class="metric-label">Frenadas</div>
        <div class="text-mono">${lote.frenadas?.length || 0} paradas</div>
      </div>
    </div>
    <hr class="divider">
    <div class="grid-3">
      <div>
        <div class="metric-label">Facturación total</div>
        <div class="text-mono text-accent fw-bold" style="font-size:18px">
          ${formatCurrency(lote.facturacionTotal)}
        </div>
      </div>
      <div>
        <div class="metric-label">Precio prom. ponderado</div>
        <div class="text-mono fw-bold" style="font-size:18px">
          ${formatCurrency(lote.precioPpond)}
        </div>
      </div>
      <div>
        <div class="metric-label">% Mariposa</div>
        <div class="text-mono fw-bold" style="font-size:18px">
          ${formatPct(lote.pctMariposaTotal)}
        </div>
      </div>
    </div>
    ${lote.frenadas?.length ? `
      <hr class="divider">
      <div class="card-title mt-8 mb-8">Detalle de frenadas</div>
      ${lote.frenadas.map(f => `
        <div class="cost-row">
          <span class="cost-label">🔴 ${f.hora} — ${f.motivo || "Sin motivo"}</span>
          <span class="cost-value">${f.duracion} min</span>
        </div>
      `).join("")}
    ` : ""}
  `;

  overlay.classList.add("open");
}

// ── Limpiar formulario ────────────────────────────────────
function limpiarFormProd() {
  if (!confirm("¿Limpiar el formulario de producción?")) return;
  document.querySelectorAll("#prod-form input").forEach(el => el.value = "");
  document.getElementById("frenadas-container").innerHTML = "";
  contadorFrenadas = 0;
  document.getElementById("resumen-lote")?.classList.add("hidden");

  const numLoteEl = document.getElementById("prod-numero-lote");
  if (numLoteEl) numLoteEl.value = generarNumeroLote();
  showToast("Formulario limpiado.", "info");
}
