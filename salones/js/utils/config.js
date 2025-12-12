// Configuración centralizada para reglas de validación y asignación
export const CONFIG = {
  // Reglas de validación configurables
  validaciones: {
    accesibilidad: {
      habilitado: true,
      pisoRequerido: 1, // Piso requerido para grupos con discapacidad
      mensaje: "ACCESIBILIDAD: El grupo {grupo} requiere un salón en primer piso"
    },
    capacidad: {
      habilitado: true,
      margenExceso: 0, // Margen de exceso permitido (0 = estricto)
      mensaje: "CAPACIDAD: El grupo excede la capacidad del salón. Alumnos: {alumnos}, Capacidad: {capacidad}"
    },
    prioridadPiso: {
      habilitado: true,
      reglas: [
        { semestres: [1, 2], pisoPreferido: 4, obligatorio: true },
        { semestres: [6, 7, 8], pisoMaximo: 2, obligatorio: true }
      ],
      mensaje: "PRIORIDAD_PISO: Los grupos de {semestre}° semestre deben asignarse al {piso} piso"
    },
    distanciaEdificios: {
      habilitado: true,
      edificioPreferido: 'F', // Preferir edificio F
      pesoDistancia: 0.1 // Peso en algoritmo de selección
    }
  },

  // Configuración de asignación
  asignacion: {
    maxReintentos: 3,
    permitirReubicacion: true,
    estrategiaFallback: 'consistente', // 'consistente' o 'flexible'
    logDetallado: true
  },

  // Configuración de edificios y pisos
  edificios: {
    F: { pisos: 4, salonesPorPiso: [4, 4, 4, 4] },
    E: { pisos: 4, salonesPorPiso: [6, 6, 6, 5] },
    D: { pisos: 4, salonesPorPiso: [6, 6, 6, 6] }
  },

  // Configuración de prioridades
  prioridades: {
    orden: ['prioritarios', 'semestre', 'tamano', 'dias'],
    semestre: { orden: 'ascendente' }, // ascendente = principiantes primero
    tamano: { orden: 'descendente' } // descendente = más grandes primero
  }
};

// Función para obtener configuración con valores por defecto
export function getConfig(path, defaultValue = null) {
  const keys = path.split('.');
  let current = CONFIG;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  return current;
}

// Función para actualizar configuración en runtime
export function setConfig(path, value) {
  const keys = path.split('.');
  let current = CONFIG;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}