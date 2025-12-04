/**
 * Procesa un archivo CSV y lo convierte a array de objetos
 * @param {File} archivo - Archivo CSV a procesar
 * @returns {Promise<Object>} Resultado del procesamiento
 */
async function procesarArchivoCSV(archivo) {
  try {
    // Validar tipo de archivo
    if (!archivo.name.match(/\.(csv)$/i)) {
      throw new Error(`ARCHIVO_INVALIDO: El archivo ${archivo.name} debe ser CSV`);
    }

    // Leer contenido del archivo
    const contenido = await leerArchivo(archivo);

    // Validar estructura del CSV
    validarEstructuraCSV(contenido, archivo.name);

    // Convertir CSV a array de objetos
    return parsearCSV(contenido);
  } catch (error) {
    throw error;
  }
}

/**
 * Lee el contenido de un archivo
 * @param {File} archivo - Archivo a leer
 * @returns {Promise<string>} Contenido del archivo
 */
function leerArchivo(archivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('ERROR_LECTURA: No se pudo leer el archivo'));
    reader.readAsText(archivo);
  });
}

/**
 * Valida la estructura del CSV
 * @param {string} contenido - Contenido del CSV
 * @param {string} fileName - Nombre del archivo
 * @throws {Error} Si la estructura es inválida
 */
function validarEstructuraCSV(contenido, fileName) {
  const lineas = contenido.split('\n').filter(linea => linea.trim() !== '');
  if (lineas.length < 2) {
    throw new Error(`CSV_INVALIDO: El archivo "${fileName}" debe contener al menos una fila de datos`);
  }

  const encabezados = lineas[0].split(',').map(h => h.trim());
  const encabezadosRequeridos = [
    'id_unico', 'codigo_asignatura', 'nombre_asignatura', 'maestro',
    'edificio', 'salon', 'capacidad', 'grupo', 'dia_semana',
    'hora_inicio', 'hora_fin', 'duracion_min', 'modalidad', 'tipo'
  ];

  for (const encabezado of encabezadosRequeridos) {
    if (!encabezados.includes(encabezado)) {
      throw new Error(`CSV_INVALIDO: Falta el encabezado requerido "${encabezado}" en el archivo "${fileName}"`);
    }
  }

  // Validar formato de cada fila
  for (let i = 1; i < lineas.length; i++) {
    const fila = lineas[i].split(',').map(c => c.trim());
    if (fila.length !== encabezados.length) {
      throw new Error(`CSV_INVALIDO: La fila ${i} del archivo "${fileName}" tiene un número incorrecto de columnas`);
    }

    // Validar formato de id_unico (número)
    if (!fila[0].match(/^\d+$/)) {
      throw new Error(`CSV_INVALIDO: Formato de id_unico inválido en fila ${i} del archivo "${fileName}"`);
    }

    // Validar formato de capacidad (número)
    if (!fila[6].match(/^\d+$/)) {
      throw new Error(`CSV_INVALIDO: Formato de capacidad inválido en fila ${i} del archivo "${fileName}"`);
    }

    // Validar formato de grupo (número de 3 dígitos o "VIR")
    if (!fila[7].match(/^\d{3}$/) && fila[7] !== 'VIR') {
      throw new Error(`CSV_INVALIDO: Formato de grupo inválido en fila ${i} del archivo "${fileName}"`);
    }

    // Validar formato de hora (HH:MM)
    if (!fila[9].match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) ||
        !fila[10].match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      throw new Error(`CSV_INVALIDO: Formato de hora inválido en fila ${i} del archivo "${fileName}"`);
    }

    // Validar modalidad (Presencial o Virtual)
    if (!['Presencial', 'Virtual'].includes(fila[12])) {
      throw new Error(`CSV_INVALIDO: Modalidad inválida en fila ${i} del archivo "${fileName}"`);
    }
  }
}

/**
 * Parsea el contenido CSV a array de objetos
 * @param {string} contenido - Contenido del CSV
 * @returns {Array} Array de objetos con los datos
 */
function parsearCSV(contenido) {
  const lineas = contenido.split('\n').filter(linea => linea.trim() !== '');
  const encabezados = lineas[0].split(',').map(h => h.trim());
  const datos = [];
  
  for (let i = 1; i < lineas.length; i++) {
    const valores = lineas[i].split(',').map(v => v.trim());
    const fila = {};
    
    encabezados.forEach((encabezado, index) => {
      fila[encabezado] = valores[index];
    });
    
    datos.push(fila);
  }
  
  return datos;
}

export default procesarArchivoCSV;