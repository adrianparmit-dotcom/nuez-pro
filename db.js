// ============================================================
// db.js — Capa de acceso a datos (Firestore)
// Centraliza todas las operaciones de lectura/escritura
// ============================================================

import {
  collection, doc, addDoc, setDoc, getDoc,
  getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db, COLLECTIONS } from "./firebase-config.js";

// ── Helpers internos ─────────────────────────────────────

/** Convierte un documento Firestore en objeto JS con id incluido */
const docToObj = (doc) => ({ id: doc.id, ...doc.data() });

/** Convierte QuerySnapshot en array de objetos */
const snapshotToArray = (snapshot) => snapshot.docs.map(docToObj);


// ── SIMULACIONES ─────────────────────────────────────────

/**
 * Guarda una simulación en Firestore.
 * @param {Object} simulacion - Datos completos de la simulación
 * @returns {string} ID del documento creado
 */
export async function guardarSimulacion(simulacion) {
  const ref = await addDoc(collection(db, COLLECTIONS.SIMULACIONES), {
    ...simulacion,
    creadoEn: serverTimestamp()
  });
  return ref.id;
}

/**
 * Obtiene todas las simulaciones, ordenadas por fecha desc.
 * @returns {Array} Lista de simulaciones
 */
export async function obtenerSimulaciones() {
  const q = query(
    collection(db, COLLECTIONS.SIMULACIONES),
    orderBy("creadoEn", "desc")
  );
  const snap = await getDocs(q);
  return snapshotToArray(snap);
}

/**
 * Elimina una simulación por ID.
 * @param {string} id
 */
export async function eliminarSimulacion(id) {
  await deleteDoc(doc(db, COLLECTIONS.SIMULACIONES, id));
}


// ── LOTES DE PRODUCCIÓN ───────────────────────────────────

/**
 * Registra un nuevo lote de producción real.
 * También actualiza las estadísticas del proveedor.
 * @param {Object} lote
 * @returns {string} ID del lote creado
 */
export async function registrarLote(lote) {
  // Guardar lote
  const ref = await addDoc(collection(db, COLLECTIONS.LOTES), {
    ...lote,
    creadoEn: serverTimestamp()
  });

  // Actualizar estadísticas del proveedor
  await actualizarEstadisticasProveedor(lote);

  return ref.id;
}

/**
 * Obtiene todos los lotes, ordenados por fecha desc.
 * @returns {Array}
 */
export async function obtenerLotes() {
  const q = query(
    collection(db, COLLECTIONS.LOTES),
    orderBy("creadoEn", "desc")
  );
  const snap = await getDocs(q);
  return snapshotToArray(snap);
}

/**
 * Obtiene un lote específico por ID.
 * @param {string} id
 * @returns {Object|null}
 */
export async function obtenerLote(id) {
  const ref = doc(db, COLLECTIONS.LOTES, id);
  const snap = await getDoc(ref);
  return snap.exists() ? docToObj(snap) : null;
}

/**
 * Obtiene lotes de un proveedor específico.
 * @param {string} proveedor
 * @returns {Array}
 */
export async function obtenerLotesPorProveedor(proveedor) {
  const q = query(
    collection(db, COLLECTIONS.LOTES),
    where("proveedor", "==", proveedor),
    orderBy("creadoEn", "desc")
  );
  const snap = await getDocs(q);
  return snapshotToArray(snap);
}

/**
 * Elimina un lote por ID.
 * @param {string} id
 */
export async function eliminarLote(id) {
  await deleteDoc(doc(db, COLLECTIONS.LOTES, id));
}


// ── PROVEEDORES ───────────────────────────────────────────

/**
 * Actualiza (o crea) el documento de estadísticas de un proveedor.
 * Recalcula promedios a partir de todos sus lotes.
 * @param {Object} nuevoLote
 */
async function actualizarEstadisticasProveedor(nuevoLote) {
  const { proveedor } = nuevoLote;
  if (!proveedor) return;

  // Obtener todos los lotes del proveedor (incluyendo el nuevo, que ya está guardado)
  const lotes = await obtenerLotesPorProveedor(proveedor);

  if (!lotes.length) return;

  // Calcular promedios
  const totalLotes = lotes.length;
  const promedios = lotes.reduce((acc, l) => {
    acc.rendimiento += (l.rendimientoReal || 0);
    acc.pctMariposa += (l.pctMariposaTotal || 0);
    acc.precioPagado += (l.precioCascara || 0);
    acc.costoRealKgLimpio += (l.costoRealKgLimpio || 0);
    return acc;
  }, { rendimiento: 0, pctMariposa: 0, precioPagado: 0, costoRealKgLimpio: 0 });

  const stats = {
    nombre:              proveedor,
    totalLotes:          totalLotes,
    rendimientoPromedio: promedios.rendimiento / totalLotes,
    pctMariposaProm:     promedios.pctMariposa / totalLotes,
    precioPagadoProm:    promedios.precioPagado / totalLotes,
    costoRealProm:       promedios.costoRealKgLimpio / totalLotes,
    ultimaCompra:        nuevoLote.fecha || null,
    actualizadoEn:       serverTimestamp()
  };

  // Usar nombre del proveedor como ID del documento
  const provRef = doc(db, COLLECTIONS.PROVEEDORES, proveedor.replace(/\s+/g, "_"));
  await setDoc(provRef, stats, { merge: true });
}

/**
 * Obtiene todos los proveedores con sus estadísticas.
 * @returns {Array}
 */
export async function obtenerProveedores() {
  const snap = await getDocs(collection(db, COLLECTIONS.PROVEEDORES));
  return snapshotToArray(snap);
}

/**
 * Obtiene un proveedor por nombre.
 * @param {string} nombre
 * @returns {Object|null}
 */
export async function obtenerProveedor(nombre) {
  const id = nombre.replace(/\s+/g, "_");
  const ref = doc(db, COLLECTIONS.PROVEEDORES, id);
  const snap = await getDoc(ref);
  return snap.exists() ? docToObj(snap) : null;
}

/**
 * Suscripción en tiempo real a la lista de proveedores.
 * @param {Function} callback - Se llama cada vez que cambia la colección
 * @returns {Function} Función para cancelar la suscripción
 */
export function suscribirProveedores(callback) {
  return onSnapshot(collection(db, COLLECTIONS.PROVEEDORES), (snap) => {
    callback(snapshotToArray(snap));
  });
}


// ── CONFIGURACIÓN GLOBAL ──────────────────────────────────

/**
 * Guarda (o sobreescribe) la configuración global de la empresa.
 * @param {Object} config
 */
export async function guardarConfig(config) {
  await setDoc(doc(db, COLLECTIONS.CONFIG, "empresa"), {
    ...config,
    actualizadoEn: serverTimestamp()
  });
}

/**
 * Obtiene la configuración global.
 * @returns {Object|null}
 */
export async function obtenerConfig() {
  const ref = doc(db, COLLECTIONS.CONFIG, "empresa");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}


// ── EXPORTACIÓN ───────────────────────────────────────────

/**
 * Retorna todos los datos necesarios para exportar a Excel/CSV.
 * @returns {Object} { lotes, proveedores, simulaciones }
 */
export async function obtenerDatosExportacion() {
  const [lotes, proveedores, simulaciones] = await Promise.all([
    obtenerLotes(),
    obtenerProveedores(),
    obtenerSimulaciones()
  ]);
  return { lotes, proveedores, simulaciones };
}
