import { CONFIG } from './config.js';

/**
 * Selector inteligente de salones con múltiples criterios de optimización
 */
export class SalonSelector {
  constructor(salones) {
    this.salones = salones;
    this.config = CONFIG.validaciones;
  }

  /**
   * Selecciona el mejor salón para un grupo de candidatos válidos
   * @param {Array} salonesCandidatos - Salones que pasan validaciones básicas
   * @param {Grupo} grupo - Grupo a asignar
   * @returns {Salon} Mejor salón seleccionado
   */
  seleccionarMejorSalon(salonesCandidatos, grupo) {
    if (salonesCandidatos.length === 0) return null;
    if (salonesCandidatos.length === 1) return salonesCandidatos[0];

    // Aplicar criterios de selección en orden de prioridad
    let candidatos = [...salonesCandidatos];

    // 1. Capacidad óptima
    candidatos = this.ordenarPorCapacidad(candidatos, grupo);

    // 2. Accesibilidad
    candidatos = this.ordenarPorAccesibilidad(candidatos, grupo);

    // 3. Distancia entre edificios
    candidatos = this.ordenarPorDistanciaEdificios(candidatos, grupo);

    // 4. Piso preferido
    candidatos = this.ordenarPorPisoPreferido(candidatos, grupo);

    // 5. Carga actual (menos ocupado)
    candidatos = this.ordenarPorCargaActual(candidatos);

    return candidatos[0];
  }

  /**
   * Ordena por ajuste de capacidad (mejor ajuste primero)
   */
  ordenarPorCapacidad(candidatos, grupo) {
    return candidatos.sort((a, b) => {
      const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
      const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);
      return ajusteA - ajusteB;
    });
  }

  /**
   * Prioriza salones accesibles si el grupo lo requiere
   */
  ordenarPorAccesibilidad(candidatos, grupo) {
    if (!this.config.accesibilidad.habilitado || !grupo.tieneDiscapacidad) {
      return candidatos;
    }

    return candidatos.sort((a, b) => {
      const aAccesible = a.piso === this.config.accesibilidad.pisoRequerido ? 1 : 0;
      const bAccesible = b.piso === this.config.accesibilidad.pisoRequerido ? 1 : 0;
      return bAccesible - aAccesible; // Accesibles primero
    });
  }

  /**
   * Ordena por preferencia de edificio (minimizar distancia)
   */
  ordenarPorDistanciaEdificios(candidatos, grupo) {
    if (!this.config.distanciaEdificios.habilitado) {
      return candidatos;
    }

    const edificioPreferido = this.config.distanciaEdificios.edificioPreferido;
    return candidatos.sort((a, b) => {
      const aPreferido = a.edificio === edificioPreferido ? 1 : 0;
      const bPreferido = b.edificio === edificioPreferido ? 1 : 0;
      return bPreferido - aPreferido;
    });
  }

  /**
   * Ordena por piso preferido según semestre
   */
  ordenarPorPisoPreferido(candidatos, grupo) {
    if (!this.config.prioridadPiso.habilitado) {
      return candidatos;
    }

    const regla = this.config.prioridadPiso.reglas.find(r => r.semestres.includes(grupo.semestre));
    if (!regla) return candidatos;

    return candidatos.sort((a, b) => {
      let scoreA = 0, scoreB = 0;

      if (regla.pisoPreferido) {
        scoreA += a.piso === regla.pisoPreferido ? 10 : 0;
        scoreB += b.piso === regla.pisoPreferido ? 10 : 0;
      }

      if (regla.pisoMaximo) {
        scoreA += a.piso <= regla.pisoMaximo ? 5 : 0;
        scoreB += b.piso <= regla.pisoMaximo ? 5 : 0;
      }

      return scoreB - scoreA;
    });
  }

  /**
   * Ordena por carga actual (menos asignaciones primero)
   */
  ordenarPorCargaActual(candidatos) {
    return candidatos.sort((a, b) => {
      const cargaA = a.asignacionesBloques ? a.asignacionesBloques.length : 0;
      const cargaB = b.asignacionesBloques ? b.asignacionesBloques.length : 0;
      return cargaA - cargaB; // Menos carga primero
    });
  }

  /**
   * Calcula puntuación global para un salón
   */
  calcularPuntuacion(salon, grupo) {
    let puntuacion = 0;

    // Capacidad
    const ajusteCapacidad = Math.abs(salon.capacidad - grupo.cantidadAlumnos);
    puntuacion += Math.max(0, 100 - ajusteCapacidad);

    // Accesibilidad
    if (this.config.accesibilidad.habilitado && grupo.tieneDiscapacidad) {
      puntuacion += salon.piso === this.config.accesibilidad.pisoRequerido ? 50 : 0;
    }

    // Distancia
    if (this.config.distanciaEdificios.habilitado) {
      puntuacion += salon.edificio === this.config.distanciaEdificios.edificioPreferido ? 20 : 0;
    }

    // Piso preferido
    const reglaPiso = this.config.prioridadPiso.reglas.find(r => r.semestres.includes(grupo.semestre));
    if (reglaPiso) {
      if (reglaPiso.pisoPreferido && salon.piso === reglaPiso.pisoPreferido) puntuacion += 30;
      if (reglaPiso.pisoMaximo && salon.piso <= reglaPiso.pisoMaximo) puntuacion += 15;
    }

    // Carga
    const carga = salon.asignacionesBloques ? salon.asignacionesBloques.length : 0;
    puntuacion += Math.max(0, 50 - carga * 5);

    return puntuacion;
  }
}

export default SalonSelector;