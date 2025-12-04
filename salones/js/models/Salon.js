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

  // Verificar si el salón está disponible en un horario
  estaDisponible(horario) {
    return !this.horariosOcupados.some(h => 
      this.horariosSeSuperponen(h, horario)
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
  agregarHorarioOcupado(horario) {
    this.horariosOcupados.push(horario);
  }

  // Agregar asignación por bloque
  agregarAsignacionBloque(asignacion) {
    this.asignacionesBloques.push(asignacion);
  }
}

export default Salon;