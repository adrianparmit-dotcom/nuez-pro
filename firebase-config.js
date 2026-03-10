// ============================================================
// firebase-config.js — Configuración de Firebase
// ⚠️  REEMPLAZAR con las credenciales de tu proyecto Firebase
// ============================================================

// Importar Firebase (CDN modular v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Configuración del proyecto Firebase.
 * Para obtener estos valores:
 * 1. Ir a https://console.firebase.google.com
 * 2. Crear proyecto (o usar uno existente)
 * 3. Configuración del proyecto → Agregar app web
 * 4. Copiar el objeto firebaseConfig
 */
const firebaseConfig = {
  apiKey:            "AIzaSyA4Ck2SIyuCvSHVR7PaJsLdAnsNCids8RM",
  authDomain:        "nuez-pro.firebaseapp.com",
  databaseURL:       "https://nuez-pro-default-rtdb.firebaseio.com",
  projectId:         "nuez-pro",
  storageBucket:     "nuez-pro.firebasestorage.app",
  messagingSenderId: "439083026648",
  appId:             "1:439083026648:web:517dcb1c8725e67f40efad"
};

// Inicializar app Firebase
const app = initializeApp(firebaseConfig);

// Exportar instancia de Firestore
export const db = getFirestore(app);

// Nombres de colecciones
export const COLLECTIONS = {
  SIMULACIONES: "simulaciones",   // Simulaciones de compra guardadas
  LOTES:        "lotes",          // Producción real registrada
  PROVEEDORES:  "proveedores",    // Resumen histórico por proveedor
  CONFIG:       "config"          // Parámetros globales (precios base, etc.)
};
