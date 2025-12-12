import Horario from '../models/Horario.js';
import { ERRORES } from '../utils/validators.js';
import AssignmentOptimizer from '../utils/optimizer.js';

class AsignadorAutomatico {
  constructor(sistema, gruposPrioritarios = []) {
    this.sistema = sistema;
    this.gruposPrioritarios = Array.isArray(gruposPrioritarios) ? gruposPrioritarios : [gruposPrioritarios].filter(g => g);
    this.gruposDivididos = new Map(); // Track divided groups: grupoId -> {salones: [salon1, salon2], dias: {salon1: [dias], salon2: [dias]}}
  }

  // Asignar salones por grupo, cada grupo conserva el mismo salón durante la semana
  asignarSalones() {
    console.log("Iniciando asignación de salones por grupo...");
    console.log(`Total de clases a asignar: ${this.sistema.clases.length}`);

    // Obtener grupos únicos ordenados por prioridad
    const gruposUnicos = this.obtenerGruposOrdenadosPorPrioridad();
    console.log(`Grupos únicos ordenados: ${gruposUnicos.join(', ')}`);

    // Asignar por cada grupo
    for (const grupoId of gruposUnicos) {
      const grupo = this.sistema.grupos.get(grupoId);

      console.log(`Asignando salón para grupo ${grupoId}`);

      try {
        // Calcular horarios ocupados por el grupo (solo clases presenciales)
        const horariosOcupados = this.calcularHorariosOcupadosPorGrupo(grupoId);

        if (horariosOcupados.length === 0) {
          console.log(`Grupo ${grupoId} no tiene clases presenciales`);
          continue;
        }

        // First, check exhaustively if any single classroom can accommodate the entire week
        let salon = this.buscarSalonDisponibleParaHorarios(grupo, horariosOcupados);

        if (salon) {
          console.log(`Asignando salón ${salon.id} al grupo ${grupoId} para toda la semana`);
          this.asignarSalonAGrupo(grupo, salon, horariosOcupados);
        } else {
          console.log(`No hay salón disponible para toda la semana para grupo ${grupoId}, verificando exhaustivamente antes de dividir`);

          // Exhaustive check: try all available classrooms for the entire week
          const salonExhaustivo = this.buscarSalonExhaustivoParaSemanaCompleta(grupo, horariosOcupados);

          if (salonExhaustivo) {
            console.log(`Encontrado salón ${salonExhaustivo.id} tras búsqueda exhaustiva para grupo ${grupoId}`);
            this.asignarSalonAGrupo(grupo, salonExhaustivo, horariosOcupados);
          } else {
            console.log(`Confirmado: no hay salón disponible para toda la semana para grupo ${grupoId}, intentando dividir en dos salones`);
            // Intentar dividir el grupo en dos salones
            const asignacionDividida = this.intentarAsignacionDividida(grupo, horariosOcupados);

            if (asignacionDividida) {
              console.log(`Grupo ${grupoId} dividido exitosamente en dos salones`);
            } else {
              console.log(`No se pudo asignar salón para grupo ${grupoId} ni dividido`);
              // Registrar error para todas las clases del grupo
              const clasesGrupo = this.sistema.clases.filter(c => c.grupoId === grupoId);
              clasesGrupo.forEach(clase => {
                this.sistema.errores.push({
                  clase,
                  mensaje: `No hay salones disponibles para el grupo`
                });
              });
            }
          }
        }

      } catch (error) {
        console.error(`Error al asignar salón para grupo ${grupoId}:`, error.message);
        const clasesGrupo = this.sistema.clases.filter(c => c.grupoId === grupoId);
        clasesGrupo.forEach(clase => {
          this.sistema.errores.push({
            clase,
            mensaje: error.message
          });
        });
      }
    }

    // Asignar salones a clases de laboratorio
    this.asignarSalonesALaboratorios();

    // Agregar clases de laboratorio a asignaciones (ya asignadas arriba)
    this.sistema.clasesLaboratorio.forEach(item => {
      // Ya se agregaron en asignarSalonesALaboratorios
    });

    // Ajuste especial para grupos de mañana asignados en pisos altos
    this.ajustarGruposMananaAPisoBajo();

    // Optimización post-asignación
    console.log("Ejecutando optimización post-asignación...");
    const optimizer = new AssignmentOptimizer(this.sistema);
    const mejoras = optimizer.optimize();

    console.log("Asignación de salones por grupo completada");
    console.log(`Total de asignaciones: ${this.sistema.asignaciones.length}`);
    console.log(`Total de errores: ${this.sistema.errores.length}`);
    console.log(`Grupos divididos en dos salones: ${this.gruposDivididos.size}`);
    console.log(`Mejoras realizadas en optimización: ${mejoras}`);

    // Mostrar mensaje final sobre grupos divididos
    if (this.gruposDivididos.size > 0) {
      console.log("=== GRUPOS DIVIDIDOS EN DOS SALONES ===");
      for (const [grupoId, info] of this.gruposDivididos) {
        const salon1 = info.salones[0].id;
        const salon2 = info.salones[1].id;
        const dias1 = info.dias[salon1].join(', ');
        const dias2 = info.dias[salon2].join(', ');
        console.log(`Grupo ${grupoId}: ${salon1} (${dias1}) / ${salon2} (${dias2})`);
      }
    }
  }

  // Salones cerca del elevador (1er piso - todos los del piso 1)
  get salonesCercaElevador() {
    // Todos los salones del piso 1 están cerca del elevador
    return this.sistema.salones.filter(salon => salon.piso === 1);
  }

  // Verificar si un grupo tiene horario temprano (7:00, 8:00 o 9:00 a.m.)
  grupoTieneHorarioTemprano(grupoId) {
    const clasesGrupo = this.sistema.clases.filter(c => c.grupoId === grupoId);
    const horasTempranas = ['07:00', '08:00', '09:00'];

    return clasesGrupo.some(clase => horasTempranas.includes(clase.horaInicio));
  }

  // Obtener grupos ordenados por prioridad para asignación
  obtenerGruposOrdenadosPorPrioridad() {
    const gruposUnicos = Array.from(new Set(this.sistema.clases.map(clase => clase.grupoId)));

    // Ordenar grupos por prioridad: mañana primero, luego prioritarios, luego restantes
    return gruposUnicos.sort((a, b) => {
      const grupoA = this.sistema.grupos.get(a);
      const grupoB = this.sistema.grupos.get(b);

      // 1. Grupos con horario temprano (7:00, 8:00, 9:00 a.m.) primero - prioridad absoluta
      const aTemprano = this.grupoTieneHorarioTemprano(a);
      const bTemprano = this.grupoTieneHorarioTemprano(b);
      if (aTemprano && !bTemprano) return -1;
      if (!aTemprano && bTemprano) return 1;

      // 2. Grupos prioritarios después de los de mañana
      const aEsPrioritario = this.gruposPrioritarios.includes(a);
      const bEsPrioritario = this.gruposPrioritarios.includes(b);
      if (aEsPrioritario && !bEsPrioritario) return -1;
      if (!aEsPrioritario && bEsPrioritario) return 1;

      // 3. Semestre más bajo primero (principiante) para el resto
      if (grupoA && grupoB && grupoA.semestre !== grupoB.semestre) {
        return grupoA.semestre - grupoB.semestre;
      }

      // 4. Grupos más grandes primero (mejor aprovechamiento de salones)
      if (grupoA && grupoB) {
        return grupoB.cantidadAlumnos - grupoA.cantidadAlumnos;
      }

      // 5. Orden alfabético como tiebreaker
      return a.localeCompare(b);
    });
  }

  // Calcular horarios ocupados por un grupo (union de clases presenciales)
  calcularHorariosOcupadosPorGrupo(grupoId) {
    const clasesPresenciales = this.sistema.clases.filter(c => c.grupoId === grupoId);
    const horariosOcupados = [];

    clasesPresenciales.forEach(clase => {
      horariosOcupados.push({
        dia: clase.diaSemana,
        horario: new Horario(clase.horaInicio, clase.horaFin)
      });
    });

    return horariosOcupados;
  }

  // Buscar salón disponible para todos los horarios de un grupo
  buscarSalonDisponibleParaHorarios(grupo, horariosOcupados) {
    // Filtrar salones que cumplan con las condiciones básicas
    let salonesCandidatos = this.sistema.salones.filter(salon => {
      try {
        // Verificar que el salón esté disponible en TODOS los horarios necesarios
        for (const horarioInfo of horariosOcupados) {
          if (!this.salonDisponibleEnBloque(salon, grupo, horarioInfo.horario, horarioInfo.dia)) {
            return false;
          }
        }
        return true;
      } catch (error) {
        return false;
      }
    });

    // Si no hay salones candidatos, retornar null
    if (salonesCandidatos.length === 0) {
      return null;
    }

    // Si este grupo es prioritario, OBLIGATORIAMENTE usar solo salones cerca del elevador
    if (this.gruposPrioritarios.includes(grupo.id)) {
      const salonesElevadorDisponibles = salonesCandidatos.filter(salon =>
        this.salonesCercaElevador.some(salonElevador => salonElevador.id === salon.id)
      );

      if (salonesElevadorDisponibles.length > 0) {
        // Usar ÚNICAMENTE salones cerca del elevador para grupos prioritarios
        salonesCandidatos = salonesElevadorDisponibles;
      } else {
        // Si no hay salones cerca del elevador disponibles para grupo prioritario, no asignar
        console.warn(`Grupo prioritario ${grupo.id} no pudo asignarse: no hay salones disponibles cerca del elevador`);
        return null;
      }
    }

    // Algoritmo mejorado de selección de salón
    // 1. Priorizar salones libres (sin grupo asignado fijo) sobre salones ya asignados
    salonesCandidatos.sort((a, b) => {
      const aLibre = !a.grupoAsignadoFijo;
      const bLibre = !b.grupoAsignadoFijo;

      if (aLibre && !bLibre) return -1;
      if (!aLibre && bLibre) return 1;
      return 0; // Ambos libres o ambos asignados
    });

    // 2. Para salones con mismo estado (libre/asignado), priorizar mejor ajuste de capacidad
    salonesCandidatos.sort((a, b) => {
      const aLibre = !a.grupoAsignadoFijo;
      const bLibre = !b.grupoAsignadoFijo;

      if (aLibre === bLibre) {
        const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
        const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);
        return ajusteA - ajusteB; // Mejor ajuste primero
      }
      return 0; // Mantener orden anterior
    });

    // 3. Para salones con mismo ajuste, preferir piso más bajo (más accesible)
    salonesCandidatos.sort((a, b) => {
      const aLibre = !a.grupoAsignadoFijo;
      const bLibre = !b.grupoAsignadoFijo;
      const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
      const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);

      if (aLibre === bLibre && ajusteA === ajusteB) {
        return a.piso - b.piso; // Piso más bajo primero
      }
      return 0; // Mantener orden anterior
    });

    // Retornar el mejor salón candidato
    return salonesCandidatos[0];
  }

  // Buscar salón disponible para una clase específica
  buscarSalonDisponibleParaClase(clase, grupo, horario) {
    // Filtrar salones que cumplan con las condiciones básicas
    let salonesCandidatos = this.sistema.salones.filter(salon => {
      try {
        // Verificar que el salón esté disponible en el horario de la clase
        return this.salonDisponibleEnBloque(salon, grupo, horario, clase.diaSemana);
      } catch (error) {
        return false;
      }
    });

    // Si no hay salones candidatos, retornar null
    if (salonesCandidatos.length === 0) {
      return null;
    }

    // Si este grupo es prioritario, OBLIGATORIAMENTE usar solo salones cerca del elevador
    if (this.gruposPrioritarios.includes(grupo.id)) {
      const salonesElevadorDisponibles = salonesCandidatos.filter(salon =>
        this.salonesCercaElevador.some(salonElevador => salonElevador.id === salon.id)
      );

      if (salonesElevadorDisponibles.length > 0) {
        // Usar ÚNICAMENTE salones cerca del elevador para grupos prioritarios
        salonesCandidatos = salonesElevadorDisponibles;
      } else {
        // Si no hay salones cerca del elevador disponibles para grupo prioritario, no asignar
        console.warn(`Grupo prioritario ${grupo.id} no pudo asignarse: no hay salones disponibles cerca del elevador`);
        return null;
      }
    }

    // Algoritmo mejorado de selección de salón
    // 1. Priorizar salones libres (sin grupo asignado fijo) sobre salones ya asignados
    salonesCandidatos.sort((a, b) => {
      const aLibre = !a.grupoAsignadoFijo;
      const bLibre = !b.grupoAsignadoFijo;

      if (aLibre && !bLibre) return -1;
      if (!aLibre && bLibre) return 1;
      return 0; // Ambos libres o ambos asignados
    });

    // 2. Para salones con mismo estado (libre/asignado), priorizar mejor ajuste de capacidad
    salonesCandidatos.sort((a, b) => {
      const aLibre = !a.grupoAsignadoFijo;
      const bLibre = !b.grupoAsignadoFijo;

      if (aLibre === bLibre) {
        const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
        const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);
        return ajusteA - ajusteB; // Mejor ajuste primero
      }
      return 0; // Mantener orden anterior
    });

    // 3. Para salones con mismo ajuste, preferir piso más bajo (más accesible)
    salonesCandidatos.sort((a, b) => {
      const aLibre = !a.grupoAsignadoFijo;
      const bLibre = !b.grupoAsignadoFijo;
      const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
      const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);

      if (aLibre === bLibre && ajusteA === ajusteB) {
        return a.piso - b.piso; // Piso más bajo primero
      }
      return 0; // Mantener orden anterior
    });

    // Retornar el mejor salón candidato
    return salonesCandidatos[0];
  }


  // Asignar salón a un grupo para todos sus horarios
  asignarSalonAGrupo(grupo, salon, horariosOcupados, esAsignacionCompleta = true) {
    // Filtrar clases que corresponden a estos horarios
    const diasHorarios = new Set(horariosOcupados.map(h => h.dia));
    const clasesGrupo = this.sistema.clases.filter(c => c.grupoId === grupo.id && diasHorarios.has(c.diaSemana));

    clasesGrupo.forEach(clase => {
      // Verificar que la clase está en los horarios ocupados
      const horarioClase = horariosOcupados.find(h => h.dia === clase.diaSemana &&
        h.horario.horaInicio === clase.horaInicio && h.horario.horaFin === clase.horaFin);
      if (horarioClase) {
        // Actualizar el salón de la clase
        clase.salonActual = salon.id;
        clase.edificioActual = salon.edificio;

        // Registrar la asignación
        this.sistema.asignaciones.push({
          clase,
          salon,
          bloque: 'Horario Específico',
          mensaje: `Asignado: ${clase.nombreAsignatura} en ${salon.id} (${clase.horaInicio}-${clase.horaFin})`
        });
      }
    });

    // Ocupar el salón durante todos los horarios del grupo
    horariosOcupados.forEach(horarioInfo => {
      salon.ocupar(horarioInfo.dia, horarioInfo.horario, grupo.id);
      console.log(`Salón ${salon.id} ocupado el ${horarioInfo.dia} de ${horarioInfo.horario.horaInicio} a ${horarioInfo.horario.horaFin}`);
    });

    // Marcar este salón como asignación fija para el grupo solo si es asignación completa
    if (esAsignacionCompleta) {
      salon.grupoAsignadoFijo = grupo.id;
    }
  }


  // Asignar salones a clases de laboratorio
  asignarSalonesALaboratorios() {
    console.log("Procesando clases de laboratorio (no requieren asignación de salón físico)...");

    this.sistema.clasesLaboratorio.forEach(item => {
      const clase = item.clase;

      // Las clases de laboratorio no requieren salón físico - son virtuales o se imparten en laboratorios especializados
      // Solo registrar que son clases de laboratorio y no requieren asignación
      clase.salonActual = 'Laboratorio';
      clase.edificioActual = 'N/A';

      // Registrar como asignación virtual (no ocupa salón físico)
      this.sistema.asignaciones.push({
        clase,
        salon: null, // No hay salón físico asignado
        bloque: 'Laboratorio',
        mensaje: `Laboratorio: ${clase.nombreAsignatura} (${clase.horaInicio}-${clase.horaFin}) - No requiere salón`
      });

      console.log(`Clase de laboratorio registrada: ${clase.nombreAsignatura} del grupo ${clase.grupoId} (${item.tipo})`);
    });

    console.log(`Procesamiento de ${this.sistema.clasesLaboratorio.length} clases de laboratorio completado`);
  }

  // Buscar salón exhaustivamente para semana completa (último intento antes de dividir)
  buscarSalonExhaustivoParaSemanaCompleta(grupo, horariosOcupados) {
    // Obtener todos los salones candidatos sin filtrar por prioridad inicialmente
    let salonesCandidatos = this.sistema.salones.filter(salon => {
      try {
        // Verificar que el salón esté disponible en TODOS los horarios necesarios
        for (const horarioInfo of horariosOcupados) {
          if (!this.salonDisponibleEnBloque(salon, grupo, horarioInfo.horario, horarioInfo.dia)) {
            return false;
          }
        }
        return true;
      } catch (error) {
        return false;
      }
    });

    // Si no hay salones candidatos, retornar null
    if (salonesCandidatos.length === 0) {
      return null;
    }

    // Ordenar por mejor ajuste de capacidad (más pequeño primero que pueda acomodar al grupo)
    salonesCandidatos.sort((a, b) => {
      const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
      const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);
      if (ajusteA !== ajusteB) {
        return ajusteA - ajusteB;
      }
      // Si mismo ajuste, preferir piso más bajo
      return a.piso - b.piso;
    });

    // Retornar el mejor salón encontrado
    return salonesCandidatos[0];
  }

  // Intentar asignación dividida en dos salones con días consecutivos
  intentarAsignacionDividida(grupo, horariosOcupados) {
    // Obtener días únicos ordenados
    const diasUnicos = [...new Set(horariosOcupados.map(h => h.dia))].sort();

    if (diasUnicos.length < 2) {
      // Si tiene menos de 2 días, no se puede dividir
      return false;
    }

    // Intentar diferentes divisiones en días consecutivos
    const divisionesPosibles = this.generarDivisionesConsecutivas(diasUnicos);

    for (const { diasPrimeraParte, diasSegundaParte } of divisionesPosibles) {
      // Filtrar horarios para cada parte
      const horariosPrimeraParte = horariosOcupados.filter(h => diasPrimeraParte.includes(h.dia));
      const horariosSegundaParte = horariosOcupados.filter(h => diasSegundaParte.includes(h.dia));

      // Buscar salones cercanos para ambas partes
      const salonesDivididos = this.buscarSalonesCercanosParaDivision(grupo, horariosPrimeraParte, horariosSegundaParte);

      if (salonesDivididos) {
        const { salonPrimera, salonSegunda } = salonesDivididos;

        // Asignar primera parte
        this.asignarSalonAGrupo(grupo, salonPrimera, horariosPrimeraParte, false);

        // Asignar segunda parte
        this.asignarSalonAGrupo(grupo, salonSegunda, horariosSegundaParte, false);

        // Registrar grupo dividido
        this.gruposDivididos.set(grupo.id, {
          salones: [salonPrimera, salonSegunda],
          dias: {
            [salonPrimera.id]: diasPrimeraParte,
            [salonSegunda.id]: diasSegundaParte
          }
        });

        console.log(`Grupo ${grupo.id} dividido: ${diasPrimeraParte.join(',')} en ${salonPrimera.id}, ${diasSegundaParte.join(',')} en ${salonSegunda.id}`);

        return true;
      }
    }

    return false;
  }

  // Generar posibles divisiones en días consecutivos
  generarDivisionesConsecutivas(diasUnicos) {
    const divisiones = [];

    // Para cada punto de división posible (excepto extremos)
    for (let i = 1; i < diasUnicos.length; i++) {
      const diasPrimeraParte = diasUnicos.slice(0, i);
      const diasSegundaParte = diasUnicos.slice(i);

      // Verificar que ambas partes tengan días consecutivos
      if (this.sonDiasConsecutivos(diasPrimeraParte) && this.sonDiasConsecutivos(diasSegundaParte)) {
        divisiones.push({ diasPrimeraParte, diasSegundaParte });
      }
    }

    return divisiones;
  }

  // Verificar si una lista de días son consecutivos
  sonDiasConsecutivos(dias) {
    if (dias.length <= 1) return true;

    const ordenDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const indices = dias.map(dia => ordenDias.indexOf(dia)).sort((a, b) => a - b);

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i-1] + 1) {
        return false;
      }
    }

    return true;
  }

  // Buscar salones cercanos para división según criterios de proximidad
  buscarSalonesCercanosParaDivision(grupo, horariosPrimeraParte, horariosSegundaParte) {
    // Obtener todos los salones disponibles para primera parte
    const salonesPrimera = this.sistema.salones.filter(salon => {
      try {
        for (const horarioInfo of horariosPrimeraParte) {
          if (!this.salonDisponibleEnBloque(salon, grupo, horarioInfo.horario, horarioInfo.dia)) {
            return false;
          }
        }
        return true;
      } catch (error) {
        return false;
      }
    });

    // Obtener todos los salones disponibles para segunda parte
    const salonesSegunda = this.sistema.salones.filter(salon => {
      try {
        for (const horarioInfo of horariosSegundaParte) {
          if (!this.salonDisponibleEnBloque(salon, grupo, horarioInfo.horario, horarioInfo.dia)) {
            return false;
          }
        }
        return true;
      } catch (error) {
        return false;
      }
    });

    if (salonesPrimera.length === 0 || salonesSegunda.length === 0) {
      return null;
    }

    // Buscar la mejor combinación de salones cercanos
    let mejorCombinacion = null;
    let mejorPuntuacion = Infinity;

    for (const salonPrimero of salonesPrimera) {
      for (const salonSegundo of salonesSegunda) {
        // Calcular puntuación de proximidad (menor es mejor)
        const puntuacion = this.calcularPuntuacionProximidad(salonPrimero, salonSegundo);

        // Si encontramos una mejor combinación
        if (puntuacion < mejorPuntuacion) {
          // Verificar si es el mismo salón y si hay conflicto de horarios
          if (salonPrimero.id === salonSegundo.id) {
            // Verificar conflicto de horarios en días compartidos
            const diasComunes = horariosPrimeraParte
              .map(h => h.dia)
              .filter(d => horariosSegundaParte.some(h2 => h2.dia === d));

            if (diasComunes.length > 0) {
              let hayConflicto = false;
              for (const dia of diasComunes) {
                const horarioPrimera = horariosPrimeraParte.find(h => h.dia === dia);
                const horarioSegunda = horariosSegundaParte.find(h => h.dia === dia);
                if (horarioPrimera && horarioSegunda) {
                  if (this.horariosSeSolapan(horarioPrimera.horario, horarioSegunda.horario)) {
                    hayConflicto = true;
                    break;
                  }
                }
              }
              if (hayConflicto) continue; // No usar esta combinación
            }
          }

          mejorPuntuacion = puntuacion;
          mejorCombinacion = { salonPrimera: salonPrimero, salonSegunda: salonSegundo };
        }
      }
    }

    return mejorCombinacion;
  }

  // Calcular puntuación de proximidad entre dos salones (menor es mejor)
  calcularPuntuacionProximidad(salon1, salon2) {
    let puntuacion = 0;

    // 1. Mismo edificio (muy importante)
    if (salon1.edificio !== salon2.edificio) {
      puntuacion += 1000;
    }

    // 2. Mismo piso (muy importante)
    if (salon1.piso !== salon2.piso) {
      puntuacion += 100;
    }

    // 3. Diferencia de piso (dentro del mismo edificio)
    if (salon1.edificio === salon2.edificio) {
      puntuacion += Math.abs(salon1.piso - salon2.piso) * 10;
    }

    // 4. Proximidad numérica de salón (dentro del mismo piso y edificio)
    if (salon1.edificio === salon2.edificio && salon1.piso === salon2.piso) {
      // Extraer números de los IDs (ej: "F-101" -> 101)
      const num1 = parseInt(salon1.id.replace(/^\w-/, ''));
      const num2 = parseInt(salon2.id.replace(/^\w-/, ''));
      puntuacion += Math.abs(num1 - num2);
    }

    return puntuacion;
  }

  // Verificar si dos horarios se solapan
  horariosSeSolapan(horario1, horario2) {
    return horario1.horaInicio < horario2.horaFin && horario2.horaInicio < horario1.horaFin;
  }

  // Verificar si un salón está disponible en un horario específico
  salonDisponibleEnBloque(salon, grupo, horario, dia) {
    // Verificar capacidad
    if (salon.capacidad < grupo.cantidadAlumnos) {
      return false;
    }

    // Verificar accesibilidad si el grupo la requiere
    // (asumiendo que grupos con necesidad de accesibilidad están marcados)

    // Verificar disponibilidad horaria
    return salon.estaDisponible(horario, dia);
  }

  // Ajuste especial: mover grupos de mañana asignados en pisos altos al piso bajo mediante intercambio
  ajustarGruposMananaAPisoBajo() {
    console.log("Realizando ajuste especial para grupos de mañana en pisos altos...");

    let intercambiosRealizados = 0;

    // Encontrar grupos de mañana asignados en pisos altos (4°, 3° o 2°)
    const gruposMananaPisosAltos = [];

    for (const grupoId of this.sistema.grupos.keys()) {
      if (this.grupoTieneHorarioTemprano(grupoId)) {
        const salonAsignado = this.encontrarSalonAsignadoAGrupo(grupoId);
        if (salonAsignado && salonAsignado.piso >= 2 && salonAsignado.piso <= 4) {
          gruposMananaPisosAltos.push({ grupoId, salon: salonAsignado });
        }
      }
    }

    console.log(`Encontrados ${gruposMananaPisosAltos.length} grupos de mañana en pisos altos`);

    // Intentar intercambiar cada grupo de mañana con un grupo en piso bajo
    for (const { grupoId: grupoMananaId, salon: salonAlto } of gruposMananaPisosAltos) {
      const grupoManana = this.sistema.grupos.get(grupoMananaId);
      const intercambioExitoso = this.intentarIntercambioConGrupoPisoBajo(grupoManana, salonAlto);

      if (intercambioExitoso) {
        intercambiosRealizados++;
        console.log(`Intercambio exitoso para grupo ${grupoMananaId}: movido de piso ${salonAlto.piso} a piso bajo`);
      }
    }

    console.log(`Ajuste especial completado: ${intercambiosRealizados} intercambios realizados`);
  }

  // Encontrar el salón asignado a un grupo (asumiendo asignación completa)
  encontrarSalonAsignadoAGrupo(grupoId) {
    for (const salon of this.sistema.salones) {
      if (salon.grupoAsignadoFijo === grupoId) {
        return salon;
      }
    }
    return null;
  }

  // Intentar intercambiar un grupo de mañana con un grupo en piso bajo
  intentarIntercambioConGrupoPisoBajo(grupoManana, salonAlto) {
    // Buscar grupos asignados en piso 1 que puedan intercambiarse
    for (const salonBajo of this.sistema.salones) {
      if (salonBajo.piso === 1 && salonBajo.grupoAsignadoFijo) {
        const grupoBajoId = salonBajo.grupoAsignadoFijo;
        const grupoBajo = this.sistema.grupos.get(grupoBajoId);

        // Verificar si el intercambio es posible
        if (this.puedeIntercambiarGrupos(grupoManana, salonAlto, grupoBajo, salonBajo)) {
          // Realizar el intercambio
          this.realizarIntercambioGrupos(grupoManana, salonAlto, grupoBajo, salonBajo);
          return true;
        }
      }
    }
    return false;
  }

  // Verificar si dos grupos pueden intercambiar salones
  puedeIntercambiarGrupos(grupoA, salonA, grupoB, salonB) {
    // Verificar capacidades
    if (salonA.capacidad < grupoB.cantidadAlumnos || salonB.capacidad < grupoA.cantidadAlumnos) {
      return false;
    }

    // Verificar que ambos salones estén disponibles para los horarios del otro grupo
    const horariosA = this.calcularHorariosOcupadosPorGrupo(grupoA.id);
    const horariosB = this.calcularHorariosOcupadosPorGrupo(grupoB.id);

    // Verificar si el grupo A puede usar el salón B
    for (const horario of horariosA) {
      if (!this.salonDisponibleEnBloque(salonB, grupoA, horario.horario, horario.dia)) {
        return false;
      }
    }

    // Verificar si el grupo B puede usar el salón A
    for (const horario of horariosB) {
      if (!this.salonDisponibleEnBloque(salonA, grupoB, horario.horario, horario.dia)) {
        return false;
      }
    }

    return true;
  }

  // Realizar el intercambio físico de grupos entre salones
  realizarIntercambioGrupos(grupoA, salonA, grupoB, salonB) {
    // Liberar salones actuales
    salonA.liberarHorarios(grupoA.id);
    salonB.liberarHorarios(grupoB.id);

    // Limpiar asignaciones fijas
    salonA.grupoAsignadoFijo = null;
    salonB.grupoAsignadoFijo = null;

    // Reasignar grupo A al salón B
    const horariosA = this.calcularHorariosOcupadosPorGrupo(grupoA.id);
    this.asignarSalonAGrupo(grupoA, salonB, horariosA, true);

    // Reasignar grupo B al salón A
    const horariosB = this.calcularHorariosOcupadosPorGrupo(grupoB.id);
    this.asignarSalonAGrupo(grupoB, salonA, horariosB, true);

    // Actualizar asignaciones en las clases
    this.actualizarAsignacionesClases(grupoA.id, salonB);
    this.actualizarAsignacionesClases(grupoB.id, salonA);
  }

  // Actualizar las asignaciones de salón en las clases de un grupo
  actualizarAsignacionesClases(grupoId, nuevoSalon) {
    this.sistema.clases
      .filter(clase => clase.grupoId === grupoId)
      .forEach(clase => {
        clase.salonActual = nuevoSalon.id;
        clase.edificioActual = nuevoSalon.edificio;
      });
  }
}

export default AsignadorAutomatico;