// ============================================================
// utils.js — Utilidades compartidas
// Formateo, cálculos base, helpers de UI
// ============================================================

// ── Formateo de números ───────────────────────────────────

/**
 * Formatea un número como moneda argentina ($ 1.234,56)
 * @param {number} val
 * @param {number} decimals
 * @returns {string}
 */
export function formatCurrency(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return "$ " + Number(val).toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea un número con separadores de miles.
 * @param {number} val
 * @param {number} decimals
 * @returns {string}
 */
export function formatNum(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea como porcentaje (45,5%)
 * @param {number} val - valor 0-100
 * @param {number} decimals
 * @returns {string}
 */
export function formatPct(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toFixed(decimals) + "%";
}

/**
 * Formatea kg con una decimal (1.234,5 kg)
 * @param {number} val
 * @returns {string}
 */
export function formatKg(val) {
  return formatNum(val, 1) + " kg";
}


// ── Parseo de inputs ──────────────────────────────────────

/**
 * Lee el valor numérico de un input por ID.
 * Retorna 0 si el campo está vacío o el valor es inválido.
 * @param {string} id
 * @returns {number}
 */
export function getNumInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const val = parseFloat(el.value);
  return isNaN(val) ? 0 : val;
}

/**
 * Lee el valor de texto de un input por ID.
 * @param {string} id
 * @returns {string}
 */
export function getStrInput(id) {
  const el = document.getElementById(id);
  return el ? (el.value || "").trim() : "";
}

/**
 * Setea el valor de un elemento por ID.
 * @param {string} id
 * @param {string} val
 */
export function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}


// ── Cálculos de producción ────────────────────────────────

/**
 * Calcula kg de nuez limpia a partir de kg con cáscara y rendimiento %.
 * @param {number} kgCascara
 * @param {number} rendimientoPct - ej: 40
 * @returns {number}
 */
export function calcKgLimpio(kgCascara, rendimientoPct) {
  return kgCascara * (rendimientoPct / 100);
}

/**
 * Calcula los kg por variedad dado el kg limpio total y el % de cada variedad.
 * @param {number} kgLimpio
 * @param {Object} porcentajes - { v1: 15, v2: 10, ... }
 * @returns {Object} - { v1: 45.3, v2: ... }
 */
export function calcKgPorVariedad(kgLimpio, porcentajes) {
  const resultado = {};
  for (const [key, pct] of Object.entries(porcentajes)) {
    resultado[key] = kgLimpio * (pct / 100);
  }
  return resultado;
}

/**
 * Calcula la facturación por variedad.
 * @param {Object} kgVariedad
 * @param {Object} precios
 * @returns {Object}
 */
export function calcFacturacionVariedad(kgVariedad, precios) {
  const resultado = {};
  for (const [key, kg] of Object.entries(kgVariedad)) {
    resultado[key] = kg * (precios[key] || 0);
  }
  return resultado;
}

/**
 * Suma todos los valores de un objeto.
 * @param {Object} obj
 * @returns {number}
 */
export function sumObj(obj) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

/**
 * Calcula precio promedio ponderado del lote.
 * @param {number} facturacionTotal
 * @param {number} kgLimpio
 * @returns {number}
 */
export function calcPrecioPponderado(facturacionTotal, kgLimpio) {
  if (!kgLimpio) return 0;
  return facturacionTotal / kgLimpio;
}

/**
 * Calcula costo hora-hombre.
 * @param {number} sueldosMensuales
 * @param {number} horasDiarias
 * @param {number} diasMes
 * @returns {number} $/hora
 */
export function calcCostoHH(sueldosMensuales, horasDiarias, diasMes) {
  const horasMes = horasDiarias * diasMes;
  if (!horasMes) return 0;
  return sueldosMensuales / horasMes;
}

/**
 * Calcula las horas necesarias para procesar un lote.
 * @param {number} kgCascara
 * @param {number} kgMaquinaDia - capacidad de la máquina por día
 * @param {number} horasDiarias
 * @returns {number}
 */
export function calcHorasLote(kgCascara, kgMaquinaDia, horasDiarias) {
  if (!kgMaquinaDia || !horasDiarias) return 0;
  const dias = kgCascara / kgMaquinaDia;
  return dias * horasDiarias;
}

/**
 * Calcula el costo de producción del lote.
 * @param {Object} params
 * @returns {number}
 */
export function calcCostoProduccion({ sueldos, horasDiarias, diasMes, operarios, horasLote, cuotaMaquina }) {
  const costoHH  = calcCostoHH(sueldos, horasDiarias, diasMes);
  const costoMO  = costoHH * operarios * horasLote;

  // Costo máquina prorrateado: cuota mensual / horas mes * horas lote
  const horasMes = horasDiarias * diasMes;
  const costoMaq = horasMes > 0 ? (cuotaMaquina / horasMes) * horasLote : 0;

  return costoMO + costoMaq;
}

/**
 * Calcula el costo de packaging.
 * @param {number} kgLimpio
 * @param {number} precioBolsa - bolsa 5 kg
 * @param {number} precioCaja - caja 10 kg
 * @returns {number} costo total packaging estimado
 */
export function calcCostoPackaging(kgLimpio, precioBolsa, precioCaja) {
  // Asumimos mix 50% cajas, 50% bolsas (por defecto)
  const bolsas = Math.ceil((kgLimpio * 0.5) / 5);
  const cajas  = Math.ceil((kgLimpio * 0.5) / 10);
  return (bolsas * precioBolsa) + (cajas * precioCaja);
}

/**
 * Calcula el costo total del lote.
 * @param {Object} componentes
 * @returns {number}
 */
export function calcCostoTotal({
  compraMateriaPrima,   // kg × precio
  transporte,
  costoProduccion,
  packaging,
  transporteVenta
}) {
  return compraMateriaPrima + transporte + costoProduccion + packaging + transporteVenta;
}

/**
 * Calcula rentabilidad del lote.
 * @param {number} facturacion
 * @param {number} costoTotal
 * @returns {Object} { ganancia, margenPct, estado }
 */
export function calcRentabilidad(facturacion, costoTotal) {
  const ganancia  = facturacion - costoTotal;
  const margenPct = facturacion > 0 ? (ganancia / facturacion) * 100 : 0;

  let estado;
  if (margenPct >= 25)      estado = "excelente";
  else if (margenPct >= 10) estado = "aceptable";
  else                      estado = "no-rentable";

  return { ganancia, margenPct, estado };
}

/**
 * Calculadora inversa: precio máximo a pagar por kg con cáscara.
 * @param {number} precioVentaProm - precio promedio ponderado esperado
 * @param {number} margenDeseadoPct - margen deseado (0-100)
 * @param {number} rendimientoPct - rendimiento esperado del lote
 * @param {number} costosOperativosPorKgLimpio - resto de costos por kg limpio
 * @returns {number}
 */
export function calcPrecioMaximo(precioVentaProm, margenDeseadoPct, rendimientoPct, costosOperativosPorKgLimpio) {
  // Ingreso neto deseado por kg limpio
  const ingresoNeto = precioVentaProm * (1 - margenDeseadoPct / 100);
  // Margen disponible para materia prima por kg limpio
  const disponibleKgLimpio = ingresoNeto - costosOperativosPorKgLimpio;
  // Convertir a kg con cáscara usando el rendimiento
  const rendimiento = rendimientoPct / 100;
  if (!rendimiento) return 0;
  return disponibleKgLimpio * rendimiento;
}


// ── Eficiencia de producción ──────────────────────────────

/**
 * Calcula kg/hora real de un lote.
 * @param {number} kgProcesados
 * @param {number} horasEfectivas - horas totales menos tiempos muertos
 * @returns {number}
 */
export function calcKgHora(kgProcesados, horasEfectivas) {
  if (!horasEfectivas) return 0;
  return kgProcesados / horasEfectivas;
}

/**
 * Calcula eficiencia vs capacidad teórica.
 * @param {number} kgHoraReal
 * @param {number} kgMaquinaDia
 * @param {number} horasDiarias
 * @returns {number} porcentaje 0-100
 */
export function calcEficiencia(kgHoraReal, kgMaquinaDia, horasDiarias) {
  const kgHoraTeorico = horasDiarias > 0 ? kgMaquinaDia / horasDiarias : 0;
  if (!kgHoraTeorico) return 0;
  return Math.min((kgHoraReal / kgHoraTeorico) * 100, 100);
}


// ── UI helpers ────────────────────────────────────────────

/**
 * Muestra un toast/notificación.
 * @param {string} msg
 * @param {'success'|'error'|'info'} type
 */
export function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Genera un número de lote único basado en fecha y random.
 * @returns {string} ej: LOT-240315-4821
 */
export function generarNumeroLote() {
  const now = new Date();
  const fecha = now.toLocaleDateString("es-AR", { year: "2-digit", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `LOT-${fecha}-${rand}`;
}

/**
 * Formatea una fecha Firestore Timestamp o Date a string legible.
 * @param {*} fecha - Timestamp o Date
 * @returns {string}
 */
export function formatFecha(fecha) {
  if (!fecha) return "—";
  const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
}

/**
 * Calcula duración entre dos strings de tiempo HH:MM.
 * @param {string} inicio - "08:00"
 * @param {string} fin    - "17:30"
 * @returns {number} horas decimales
 */
export function calcHorasEntreTiempos(inicio, fin) {
  if (!inicio || !fin) return 0;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return minutos / 60;
}

/**
 * Lista de variedades con nombre y clave.
 */
export const VARIEDADES = [
  { key: "v1", nombre: "Mariposa Extra Light",   grupo: "Mariposa" },
  { key: "v2", nombre: "Mariposa Light",          grupo: "Mariposa" },
  { key: "v3", nombre: "Mariposa Ámbar",          grupo: "Mariposa" },
  { key: "v4", nombre: "Cuartos Extra Light",     grupo: "Cuartos" },
  { key: "v5", nombre: "Cuartos Light",           grupo: "Cuartos" },
  { key: "v6", nombre: "Cuartos Ámbar",           grupo: "Cuartos" },
  { key: "v7", nombre: "Cuartillos Extra Light",  grupo: "Cuartillos" },
  { key: "v8", nombre: "Cuartillos Light",        grupo: "Cuartillos" },
  { key: "v9", nombre: "Cuartillos Ámbar",        grupo: "Cuartillos" }
];

/** Colores asociados a cada variedad (CSS vars values) */
export const COLORES_VARIEDAD = {
  v1: "#f59e0b", v2: "#d97706", v3: "#92400e",
  v4: "#3b82f6", v5: "#1d4ed8", v6: "#1e3a8a",
  v7: "#10b981", v8: "#059669", v9: "#064e3b"
};
