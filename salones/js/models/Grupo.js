class Grupo {
  constructor(id, carrera, semestre, numero, cantidadAlumnos, tieneDiscapacidad = false) {
    this.id = id; // Ej: "601"
    this.carrera = carrera; // 200, 400, 500, 900, 6
    this.semestre = semestre; // 1-8
    this.numero = numero; // 1-9
    this.cantidadAlumnos = cantidadAlumnos;
    this.tieneDiscapacidad = tieneDiscapacidad;
  }
}

export default Grupo;