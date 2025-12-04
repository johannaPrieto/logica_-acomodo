/**
 * Implementación mejorada del algoritmo Radix Sort para ordenar clases
 * @param {Array} clases - Array de clases a ordenar
 * @param {Array} gruposPrioritarios - Array de IDs de grupos prioritarios
 * @returns {Array} Clases ordenadas
 */
function radixSortClases(clases, gruposPrioritarios = []) {
  // Convertir a Set para búsqueda eficiente
  const gruposPrioritariosSet = new Set(gruposPrioritarios);

  // Asignar prioridad a cada clase con lógica mejorada
  clases.forEach(clase => {
    let prioridadBase = 3; // Prioridad por defecto

    // Prioridad 0: Grupos prioritarios del usuario (máxima prioridad)
    if (gruposPrioritariosSet.has(clase.grupoId)) {
      prioridadBase = 0;
    }
    // Prioridad 1: Grupos de 1er/2do semestre (principiante)
    else if (clase.semestre === 1 || clase.semestre === 2) {
      prioridadBase = 1;
    }
    // Prioridad 2: Grupos avanzados (6to-8vo semestre)
    else if (clase.semestre >= 6) {
      prioridadBase = 2;
    }
    // Prioridad 3: Semestres intermedios (3-5)

    clase.prioridad = prioridadBase;

    // Clave compuesta mejorada: prioridad + capacidad (invertida) + día de la semana + hora
    // Esto asegura orden consistente y reduce conflictos
    const diaNum = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      .indexOf(clase.diaSemana) + 1;
    const horaNum = parseInt(clase.horaInicio.replace(':', ''));

    clase.claveRadix =
      clase.prioridad * 1000000000000 +  // 12 dígitos para prioridad
      (1000000000 - clase.capacidadRequerida) * 1000000 +  // 6 dígitos para capacidad invertida
      diaNum * 10000 +  // 4 dígitos para día
      horaNum;  // 4 dígitos para hora
  });

  // Encontrar el máximo valor para determinar el número de dígitos
  const maxClave = Math.max(...clases.map(c => c.claveRadix || 0));
  const maxDigitos = Math.floor(Math.log10(Math.max(maxClave, 1))) + 1;

  // Aplicar Radix Sort con optimizaciones
  for (let digito = 0; digito < maxDigitos; digito++) {
    const buckets = Array.from({ length: 10 }, () => []);

    for (const clase of clases) {
      const clave = clase.claveRadix || 0;
      const digitoActual = Math.floor(clave / Math.pow(10, digito)) % 10;
      buckets[digitoActual].push(clase);
    }

    // Reconstruir array manteniendo estabilidad
    clases = buckets.flat();
  }

  // Verificación final: asegurar que grupos prioritarios estén al inicio
  const prioritarios = clases.filter(c => gruposPrioritariosSet.has(c.grupoId));
  const noPrioritarios = clases.filter(c => !gruposPrioritariosSet.has(c.grupoId));

  return [...prioritarios, ...noPrioritarios];
}

export default radixSortClases;