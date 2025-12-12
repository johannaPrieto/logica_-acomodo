class Salon {
  constructor(id, edificio, piso, capacidad, accesible = false) {
    this.id = id; // Ej: "F-101"
    this.edificio = edificio; // "F", "D", "E"
    this.piso = piso; // 1-4
    this.capacidad = capacidad;
    this.accesible = accesible;
    this.horariosOcupados = []; // Array de franjas horarias
    this.asignacionesBloques = []; // Array de asignaciones por bloque
  }

  // Verificar si el salón está disponible en un horario y día
  estaDisponible(horario, dia) {
    return !this.horariosOcupados.some(h =>
      h.dia === dia && this.horariosSeSuperponen(h.horario, horario)
    );
  }

  // Verificar si dos horarios se superponen
  horariosSeSuperponen(horario1, horario2) {
    const inicio1 = this.convertirHoraAMinutos(horario1.horaInicio);
    const fin1 = this.convertirHoraAMinutos(horario1.horaFin);
    const inicio2 = this.convertirHoraAMinutos(horario2.horaInicio);
    const fin2 = this.convertirHoraAMinutos(horario2.horaFin);
    
    return inicio1 < fin2 && fin1 > inicio2;
  }

  // Convertir hora "HH:MM" a minutos
  convertirHoraAMinutos(hora) {
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
  }

  // Agregar horario ocupado
  agregarHorarioOcupado(dia, horario, grupoId) {
    // Verificar si ya existe un horario idéntico para evitar duplicados
    const existe = this.horariosOcupados.some(h =>
      h.dia === dia &&
      h.horario.horaInicio === horario.horaInicio &&
      h.horario.horaFin === horario.horaFin
    );
    if (!existe) {
      this.horariosOcupados.push({ dia, horario, grupoId });
    }
  }

  // Agregar asignación por bloque
  agregarAsignacionBloque(asignacion) {
    // Verificar si ya existe una asignación idéntica para evitar duplicados
    const existe = this.asignacionesBloques.some(asig =>
      asig.grupoId === asignacion.grupoId &&
      asig.dia === asignacion.dia &&
      asig.bloque === asignacion.bloque &&
      asig.horario.horaInicio === asignacion.horario.horaInicio &&
      asig.horario.horaFin === asignacion.horario.horaFin
    );
    if (!existe) {
      this.asignacionesBloques.push(asignacion);
    }
  }

  // Ocupar el salón en un día y horario específico para un grupo
  ocupar(dia, horario, grupoId) {
    // Agregar el horario a la lista de horarios ocupados
    this.agregarHorarioOcupado(dia, horario, grupoId);

    // Agregar la asignación por bloque
    this.agregarAsignacionBloque({
      grupoId: grupoId,
      dia: dia,
      horario: horario,
      bloque: 'Asignado' // O algún nombre apropiado
    });
  }

  // Liberar todos los horarios ocupados por un grupo específico
  liberarHorarios(grupoId) {
    // Remover horarios ocupados del grupo
    this.horariosOcupados = this.horariosOcupados.filter(h => h.grupoId !== grupoId);

    // Remover asignaciones de bloques del grupo
    this.asignacionesBloques = this.asignacionesBloques.filter(asig => asig.grupoId !== grupoId);
  }
}

export default Salon;