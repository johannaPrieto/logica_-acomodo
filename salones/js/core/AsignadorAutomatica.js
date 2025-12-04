import Horario from '../models/Horario.js';
import { ERRORES } from '../utils/validators.js';

class AsignadorAutomatico {
  constructor(sistema, gruposPrioritarios = []) {
    this.sistema = sistema;
    this.gruposPrioritarios = Array.isArray(gruposPrioritarios) ? gruposPrioritarios : [gruposPrioritarios].filter(g => g);
  }

  // Asignar salones automáticamente por grupo con estrategia mejorada
  asignarSalones() {
    console.log("Iniciando asignación de salones por grupo...");
    console.log(`Total de clases a asignar: ${this.sistema.clases.length}`);

    // Obtener todos los grupos únicos ordenados por prioridad
    const gruposUnicos = this.obtenerGruposOrdenadosPorPrioridad();
    console.log(`Grupos únicos ordenados: ${gruposUnicos.join(', ')}`);

    // Primera pasada: intentar asignar salones para toda la semana
    console.log("Primera pasada: asignación semanal...");
    const gruposAsignadosSemanal = new Set();
    const gruposSinAsignar = [];

    for (const grupoId of gruposUnicos) {
      const grupo = this.sistema.grupos.get(grupoId);

      // Obtener todos los días en que el grupo tiene clases (excluyendo sábados, que son virtuales)
      const diasGrupo = new Set(
        this.sistema.clases
          .filter(clase => clase.grupoId === grupoId && clase.diaSemana !== 6)
          .map(clase => clase.diaSemana)
      );

      console.log(`Grupo ${grupoId} tiene clases en: ${Array.from(diasGrupo).join(', ')}`);

      // Obtener todos los bloques que necesita el grupo (uno por día)
      const bloquesNecesarios = [];
      for (const dia of diasGrupo) {
        const bloque = this.sistema.obtenerBloqueGrupoDia(grupoId, dia);
        if (bloque) {
          bloquesNecesarios.push({
            dia,
            bloque,
            horario: new Horario(bloque.inicio, bloque.fin)
          });
        }
      }

      if (bloquesNecesarios.length === 0) {
        console.log(`No se encontraron bloques para el grupo ${grupoId}`);
        continue;
      }

      try {
        // Buscar salón disponible para TODOS los bloques del grupo
        const salon = this.buscarSalonDisponibleParaGrupo(grupo, bloquesNecesarios);

        if (salon) {
          console.log(`Asignando salón ${salon.id} al grupo ${grupoId} para toda la semana`);
          this.asignarSalonAGrupo(grupo, salon, bloquesNecesarios);
          gruposAsignadosSemanal.add(grupoId);
        } else {
          console.log(`No se pudo asignar salón semanal para grupo ${grupoId}, agregando a lista de reintento`);
          gruposSinAsignar.push({ grupoId, grupo, bloquesNecesarios, diasGrupo });
        }

      } catch (error) {
        console.error(`Error al asignar salón para grupo ${grupoId}:`, error.message);
        gruposSinAsignar.push({ grupoId, grupo, bloquesNecesarios, diasGrupo });
      }
    }

    // Segunda pasada: asignación día por día para grupos sin asignar semanal
    console.log("Segunda pasada: asignación día por día...");
    for (const { grupoId, grupo, bloquesNecesarios, diasGrupo } of gruposSinAsignar) {
      console.log(`Intentando asignación día por día para grupo ${grupoId}`);
      this.asignarSalonDiaPorDia(grupo, bloquesNecesarios);
    }

    console.log("Asignación de salones por grupo completada");
    console.log(`Total de asignaciones: ${this.sistema.asignaciones.length}`);
    console.log(`Total de errores: ${this.sistema.errores.length}`);
  }

  // Salones cerca del elevador (1er piso - todos los del piso 1)
  get salonesCercaElevador() {
    // Todos los salones del piso 1 están cerca del elevador
    return this.sistema.salones.filter(salon => salon.piso === 1);
  }

  // Buscar salón disponible para un grupo en todos sus bloques
  buscarSalonDisponibleParaGrupo(grupo, bloquesNecesarios) {
    // Filtrar salones que cumplan con las condiciones básicas
    let salonesCandidatos = this.sistema.salones.filter(salon => {
      try {
        // Verificar que el salón esté disponible en TODOS los bloques necesarios
        for (const bloqueInfo of bloquesNecesarios) {
          // Usar la validación existente pero con horario específico
          if (!this.salonDisponibleEnBloque(salon, grupo, bloqueInfo.horario)) {
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
    // 1. Priorizar salones con mejor ajuste de capacidad
    salonesCandidatos.sort((a, b) => {
      const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
      const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);
      return ajusteA - ajusteB; // Mejor ajuste primero
    });

    // 2. Para salones con mismo ajuste, preferir piso más bajo (más accesible)
    salonesCandidatos.sort((a, b) => {
      const ajusteA = Math.abs(a.capacidad - grupo.cantidadAlumnos);
      const ajusteB = Math.abs(b.capacidad - grupo.cantidadAlumnos);

      if (ajusteA === ajusteB) {
        return a.piso - b.piso; // Piso más bajo primero
      }
      return 0; // Mantener orden anterior
    });

    // Retornar el mejor salón candidato
    return salonesCandidatos[0];
  }

  // Obtener grupos ordenados por prioridad para asignación
  obtenerGruposOrdenadosPorPrioridad() {
    const gruposUnicos = Array.from(new Set(this.sistema.clases.map(clase => clase.grupoId)));

    // Ordenar grupos por prioridad: prioritarios primero, luego por semestre, luego por tamaño
    return gruposUnicos.sort((a, b) => {
      const grupoA = this.sistema.grupos.get(a);
      const grupoB = this.sistema.grupos.get(b);

      // 1. Grupos prioritarios primero
      const aEsPrioritario = this.gruposPrioritarios.includes(a);
      const bEsPrioritario = this.gruposPrioritarios.includes(b);
      if (aEsPrioritario && !bEsPrioritario) return -1;
      if (!aEsPrioritario && bEsPrioritario) return 1;

      // 2. Semestre más bajo primero (principiante)
      if (grupoA && grupoB && grupoA.semestre !== grupoB.semestre) {
        return grupoA.semestre - grupoB.semestre;
      }

      // 3. Grupos más grandes primero (mejor aprovechamiento de salones)
      if (grupoA && grupoB) {
        return grupoB.cantidadAlumnos - grupoA.cantidadAlumnos;
      }

      // 4. Orden alfabético como tiebreaker
      return a.localeCompare(b);
    });
  }

  // Asignar salón a un grupo para todos sus bloques
  asignarSalonAGrupo(grupo, salon, bloquesNecesarios) {
    for (const bloqueInfo of bloquesNecesarios) {
      const { dia, bloque, horario } = bloqueInfo;

      // Asignar todas las clases del grupo en este día
      const clave = `${grupo.id}-${dia}`;
      const clasesGrupoDia = this.sistema.clasesPorGrupoDia.get(clave) || [];

      clasesGrupoDia.forEach(clase => {
        // Actualizar el salón de la clase
        clase.salonActual = salon.id;
        clase.edificioActual = salon.edificio;

        // Registrar la asignación
        this.sistema.asignaciones.push({
          clase,
          salon,
          bloque: bloque.nombre,
          mensaje: `Asignado: ${clase.nombreAsignatura} en ${salon.id} (${bloque.nombre})`
        });
      });

      // Ocupar el salón durante este bloque
      salon.agregarHorarioOcupado(horario);

      // Registrar la asignación del bloque
      if (!salon.asignacionesBloques) {
        salon.asignacionesBloques = [];
      }
      salon.asignacionesBloques.push({
        grupoId: grupo.id,
        dia,
        bloque: bloque.nombre,
        horario
      });

      console.log(`Salón ${salon.id} ocupado el ${dia} de ${bloque.inicio} a ${bloque.fin}`);
    }
  }

  // Asignar salón día por día como estrategia de fallback
  asignarSalonDiaPorDia(grupo, bloquesNecesarios) {
    const asignacionesDiaPorDia = [];

    for (const bloqueInfo of bloquesNecesarios) {
      const { dia, bloque, horario } = bloqueInfo;

      // Buscar salón disponible solo para este día
      const salonDia = this.buscarSalonDisponibleParaGrupo(grupo, [bloqueInfo]);

      if (salonDia) {
        console.log(`Asignando salón ${salonDia.id} al grupo ${grupo.id} para ${dia}`);

        // Asignar clases de este día
        const clave = `${grupo.id}-${dia}`;
        const clasesGrupoDia = this.sistema.clasesPorGrupoDia.get(clave) || [];

        clasesGrupoDia.forEach(clase => {
          clase.salonActual = salonDia.id;
          clase.edificioActual = salonDia.edificio;

          this.sistema.asignaciones.push({
            clase,
            salon: salonDia,
            bloque: bloque.nombre,
            mensaje: `Asignado día por día: ${clase.nombreAsignatura} en ${salonDia.id} (${bloque.nombre})`
          });
        });

        // Ocupar el salón
        salonDia.agregarHorarioOcupado(horario);

        if (!salonDia.asignacionesBloques) {
          salonDia.asignacionesBloques = [];
        }
        salonDia.asignacionesBloques.push({
          grupoId: grupo.id,
          dia,
          bloque: bloque.nombre,
          horario
        });

        asignacionesDiaPorDia.push({ dia, salon: salonDia.id });
      } else {
        console.error(`No se pudo asignar salón para grupo ${grupo.id} el día ${dia}`);

        // Registrar error para las clases de este día
        const clave = `${grupo.id}-${dia}`;
        const clasesGrupoDia = this.sistema.clasesPorGrupoDia.get(clave) || [];

        clasesGrupoDia.forEach(clase => {
          this.sistema.errores.push({
            clase,
            mensaje: `No hay salones disponibles para el día ${dia}`
          });
        });
      }
    }

    if (asignacionesDiaPorDia.length > 0) {
      console.log(`Grupo ${grupo.id} asignado día por día: ${asignacionesDiaPorDia.map(a => `${a.dia}:${a.salon}`).join(', ')}`);
    }
  }

  // Verificar si un salón está disponible en un horario específico
  salonDisponibleEnBloque(salon, grupo, horario) {
    // Verificar capacidad
    if (salon.capacidad < grupo.cantidadAlumnos) {
      return false;
    }

    // Verificar accesibilidad si el grupo la requiere
    // (asumiendo que grupos con necesidad de accesibilidad están marcados)

    // Verificar disponibilidad horaria
    return salon.estaDisponible(horario);
  }
}

export default AsignadorAutomatico;