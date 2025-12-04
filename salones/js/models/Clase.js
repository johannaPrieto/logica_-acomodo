class Clase {
  constructor(datos) {
    this.idUnico = datos.id_unico;
    this.codigoAsignatura = datos.codigo_asignatura;
    this.nombreAsignatura = datos.nombre_asignatura;
    this.maestro = datos.maestro;
    this.edificioActual = datos.edificio;
    this.salonActual = datos.salon;
    this.capacidadRequerida = parseInt(datos.capacidad);
    this.grupoId = datos.grupo;
    this.diaSemana = datos.dia_semana;
    this.horaInicio = datos.hora_inicio;
    this.horaFin = datos.hora_fin;
    this.duracionMin = parseInt(datos.duracion_min);
    this.modalidad = datos.modalidad;
    this.tipo = datos.tipo;
    
    // Extraer información del grupo
    if (this.grupoId !== 'VIR') {
      this.carrera = parseInt(this.grupoId[0]);
      this.semestre = parseInt(this.grupoId[1]);
      this.numeroGrupo = parseInt(this.grupoId[2]);
    }
  }
}

export default Clase;