// ============================================================
// proveedores.js — Módulo 4: Comparador de Proveedores
// Historial y comparación estadística por proveedor
// ============================================================

import {
  formatCurrency, formatPct, formatNum, formatFecha,
  showToast, VARIEDADES
} from "./utils.js";

import {
  obtenerProveedores, obtenerLotesPorProveedor, suscribirProveedores
} from "./db.js";

import { crearGraficoProveedores } from "./charts.js";

// ── Inicialización ────────────────────────────────────────
export function initProveedores() {
  // Suscripción en tiempo real
  const unsub = suscribirProveedores(_renderTablaProveedores);

  // Selector de campo para gráfico
  document.getElementById("select-campo-grafico")?.addEventListener("change", async () => {
    const proveedores = await obtenerProveedores();
    _renderGraficoComparacion(proveedores);
  });

  // Búsqueda de proveedor
  document.getElementById("btn-ver-proveedor")?.addEventListener("click", verDetalleProveedor);

  // Limpieza al cerrar página (evitar memory leak)
  window.addEventListener("unload", unsub);
}

// ── Tabla principal de proveedores ────────────────────────
function _renderTablaProveedores(proveedores) {
  const tbody = document.getElementById("tbody-proveedores");
  if (!tbody) return;

  if (!proveedores.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding:48px">
          <div class="empty-state">
            <div class="empty-state-icon">🏭</div>
            <p>No hay proveedores con datos registrados todavía.<br>
            Registrá lotes de producción real para ver estadísticas.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Ordenar por rendimiento promedio descendente
  const ordenados = [...proveedores].sort((a, b) =>
    (b.rendimientoPromedio || 0) - (a.rendimientoPromedio || 0)
  );

  tbody.innerHTML = ordenados.map((p, idx) => {
    const rankClass = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : "rank-3";
    const rend      = p.rendimientoPromedio || 0;
    const rendColor = rend >= 45 ? "text-green" : rend >= 38 ? "text-yellow" : "text-red";

    return `
      <tr>
        <td>
          <div class="flex-center gap-8">
            <span class="provider-rank ${idx < 3 ? rankClass : 'rank-3'}">${idx + 1}</span>
            <strong>${p.nombre || p.id}</strong>
          </div>
        </td>
        <td class="text-center mono">${p.totalLotes || 0}</td>
        <td class="mono ${rendColor} text-center">
          ${formatPct(rend)}
        </td>
        <td class="mono text-center">${formatPct(p.pctMariposaProm)}</td>
        <td class="mono text-center">${formatCurrency(p.precioPagadoProm)}</td>
        <td class="mono text-center">${formatCurrency(p.costoRealProm)}</td>
        <td class="text-muted text-xs text-center">${p.ultimaCompra || "—"}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="window._verDetProv('${p.nombre || p.id}')">
            Ver detalle
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Exponer función global
  window._verDetProv = (nombre) => _abrirModalProveedor(nombre, proveedores);

  // Actualizar gráfico
  _renderGraficoComparacion(ordenados);

  // Actualizar tarjetas resumen
  _renderResumenProveedores(ordenados);
}

// ── Gráfico de comparación ────────────────────────────────
function _renderGraficoComparacion(proveedores) {
  if (!proveedores.length) return;

  const campo = document.getElementById("select-campo-grafico")?.value || "rendimientoPromedio";
  crearGraficoProveedores("chart-proveedores", proveedores, campo);
}

// ── Tarjetas resumen ──────────────────────────────────────
function _renderResumenProveedores(proveedores) {
  if (!proveedores.length) return;

  // Mejor rendimiento
  const mejorRend = proveedores.reduce((best, p) =>
    (p.rendimientoPromedio > (best.rendimientoPromedio || 0)) ? p : best, proveedores[0]);

  // Mejor precio (más bajo)
  const mejorPrecio = proveedores.reduce((best, p) =>
    ((p.precioPagadoProm || Infinity) < (best.precioPagadoProm || Infinity)) ? p : best, proveedores[0]);

  // Total lotes
  const totalLotes = proveedores.reduce((acc, p) => acc + (p.totalLotes || 0), 0);

  const elMejorRend   = document.getElementById("stat-mejor-rend");
  const elMejorPrecio = document.getElementById("stat-mejor-precio");
  const elTotalLotes  = document.getElementById("stat-total-lotes");
  const elTotalProvs  = document.getElementById("stat-total-provs");

  if (elMejorRend)   elMejorRend.textContent   = `${mejorRend.nombre} (${formatPct(mejorRend.rendimientoPromedio)})`;
  if (elMejorPrecio) elMejorPrecio.textContent = `${mejorPrecio.nombre} (${formatCurrency(mejorPrecio.precioPagadoProm)})`;
  if (elTotalLotes)  elTotalLotes.textContent  = totalLotes;
  if (elTotalProvs)  elTotalProvs.textContent  = proveedores.length;
}

// ── Modal de detalle de proveedor ─────────────────────────
async function _abrirModalProveedor(nombre, proveedores) {
  const proveedor = proveedores.find(p => (p.nombre || p.id) === nombre);
  if (!proveedor) return;

  const overlay = document.getElementById("modal-proveedor");
  if (!overlay) return;

  const title = overlay.querySelector(".modal-title");
  const body  = overlay.querySelector(".modal-body");
  if (!title || !body) return;

  title.textContent = `Proveedor: ${proveedor.nombre}`;

  // Cargar lotes de este proveedor
  let lotes = [];
  try {
    lotes = await obtenerLotesPorProveedor(nombre);
  } catch (err) {
    console.error("Error al cargar lotes del proveedor:", err);
  }

  body.innerHTML = `
    <!-- Métricas resumen -->
    <div class="grid-3 mb-16">
      <div class="metric-card">
        <div class="metric-label">Rendimiento prom.</div>
        <div class="metric-value">${formatPct(proveedor.rendimientoPromedio)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">% Mariposa prom.</div>
        <div class="metric-value">${formatPct(proveedor.pctMariposaProm)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total lotes</div>
        <div class="metric-value">${proveedor.totalLotes}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Precio pagado prom.</div>
        <div class="metric-value">${formatCurrency(proveedor.precioPagadoProm)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Costo real prom. $/kg limpio</div>
        <div class="metric-value">${formatCurrency(proveedor.costoRealProm)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Última compra</div>
        <div class="metric-value text-sm">${proveedor.ultimaCompra || "—"}</div>
      </div>
    </div>

    <!-- Historial de lotes -->
    <div class="card-title mb-8">Historial de lotes</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Lote</th>
            <th>Fecha</th>
            <th>Kg procesados</th>
            <th>Rend. %</th>
            <th>Kg/hora</th>
            <th>Facturación</th>
          </tr>
        </thead>
        <tbody>
          ${lotes.length ? lotes.map(l => `
            <tr>
              <td class="mono text-accent">${l.numeroLote || l.id?.substring(0,8)}</td>
              <td class="text-muted">${l.fecha || "—"}</td>
              <td class="mono">${formatNum(l.kgProcesados, 0)} kg</td>
              <td class="mono ${l.rendimientoReal >= 40 ? 'text-green' : 'text-yellow'}">
                ${formatPct(l.rendimientoReal)}
              </td>
              <td class="mono">${formatNum(l.kgHora, 1)}</td>
              <td class="mono text-accent">${formatCurrency(l.facturacionTotal)}</td>
            </tr>
          `).join("") : `
            <tr>
              <td colspan="6" class="text-center text-muted" style="padding:16px">
                No hay lotes registrados para este proveedor
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  overlay.classList.add("open");
}

// ── Búsqueda manual de proveedor ─────────────────────────
async function verDetalleProveedor() {
  const nombre = document.getElementById("input-buscar-prov")?.value?.trim();
  if (!nombre) {
    showToast("Ingresá el nombre del proveedor.", "error");
    return;
  }

  const proveedores = await obtenerProveedores();
  const match = proveedores.find(p =>
    (p.nombre || p.id || "").toLowerCase().includes(nombre.toLowerCase())
  );

  if (!match) {
    showToast(`No se encontró el proveedor "${nombre}".`, "error");
    return;
  }

  _abrirModalProveedor(match.nombre || match.id, proveedores);
}
