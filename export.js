// ============================================================
// export.js — Exportación de datos a CSV y Excel (XLSX)
// Usa SheetJS (xlsx) para generar archivos Excel
// ============================================================

import { obtenerDatosExportacion } from "./db.js";
import { formatCurrency, formatFecha, formatPct, VARIEDADES } from "./utils.js";

/**
 * Exporta todos los lotes de producción a Excel (.xlsx).
 * Genera múltiples hojas: Lotes, Proveedores, Simulaciones.
 */
export async function exportarExcel() {
  try {
    const { lotes, proveedores, simulaciones } = await obtenerDatosExportacion();

    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Lotes de producción ──────────────────────
    const lotesData = [
      ["Lote", "Proveedor", "Fecha", "Kg Procesados", "Rend. Real %",
       "Kg Limpio", "Kg/hora", "Eficiencia %", "Costo Real $/kg limpio",
       "Facturación", "Costo Total", "Ganancia", "Margen %"]
    ];

    for (const l of lotes) {
      lotesData.push([
        l.numeroLote || l.id,
        l.proveedor || "",
        l.fecha || "",
        l.kgProcesados || 0,
        l.rendimientoReal || 0,
        l.kgLimpio || 0,
        l.kgHora || 0,
        l.eficiencia || 0,
        l.costoRealKgLimpio || 0,
        l.facturacionTotal || 0,
        l.costoTotal || 0,
        l.ganancia || 0,
        l.margenPct || 0
      ]);
    }

    const wsLotes = XLSX.utils.aoa_to_sheet(lotesData);
    _aplicarEstilosHoja(wsLotes, lotesData[0].length);
    XLSX.utils.book_append_sheet(wb, wsLotes, "Lotes");

    // ── Hoja 2: Proveedores ──────────────────────────────
    const provData = [
      ["Proveedor", "Total Lotes", "Rend. Prom. %", "% Mariposa Prom.",
       "Precio Pagado Prom. $/kg", "Costo Real Prom. $/kg limpio", "Última Compra"]
    ];

    for (const p of proveedores) {
      provData.push([
        p.nombre || "",
        p.totalLotes || 0,
        (p.rendimientoPromedio || 0).toFixed(1),
        (p.pctMariposaProm || 0).toFixed(1),
        (p.precioPagadoProm || 0).toFixed(2),
        (p.costoRealProm || 0).toFixed(2),
        p.ultimaCompra || ""
      ]);
    }

    const wsProveedores = XLSX.utils.aoa_to_sheet(provData);
    _aplicarEstilosHoja(wsProveedores, provData[0].length);
    XLSX.utils.book_append_sheet(wb, wsProveedores, "Proveedores");

    // ── Hoja 3: Simulaciones ─────────────────────────────
    const simData = [
      ["Fecha", "Kg Cáscara", "Precio $/kg", "Rendimiento %",
       "Facturación", "Costo Total", "Ganancia", "Margen %", "Estado"]
    ];

    for (const s of simulaciones) {
      simData.push([
        formatFecha(s.creadoEn),
        s.kgCascara || 0,
        s.precioCascara || 0,
        s.rendimientoPct || 0,
        s.facturacionTotal || 0,
        s.costoTotal || 0,
        s.ganancia || 0,
        (s.margenPct || 0).toFixed(1),
        s.estado || ""
      ]);
    }

    const wsSimulaciones = XLSX.utils.aoa_to_sheet(simData);
    _aplicarEstilosHoja(wsSimulaciones, simData[0].length);
    XLSX.utils.book_append_sheet(wb, wsSimulaciones, "Simulaciones");

    // ── Descargar archivo ────────────────────────────────
    const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
    XLSX.writeFile(wb, `NuezPro_Export_${fecha}.xlsx`);

    return true;
  } catch (error) {
    console.error("Error al exportar Excel:", error);
    throw error;
  }
}

/**
 * Exporta lotes como CSV simple.
 */
export async function exportarCSV() {
  try {
    const { lotes } = await obtenerDatosExportacion();

    const headers = [
      "Lote", "Proveedor", "Fecha", "Kg_Procesados", "Rendimiento_%",
      "Kg_Limpio", "Facturacion", "Costo_Total", "Ganancia", "Margen_%", "Estado"
    ];

    const rows = lotes.map(l => [
      l.numeroLote || l.id,
      l.proveedor || "",
      l.fecha || "",
      l.kgProcesados || 0,
      l.rendimientoReal || 0,
      l.kgLimpio || 0,
      l.facturacionTotal || 0,
      l.costoTotal || 0,
      l.ganancia || 0,
      (l.margenPct || 0).toFixed(1),
      l.estado || ""
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(_escaparCSV).join(","))
      .join("\n");

    _descargarArchivo(csv, "NuezPro_Lotes.csv", "text/csv");
    return true;
  } catch (error) {
    console.error("Error al exportar CSV:", error);
    throw error;
  }
}

/**
 * Exporta simulaciones como CSV.
 */
export async function exportarSimulacionesCSV() {
  try {
    const { simulaciones } = await obtenerDatosExportacion();

    const headers = [
      "Fecha", "Kg_Cascara", "Precio_kg", "Rendimiento_%",
      "Facturacion", "Costo_Total", "Ganancia", "Margen_%", "Estado"
    ];

    const rows = simulaciones.map(s => [
      formatFecha(s.creadoEn),
      s.kgCascara || 0,
      s.precioCascara || 0,
      s.rendimientoPct || 0,
      s.facturacionTotal || 0,
      s.costoTotal || 0,
      s.ganancia || 0,
      (s.margenPct || 0).toFixed(1),
      s.estado || ""
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(_escaparCSV).join(","))
      .join("\n");

    _descargarArchivo(csv, "NuezPro_Simulaciones.csv", "text/csv");
    return true;
  } catch (error) {
    console.error("Error al exportar simulaciones CSV:", error);
    throw error;
  }
}

// ── Helpers internos ──────────────────────────────────────

/** Escapa un valor para CSV */
function _escaparCSV(val) {
  const str = String(val === null || val === undefined ? "" : val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Descarga un archivo en el navegador */
function _descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob(["\uFEFF" + contenido], { type: tipo + ";charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Aplica ancho de columnas básico a una hoja XLSX */
function _aplicarEstilosHoja(ws, numCols) {
  const colWidths = [];
  for (let i = 0; i < numCols; i++) {
    colWidths.push({ wch: 18 });
  }
  ws["!cols"] = colWidths;
}
