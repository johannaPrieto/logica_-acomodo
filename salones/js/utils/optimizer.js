import { CONFIG } from './config.js';
import { logger } from './validators.js';
import Horario from '../models/Horario.js';

/**
 * Optimizador post-asignación para mejorar las asignaciones sin modificar Radix Sort
 * Se ejecuta después de la asignación inicial para optimizar uso de salones
 */
export class AssignmentOptimizer {
  constructor(sistema) {
    this.sistema = sistema;
    this.config = CONFIG.asignacion;
  }

  /**
   * Optimiza las asignaciones existentes
   */
  optimize() {
    logger.log('info', 'Iniciando optimización post-asignación');

    let mejoras = 0;
    const maxIteraciones = this.config.maxReintentos || 3;

    for (let iteracion = 0; iteracion < maxIteraciones; iteracion++) {
      logger.log('debug', `Iteración de optimización ${iteracion + 1}/${maxIteraciones}`);

      // 1. Reasignar grupos sin salón a slots disponibles
      const reasignados = this.reasignarGruposSinSalon();
      mejoras += reasignados;

      // 2. Optimización de capacidad deshabilitada para mantener consistencia de salones por grupo
      // const optimizados = this.optimizarCapacidad();
      // mejoras += optimizados;

      // 3. Consolidación deshabilitada para mantener consistencia de salones por grupo
      // const consolidados = this.consolidarAsignaciones();
      // mejoras += consolidados;

      if (mejoras === 0) {
        logger.log('debug', 'No se encontraron mejoras en esta iteración');
        break;
      }
    }

    logger.log('info', `Optimización completada. Mejoras realizadas: ${mejoras}`);
    return mejoras;
  }

  /**
   * Reasigna grupos que no tienen salón a slots disponibles
   */
  reasignarGruposSinSalon() {
    let reasignados = 0;
    const errores = [...this.sistema.errores];

    for (const error of errores) {
      if (error.grupoId && error.mensaje.includes('No se pudo asignar')) {
        const grupo = this.sistema.grupos.get(error.grupoId);
        if (!grupo) continue;

        // Buscar slot disponible para este grupo
        const salonDisponible = this.encontrarSlotDisponibleParaGrupo(grupo);
        if (salonDisponible) {
          // Asignar y remover error
          this.asignarGrupoASalon(grupo, salonDisponible);
          this.sistema.errores = this.sistema.errores.filter(e => e !== error);
          reasignados++;
          logger.log('info', `Reasignado grupo ${error.grupoId} a salón ${salonDisponible.id}`);
        }
      }
    }

    return reasignados;
  }

  /**
   * Optimiza el uso de capacidad moviendo grupos a salones más ajustados
   */
  optimizarCapacidad() {
    let optimizados = 0;

    for (const salon of this.sistema.salones) {
      if (!salon.grupoAsignadoFijo) continue;

      const grupoActual = this.sistema.grupos.get(salon.grupoAsignadoFijo);
      if (!grupoActual) continue;

      // Buscar salón mejor ajustado
      const salonMejor = this.encontrarSalonMejorAjuste(grupoActual, salon);
      if (salonMejor && salonMejor.id !== salon.id) {
        // Intercambiar asignaciones
        this.intercambiarAsignaciones(salon, salonMejor);
        optimizados++;
        logger.log('info', `Optimizada capacidad: grupo ${grupoActual.id} movido de ${salon.id} a ${salonMejor.id}`);
      }
    }

    return optimizados;
  }

  /**
   * Consolida asignaciones para reducir fragmentación y optimizar uso continuo
   */
  consolidarAsignaciones() {
    let consolidados = 0;

    for (const salon of this.sistema.salones) {
      if (!salon.asignacionesBloques || salon.asignacionesBloques.length === 0) continue;

      // Agrupar asignaciones por día
      const asignacionesPorDia = {};
      salon.asignacionesBloques.forEach(asig => {
        if (!asignacionesPorDia[asig.dia]) asignacionesPorDia[asig.dia] = [];
        asignacionesPorDia[asig.dia].push(asig);
      });

      // Para cada día, ordenar por hora de inicio
      for (const dia in asignacionesPorDia) {
        asignacionesPorDia[dia].sort((a, b) => a.horario.horaInicio.localeCompare(b.horario.horaInicio));

        // Buscar oportunidades de interturno (fin == inicio)
        for (let i = 0; i < asignacionesPorDia[dia].length - 1; i++) {
          const asigActual = asignacionesPorDia[dia][i];
          const asigSiguiente = asignacionesPorDia[dia][i + 1];

          // Si el actual termina exactamente cuando el siguiente inicia, ya está optimizado
          if (asigActual.horario.horaFin === asigSiguiente.horario.horaInicio) {
            // Ya está bien consolidado
            continue;
          }

          // Si hay un gap, buscar grupos que puedan llenarlo
          if (asigActual.horario.horaFin < asigSiguiente.horario.horaInicio) {
            const grupoInterturno = this.encontrarGrupoParaInterturno(dia, asigActual.horario.horaFin, asigSiguiente.horario.horaInicio);
            if (grupoInterturno) {
              // Asignar el grupo al salón en el slot interturno
              this.asignarGrupoAInterturno(grupoInterturno, salon, dia, asigActual.horario.horaFin, asigSiguiente.horario.horaInicio);
              consolidados++;
              logger.log('info', `Consolidado: grupo ${grupoInterturno.id} asignado a salón ${salon.id} el ${dia} de ${asigActual.horario.horaFin} a ${asigSiguiente.horario.horaInicio}`);
            }
          }
        }
      }
    }

    return consolidados;
  }

  /**
   * Encuentra un slot disponible para un grupo
   */
  encontrarSlotDisponibleParaGrupo(grupo) {
    for (const salon of this.sistema.salones) {
      if (salon.grupoAsignadoFijo) continue; // Ya asignado

      try {
        // Verificar si puede asignarse
        if (this.sistema.salonDisponibleParaTodasLasClases(salon, grupo)) {
          return salon;
        }
      } catch (error) {
        logger.log('debug', `Salón ${salon.id} no disponible para grupo ${grupo.id}: ${error.message}`);
      }
    }
    return null;
  }

  /**
   * Encuentra salón con mejor ajuste de capacidad
   */
  encontrarSalonMejorAjuste(grupo, salonActual) {
    let mejorSalon = null;
    let mejorAjuste = Math.abs(salonActual.capacidad - grupo.cantidadAlumnos);

    for (const salon of this.sistema.salones) {
      if (salon.grupoAsignadoFijo && salon.id !== salonActual.id) continue;

      const ajuste = Math.abs(salon.capacidad - grupo.cantidadAlumnos);
      if (ajuste < mejorAjuste) {
        try {
          if (this.sistema.salonDisponibleParaTodasLasClases(salon, grupo)) {
            mejorSalon = salon;
            mejorAjuste = ajuste;
          }
        } catch (error) {
          // Ignorar
        }
      }
    }

    return mejorSalon;
  }

  /**
   * Asigna un grupo a un salón
   */
  asignarGrupoASalon(grupo, salon) {
    this.sistema.reservarSalonParaGrupo(salon, grupo);
  }

  /**
   * Intercambia asignaciones entre dos salones
   */
  intercambiarAsignaciones(salon1, salon2) {
    const grupo1 = this.sistema.grupos.get(salon1.grupoAsignadoFijo);
    const grupo2 = salon2.grupoAsignadoFijo ? this.sistema.grupos.get(salon2.grupoAsignadoFijo) : null;

    // Liberar salones
    this.sistema.liberarSalonParaGrupo(salon1, salon1.grupoAsignadoFijo);
    if (grupo2) {
      this.sistema.liberarSalonParaGrupo(salon2, salon2.grupoAsignadoFijo);
    }

    // Reasignar
    this.sistema.reservarSalonParaGrupo(salon1, grupo2 || grupo1);
    if (grupo2) {
      this.sistema.reservarSalonParaGrupo(salon2, grupo1);
    }
  }

  /**
   * Encuentra un grupo que pueda ocupar un slot de interturno
   */
  encontrarGrupoParaInterturno(dia, horaInicio, horaFin) {
    let mejorGrupo = null;
    let mejorDiferencia = Infinity;

    // Buscar grupos no asignados que tengan clases compatibles con el slot
    for (const [idGrupo, grupo] of this.sistema.grupos) {
      if (grupo.salonAsignado) continue; // Ya asignado

      // Buscar clases del grupo en este día
      const clasesGrupoDia = [];
      for (const [clave, clases] of this.sistema.todasLasClasesPorGrupoDia.entries()) {
        if (clave === `${idGrupo}-${dia}`) {
          clasesGrupoDia.push(...clases);
        }
      }

      for (const clase of clasesGrupoDia) {
        // Verificar si la clase cabe en el slot (horaInicio a horaFin)
        if (clase.horaInicio >= horaInicio && clase.horaFin <= horaFin) {
          // Verificar que no haya otras clases del grupo que choquen
          const otrasClasesDia = clasesGrupoDia.filter(c => c !== clase);
          const choca = otrasClasesDia.some(otra =>
            !(otra.horaFin <= clase.horaInicio || otra.horaInicio >= clase.horaFin)
          );
          if (!choca) {
            // Calcular diferencia con la hora ideal (horaInicio)
            const diferencia = Math.abs(this.horaAMinutos(clase.horaInicio) - this.horaAMinutos(horaInicio));
            if (diferencia < mejorDiferencia) {
              mejorDiferencia = diferencia;
              mejorGrupo = { grupo, clase };
            }
          }
        }
      }
    }

    return mejorGrupo ? mejorGrupo.grupo : null;
  }

  /**
   * Convierte hora HH:MM a minutos
   */
  horaAMinutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Asigna un grupo a un slot de interturno en un salón
   */
  asignarGrupoAInterturno(grupo, salon, dia, horaInicio, horaFin) {
    // Encontrar la clase específica que se asignará
    let claseAsignar = null;
    const clasesGrupoDia = [];
    for (const [clave, clases] of this.sistema.todasLasClasesPorGrupoDia.entries()) {
      if (clave === `${grupo.id}-${dia}`) {
        clasesGrupoDia.push(...clases);
      }
    }

    // Buscar la clase que mejor encaje (más cercana a horaInicio)
    let mejorDiferencia = Infinity;
    for (const clase of clasesGrupoDia) {
      if (clase.horaInicio >= horaInicio && clase.horaFin <= horaFin) {
        const diferencia = Math.abs(this.horaAMinutos(clase.horaInicio) - this.horaAMinutos(horaInicio));
        if (diferencia < mejorDiferencia) {
          mejorDiferencia = diferencia;
          claseAsignar = clase;
        }
      }
    }

    if (!claseAsignar) return; // No se puede asignar

    // Crear horario para la clase
    const horarioClase = new Horario(claseAsignar.horaInicio, claseAsignar.horaFin);

    // Agregar asignación al salón
    if (!salon.asignacionesBloques) salon.asignacionesBloques = [];
    salon.asignacionesBloques.push({
      grupoId: grupo.id,
      dia,
      horario: horarioClase,
      bloque: 'Asignado'
    });

    // Marcar como asignado (si no estaba)
    grupo.salonAsignado = salon;

    // Remover de errores si estaba
    this.sistema.errores = this.sistema.errores.filter(e => !(e.clase && e.clase.grupoId === grupo.id));

    // Agregar a asignaciones del sistema
    this.sistema.asignaciones.push({
      clase: claseAsignar,
      salon,
      bloque: 'Asignado',
      mensaje: `Asignado: ${claseAsignar.nombreAsignatura} en ${salon.id}`
    });
  }
}

export default AssignmentOptimizer;