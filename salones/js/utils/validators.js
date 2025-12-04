// Formato: CATEGORIA_ERROR: Mensaje descriptivo
export const ERRORES = {
  CHOQUE_HORARIO: "CHOQUE_HORARIO: El salón {salon} ya está ocupado en esta franja horaria",
  ACCESIBILIDAD: "ACCESIBILIDAD: El grupo {grupo} requiere un salón en primer piso",
  CAPACIDAD: "CAPACIDAD: El grupo excede la capacidad del salón. Alumnos: {alumnos}, Capacidad: {capacidad}",
  PRIORIDAD_PISO: "PRIORIDAD_PISO: Los grupos de {semestre}° semestre deben asignarse al {piso} piso",
  ARCHIVO_INVALIDO: "ARCHIVO_INVALIDO: El archivo debe ser CSV",
  CSV_INVALIDO: "CSV_INVALIDO: {motivo}",
  ARCHIVOS_INSUFICIENTES: "ARCHIVOS_INSUFICIENTES: Se requieren 5 archivos (uno por carrera)",
  ERROR_LECTURA: "ERROR_LECTURA: No se pudo leer el archivo",
  AUTENTICACION: "AUTENTICACION: Credenciales inválidas",
  PERMISO: "PERMISO: No tiene permisos para realizar esta acción"
};

/**
 * Valida si un salón es adecuado para un grupo
 * @param {Salon} salon - Salón a validar
 * @param {Grupo} grupo - Grupo a validar
 * @param {Horario} horario - Horario a validar
 * @throws {Error} Si el salón no es adecuado
 */
function validarSalonParaGrupo(salon, grupo, horario) {
  // Verificar disponibilidad horaria
  if (!salon.estaDisponible(horario)) {
    throw new Error(ERRORES.CHOQUE_HORARIO.replace('{salon}', salon.id));
  }
  
  // Verificar accesibilidad
  if (grupo.tieneDiscapacidad && salon.piso !== 1) {
    throw new Error(ERRORES.ACCESIBILIDAD.replace('{grupo}', grupo.id));
  }
  
  // Verificar capacidad
  if (grupo.cantidadAlumnos > salon.capacidad) {
    throw new Error(ERRORES.CAPACIDAD
      .replace('{alumnos}', grupo.cantidadAlumnos)
      .replace('{capacidad}', salon.capacidad));
  }
  
  // Verificar prioridad de piso
  if ((grupo.semestre === 1 || grupo.semestre === 2) && salon.piso !== 4) {
    throw new Error(ERRORES.PRIORIDAD_PISO
      .replace('{semestre}', grupo.semestre)
      .replace('{piso}', '4to'));
  }
  
  if (grupo.semestre >= 6 && salon.piso > 2) {
    throw new Error(ERRORES.PRIORIDAD_PISO
      .replace('{semestre}', grupo.semestre)
      .replace('{piso}', 'primeros'));
  }
}

export default validarSalonParaGrupo;