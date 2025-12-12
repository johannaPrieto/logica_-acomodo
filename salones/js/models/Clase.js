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
    // Normalizar extracción: usar mapeo primer dígito -> código carrera
    // Ejemplo: '6' -> 600 (LAE), '9' -> 900 (LIN), '3' -> 300 (LC), etc.
    if (this.grupoId && this.grupoId !== 'VIR' && this.grupoId.length >= 3) {
      const primerDigito = this.grupoId[0];
      const mapaCarrera = {
        '2': 200, // ejemplo: 200 -> otra carrera
        '3': 300, // LC
        '4': 400, // LAE
        '5': 500, // otra
        '6': 600, // LAE? (ajustar según convención)
        '9': 900  // LIN (por ejemplo grupos que comienzan con 9)
      };

      this.carrera = mapaCarrera[primerDigito] || parseInt(primerDigito) * 100;

      // Semestre y número de grupo: extraer de las siguientes posiciones si son números
      const s = parseInt(this.grupoId[1]);
      const n = parseInt(this.grupoId[2]);
      this.semestre = Number.isInteger(s) ? s : null;
      this.numeroGrupo = Number.isInteger(n) ? n : null;
    } else {
      this.carrera = null;
      this.semestre = null;
      this.numeroGrupo = null;
    }
  }
}

export default Clase;