/**
 * SOLUCIÓN PARA PROBLEMAS DE CARGA DE ARCHIVOS Y TRONCO COMÚN
 * Sistema de Asignación de Salones - Debug y Fix
 */

// ==========================================
// 1. PROCESADOR DE ARCHIVOS ROBUSTO CON DEBUG
// ==========================================

/**
 * Procesador de archivos mejorado con manejo robusto de errores
 */
class ProcesadorArchivosRobusto {
  constructor() {
    this.erroresEncontrados = [];
    this.materiasTroncoComunDebug = [];
  }

  /**
   * Procesa archivos con debug detallado
   */
  async procesarArchivosConDebug(archivos) {
    console.log('🔍 INICIANDO PROCESAMIENTO CON DEBUG');
    console.log(`📁 Archivos recibidos: ${archivos.length}`);
    
    // Validar archivos primero
    const validacion = this.validarArchivosEntrada(archivos);
    if (!validacion.valido) {
      throw new Error(`VALIDACION_FALLIDA: ${validacion.errores.join(', ')}`);
    }

    const resultados = [];
    
    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      console.log(`\n📄 Procesando archivo ${i + 1}: ${archivo.name}`);
      
      try {
        const resultado = await this.procesarArchivoIndividualDebug(archivo);
        resultados.push(resultado);
        console.log(`✅ Archivo ${archivo.name} procesado exitosamente`);
        console.log(`   - Clases encontradas: ${resultado.clasesProcesadas}`);
        console.log(`   - Materias laboratorio: ${resultado.laboratorioCount}`);
        console.log(`   - Materias virtuales: ${resultado.virtualesCount}`);
        console.log(`   - Errores: ${resultado.errores.length}`);
      } catch (error) {
        console.error(`❌ Error procesando archivo ${archivo.name}:`, error.message);
        this.erroresEncontrados.push({
          archivo: archivo.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Continuar con otros archivos aunque uno falle
        resultados.push({
          exito: false,
          archivo: archivo.name,
          error: error.message,
          clasesProcesadas: 0
        });
      }
    }

    // Resumen final
    this.mostrarResumenDebug(resultados);
    
    return {
      exito: this.erroresEncontrados.length === 0,
      resultados,
      errores: this.erroresEncontrados,
      debug: {
        materiasTroncoComun: this.materiasTroncoComunDebug,
        archivosProcesados: resultados.length,
        erroresEncontrados: this.erroresEncontrados.length
      }
    };
  }

  /**
   * Validación mejorada de archivos de entrada
   */
  validarArchivosEntrada(archivos) {
    const errores = [];

    if (!archivos || archivos.length === 0) {
      errores.push('No se seleccionaron archivos');
    }

    if (archivos.length !== 5) {
      errores.push(`Se requieren exactamente 5 archivos, se recibieron ${archivos.length}`);
    }

    archivos.forEach((archivo, index) => {
      if (!archivo.name) {
        errores.push(`Archivo ${index + 1} no tiene nombre`);
      }

      if (!archivo.name.toLowerCase().endsWith('.csv')) {
        errores.push(`El archivo ${archivo.name} no es un CSV válido`);
      }

      if (archivo.size === 0) {
        errores.push(`El archivo ${archivo.name} está vacío`);
      }

      if (archivo.size > 10 * 1024 * 1024) { // 10MB
        errores.push(`El archivo ${archivo.name} es demasiado grande (${(archivo.size / 1024 / 1024).toFixed(2)}MB)`);
      }
    });

    return {
      valido: errores.length === 0,
      errores
    };
  }

  /**
   * Procesamiento individual con debug
   */
  async procesarArchivoIndividualDebug(archivo) {
    console.log(`🔍 Leyendo archivo: ${archivo.name}`);
    
    // Leer archivo con manejo robusto
    const contenido = await this.leerArchivoRobusto(archivo);
    console.log(`📖 Contenido leído: ${contenido.length} caracteres`);

    // Validar estructura CSV
    const validacion = this.validarEstructuraCSVDebug(contenido, archivo.name);
    if (!validacion.valido) {
      throw new Error(`ESTRUCTURA_CSV_INVALIDA: ${validacion.errores.join(', ')}`);
    }

    // Parsear CSV
    const datos = this.parsearCSVDebug(contenido, archivo.name);
    console.log(`📊 Filas parseadas: ${datos.length}`);

    // Procesar cada fila con debug
    let clasesProcesadas = 0;
    let laboratorioCount = 0;
    let virtualesCount = 0;
    const errores = [];

    for (let i = 0; i < datos.length; i++) {
      const fila = datos[i];
      
      try {
        // Debug específico para materias de tronco común
        if (this.esPosibleTroncoComun(fila)) {
          console.log(`🔬 Posible materia Tronco Común detectada:`);
          console.log(`   - Código: ${fila.codigo_asignatura}`);
          console.log(`   - Semestre: ${fila.semestre || 'no definido'}`);
          console.log(`   - Nombre: ${fila.nombre_asignatura}`);
          
          this.materiasTroncoComunDebug.push({
            archivo: archivo.name,
            fila: i + 1,
            codigo: fila.codigo_asignatura,
            semestre: fila.semestre,
            nombre: fila.nombre_asignatura
          });
        }

        // Crear clase con manejo de errores robusto
        const clase = this.crearClaseRobusta(fila);
        
        // Verificar tipo de clase
        if (this.esLaboratorio(clase)) {
          laboratorioCount++;
        } else if (this.esVirtual(clase)) {
          virtualesCount++;
        }
        
        clasesProcesadas++;
        
      } catch (error) {
        console.error(`❌ Error en fila ${i + 1}:`, error.message);
        errores.push({
          fila: i + 1,
          datos: fila,
          error: error.message
        });
      }
    }

    return {
      exito: true,
      archivo: archivo.name,
      clasesProcesadas,
      laboratorioCount,
      virtualesCount,
      errores
    };
  }

  /**
   * Leer archivo con manejo robusto de errores
   */
  leerArchivoRobusto(archivo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const contenido = e.target.result;
        
        if (!contenido || contenido.trim() === '') {
          reject(new Error(`ARCHIVO_VACIO: El archivo ${archivo.name} está vacío`));
          return;
        }
        
        resolve(contenido);
      };
      
      reader.onerror = () => {
        reject(new Error(`ERROR_LECTURA: No se pudo leer el archivo ${archivo.name}`));
      };
      
      reader.onabort = () => {
        reject(new Error(`LECTURA_ABORTADA: La lectura del archivo ${archivo.name} fue abortada`));
      };
      
      try {
        reader.readAsText(archivo, 'UTF-8');
      } catch (error) {
        reject(new Error(`ERROR_CODIFICACION: ${error.message}`));
      }
    });
  }

  /**
   * Validación de estructura CSV con debug
   */
  validarEstructuraCSVDebug(contenido, fileName) {
    const errores = [];
    
    try {
      const lineas = contenido.split('\n').filter(linea => linea.trim() !== '');
      
      if (lineas.length < 2) {
        errores.push('Debe contener al menos una fila de encabezados y una de datos');
        return { valido: false, errores };
      }

      const encabezados = this.parsearLineaCSV(lineas[0]);
      console.log(`📋 Encabezados encontrados: ${encabezados.join(', ')}`);
      
      const encabezadosRequeridos = [
        'id_unico', 'codigo_asignatura', 'nombre_asignatura', 'maestro',
        'edificio', 'salon', 'capacidad', 'grupo', 'dia_semana',
        'hora_inicio', 'hora_fin', 'duracion_min', 'modalidad', 'tipo'
      ];

      const encabezadosFaltantes = encabezadosRequeridos.filter(req => !encabezados.includes(req));
      if (encabezadosFaltantes.length > 0) {
        errores.push(`Encabezados faltantes: ${encabezadosFaltantes.join(', ')}`);
      }

      // Validar algunas filas de muestra
      for (let i = 1; i < Math.min(lineas.length, 6); i++) {
        const valores = this.parsearLineaCSV(lineas[i]);
        
        if (valores.length !== encabezados.length) {
          errores.push(`Fila ${i}: número incorrecto de columnas (${valores.length} vs ${encabezados.length})`);
        }
      }

    } catch (error) {
      errores.push(`Error parseando CSV: ${error.message}`);
    }

    const valido = errores.length === 0;
    if (!valido) {
      console.error(`❌ Validación CSV fallida para ${fileName}:`, errores);
    }

    return { valido, errores };
  }

  /**
   * Parsear línea CSV handling comillas y comas
   */
  parsearLineaCSV(linea) {
    const valores = [];
    let valorActual = '';
    let entreComillas = false;
    
    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];
      
      if (char === '"') {
        entreComillas = !entreComillas;
      } else if (char === ',' && !entreComillas) {
        valores.push(valorActual.trim());
        valorActual = '';
      } else {
        valorActual += char;
      }
    }
    
    valores.push(valorActual.trim());
    return valores;
  }

  /**
   * Parsear CSV completo con debug
   */
  parsearCSVDebug(contenido, fileName) {
    try {
      const lineas = contenido.split('\n').filter(linea => linea.trim() !== '');
      
      if (lineas.length < 2) {
        throw new Error('CSV debe tener al menos encabezados y una fila de datos');
      }

      const encabezados = this.parsearLineaCSV(lineas[0]);
      const datos = [];
      
      for (let i = 1; i < lineas.length; i++) {
        const valores = this.parsearLineaCSV(lineas[i]);
        
        if (valores.length === 1 && valores[0] === '') {
          continue; // Saltar líneas vacías
        }
        
        if (valores.length !== encabezados.length) {
          console.warn(`⚠️ Fila ${i} tiene ${valores.length} columnas, se esperaban ${encabezados.length}`);
          continue;
        }
        
        const fila = {};
        encabezados.forEach((encabezado, index) => {
          fila[encabezado] = valores[index] || '';
        });
        
        datos.push(fila);
      }
      
      console.log(`📊 CSV parseado: ${datos.length} filas válidas`);
      return datos;
      
    } catch (error) {
      throw new Error(`Error parseando CSV: ${error.message}`);
    }
  }

  /**
   * Detectar si una fila puede ser materia de tronco común
   */
  esPosibleTroncoComun(fila) {
    const codigo = fila.codigo_asignatura;
    const semestre = parseInt(fila.semestre);
    
    // Códigos conocidos de tronco común
    const codigosTroncoComun = ['38973', '38982'];
    
    return codigosTroncoComun.includes(codigo) || 
           (semestre === 1 || semestre === 2);
  }

  /**
   * Crear clase con manejo robusto de errores
   */
  crearClaseRobusta(fila) {
    try {
      // Validaciones básicas con mensajes específicos
      if (!fila.id_unico) {
        throw new Error('id_unico faltante');
      }
      
      if (!fila.codigo_asignatura) {
        throw new Error('codigo_asignatura faltante');
      }
      
      if (!fila.nombre_asignatura) {
        throw new Error('nombre_asignatura faltante');
      }
      
      if (!fila.grupo) {
        throw new Error('grupo faltante');
      }
      
      // Crear objeto clase con valores por defecto seguros
      const clase = {
        idUnico: fila.id_unico.trim(),
        codigoAsignatura: fila.codigo_asignatura.trim(),
        nombreAsignatura: fila.nombre_asignatura.trim(),
        maestro: fila.maestro ? fila.maestro.trim() : '',
        grupoId: fila.grupo.trim(),
        carrera: parseInt(fila.carrera) || 0,
        semestre: parseInt(fila.semestre) || 0,
        numeroGrupo: parseInt(fila.numeroGrupo) || 0,
        diaSemana: fila.dia_semana ? fila.dia_semana.trim() : '',
        horaInicio: fila.hora_inicio ? fila.hora_inicio.trim() : '',
        horaFin: fila.hora_fin ? fila.hora_fin.trim() : '',
        capacidadRequerida: parseInt(fila.capacidad) || 0,
        modalidad: fila.modalidad ? fila.modalidad.trim() : 'Presencial',
        tipo: fila.tipo ? fila.tipo.trim() : '',
        salonActual: fila.salon ? fila.salon.trim() : '',
        edificio: fila.edificio ? fila.edificio.trim() : ''
      };
      
      // Validaciones adicionales
      if (isNaN(clase.capacidadRequerida) || clase.capacidadRequerida <= 0) {
        throw new Error(`Capacidad inválida: ${fila.capacidad}`);
      }
      
      if (!['Presencial', 'Virtual'].includes(clase.modalidad)) {
        console.warn(`⚠️ Modalidad inusual: ${clase.modalidad}`);
      }
      
      return clase;
      
    } catch (error) {
      throw new Error(`Error creando clase: ${error.message} (datos: ${JSON.stringify(fila)})`);
    }
  }

  /**
   * Verificar si es laboratorio
   */
  esLaboratorio(clase) {
    const codigosLaboratorio = [
      '38973', '38982', // Tronco común
      '38984', '39038', '39039', '39040', '39041', '39042', // LIN
      '39043', '39044', '39047', '50600', '50601',
      '39048', '39049', '39050', '39051', '39058',
      '39056', '39052', '13595', '39057',
      '39060', '39062', '39061', '39063', '50602',
      '39067', '39068', '39076', '39083', '39088',
      '39025', // LC
      '39009',
      '39014',
      '40309' // LAE
    ];
    
    return codigosLaboratorio.includes(clase.codigoAsignatura);
  }

  /**
   * Verificar si es virtual
   */
  esVirtual(clase) {
    return clase.modalidad === 'Virtual' || clase.grupoId === 'VIR';
  }

  /**
   * Mostrar resumen final del debug
   */
  mostrarResumenDebug(resultados) {
    console.log('\n📋 RESUMEN FINAL DEL PROCESAMIENTO');
    console.log('=' * 50);
    
    const totalArchivos = resultados.length;
    const archivosExitosos = resultados.filter(r => r.exito).length;
    const totalClases = resultados.reduce((sum, r) => sum + (r.clasesProcesadas || 0), 0);
    const totalLaboratorio = resultados.reduce((sum, r) => sum + (r.laboratorioCount || 0), 0);
    const totalVirtuales = resultados.reduce((sum, r) => sum + (r.virtualesCount || 0), 0);
    const totalErrores = resultados.reduce((sum, r) => sum + (r.errores?.length || 0), 0);
    
    console.log(`📁 Archivos procesados: ${archivosExitosos}/${totalArchivos}`);
    console.log(`📚 Total clases: ${totalClases}`);
    console.log(`🔬 Clases laboratorio: ${totalLaboratorio}`);
    console.log(`💻 Clases virtuales: ${totalVirtuales}`);
    console.log(`❌ Total errores: ${totalErrores}`);
    console.log(`🧪 Materias Tronco Común detectadas: ${this.materiasTroncoComunDebug.length}`);
    
    if (this.materiasTroncoComunDebug.length > 0) {
      console.log('\n🔬 MATERIAS TRONCO COMÚN ENCONTRADAS:');
      this.materiasTroncoComunDebug.forEach(materia => {
        console.log(`   - ${materia.codigo} (Semestre ${materia.semestre}): ${materia.nombre}`);
      });
    }
    
    if (this.erroresEncontrados.length > 0) {
      console.log('\n❌ ERRORES ENCONTRADOS:');
      this.erroresEncontrados.forEach(error => {
        console.log(`   - ${error.archivo}: ${error.error}`);
      });
    }
  }
}

// ==========================================
// 2. SISTEMA DE ASIGNACIÓN CON DEBUG MEJORADO
// ==========================================

/**
 * Sistema de Asignación con capacidades de debug
 */
class SistemaAsignacionDebug {
  constructor() {
    this.procesador = new ProcesadorArchivosRobusto();
    this.debugMode = true;
    this.logs = [];
  }

  /**
   * Procesar archivos con debug completo
   */
  async procesarArchivosDebug(archivos) {
    this.log('🚀 Iniciando procesamiento con debug', 'info');
    
    try {
      const resultado = await this.procesador.procesarArchivosConDebug(archivos);
      
      if (resultado.exito) {
        this.log('✅ Procesamiento completado exitosamente', 'success');
      } else {
        this.log('⚠️ Procesamiento completado con errores', 'warning');
      }
      
      return resultado;
      
    } catch (error) {
      this.log(`💥 Error crítico: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Sistema de logging
   */
  log(mensaje, nivel = 'info') {
    const entrada = {
      timestamp: new Date().toISOString(),
      nivel,
      mensaje
    };
    
    this.logs.push(entrada);
    
    // Colorear console output
    const colores = {
      info: '#2196F3',
      success: '#4CAF50', 
      warning: '#FF9800',
      error: '#F44336'
    };
    
    console.log(`%c[${nivel.toUpperCase()}] ${mensaje}`, `color: ${colores[nivel] || '#000'}`);
  }

  /**
   * Obtener logs para análisis
   */
  obtenerLogs() {
    return this.logs;
  }

  /**
   * Limpiar logs
   */
  limpiarLogs() {
    this.logs = [];
  }
}

// ==========================================
// 3. UTILIDADES PARA DEBUG DE TRONCO COMÚN
// ==========================================

/**
 * Utilidades específicas para debug de materias de Tronco Común
 */
class DebugTroncoComun {
  constructor() {
    this.materiasConocidas = {
      1: {
        codigo: '38973',
        nombre: 'Introducción a la Ingeniería en Sistemas',
        caracteristicas: ['Laboratorio requerido', 'Primer semestre']
      },
      2: {
        codigo: '38982', 
        nombre: 'Programación I',
        caracteristicas: ['Laboratorio requerido', 'Segundo semestre']
      }
    };
  }

  /**
   * Analizar una materia específica
   */
  analizarMateria(codigo, semestre, nombre) {
    const materia = this.materiasConocidas[semestre];
    
    if (!materia) {
      return {
        esTroncoComun: false,
        razon: `No hay materia conocida para semestre ${semestre}`,
        codigo,
        semestre,
        nombre
      };
    }

    if (materia.codigo === codigo) {
      return {
        esTroncoComun: true,
        razon: 'Código coincide con base de datos',
        materia: materia,
        codigo,
        semestre,
        nombre
      };
    }

    return {
      esTroncoComun: false,
      razon: `Código ${codigo} no coincide con esperado ${materia.codigo}`,
      materiaEsperada: materia,
      codigo,
      semestre,
      nombre
    };
  }

  /**
   * Generar reporte de materias de laboratorio
   */
  generarReporteLaboratorio(materiasEncontradas) {
    const reporte = {
      totalMaterias: materiasEncontradas.length,
      troncoComun: [],
      otros: [],
      posiblesErrores: []
    };

    materiasEncontradas.forEach(materia => {
      const analisis = this.analizarMateria(materia.codigo, materia.semestre, materia.nombre);
      
      if (analisis.esTroncoComun) {
        reporte.troncoComun.push(analisis);
      } else {
        reporte.otros.push(analisis);
        
        if (materia.semestre <= 2 && !analisis.esTroncoComun) {
          reporte.posiblesErrores.push({
            ...analisis,
            sugerencia: 'Materia de semestre bajo que no es Tronco Común conocida'
          });
        }
      }
    });

    return reporte;
  }
}

// ==========================================
// 4. FUNCIÓN PRINCIPAL DE DEBUG
// ==========================================

/**
 * Función principal para debug completo del sistema
 */
async function debugCompletoSistema() {
  console.log('🔍 INICIANDO DEBUG COMPLETO DEL SISTEMA');
  console.log('=' * 60);
  
  const debugTronco = new DebugTroncoComun();
  const sistemaDebug = new SistemaAsignacionDebug();
  
  // Capturar archivos del input
  const inputArchivos = document.getElementById('input-archivos');
  
  if (!inputArchivos || !inputArchivos.files || inputArchivos.files.length === 0) {
    console.error('❌ No se encontraron archivos para procesar');
    return;
  }
  
  try {
    // Procesar con debug
    const resultado = await sistemaDebug.procesarArchivosDebug(inputArchivos.files);
    
    // Generar reporte específico de Tronco Común
    if (resultado.debug && resultado.debug.materiasTroncoComun) {
      console.log('\n🔬 GENERANDO REPORTE DE TRONCO COMÚN');
      const reporteTronco = debugTronco.generarReporteLaboratorio(resultado.debug.materiasTroncoComun);
      
      console.log('📊 REPORTE DE MATERIAS DE LABORATORIO:');
      console.log(`   - Total materias: ${reporteTronco.totalMaterias}`);
      console.log(`   - Tronco Común: ${reporteTronco.troncoComun.length}`);
      console.log(`   - Otros laboratorios: ${reporteTronco.otros.length}`);
      console.log(`   - Posibles errores: ${reporteTronco.posiblesErrores.length}`);
      
      if (reporteTronco.troncoComun.length > 0) {
        console.log('\n✅ MATERIAS TRONCO COMÚN CONFIRMADAS:');
        reporteTronco.troncoComun.forEach(materia => {
          console.log(`   - ${materia.materia.nombre} (${materia.codigo})`);
        });
      }
      
      if (reporteTronco.posiblesErrores.length > 0) {
        console.log('\n⚠️ POSIBLES ERRORES DETECTADOS:');
        reporteTronco.posiblesErrores.forEach(error => {
          console.log(`   - ${error.nombre} (${error.codigo}): ${error.sugerencia}`);
        });
      }
    }
    
    // Mostrar logs completos
    console.log('\n📋 LOGS COMPLETOS DEL PROCESAMIENTO:');
    sistemaDebug.obtenerLogs().forEach(log => {
      console.log(`[${log.timestamp}] ${log.nivel.toUpperCase()}: ${log.mensaje}`);
    });
    
    return resultado;
    
  } catch (error) {
    console.error('💥 ERROR EN DEBUG COMPLETO:', error);
    throw error;
  }
}

// ==========================================
// 5. INTEGRACIÓN CON EL SISTEMA ACTUAL
// ==========================================

/**
 * Patch para integrar el debug con el sistema actual
 */
function aplicarPatchDebug() {
  // Sobrescribir la función de procesamiento en main.js
  if (typeof window !== 'undefined') {
    window.debugCompletoSistema = debugCompletoSistema;
    window.DebugTroncoComun = DebugTroncoComun;
    window.SistemaAsignacionDebug = SistemaAsignacionDebug;
    
    console.log('🔧 Patch de debug aplicado. Usa debugCompletoSistema() para debug completo.');
  }
}

// Aplicar patch automáticamente si estamos en el navegador
if (typeof window !== 'undefined') {
  aplicarPatchDebug();
}

// Exportar para uso en Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ProcesadorArchivosRobusto,
    SistemaAsignacionDebug,
    DebugTroncoComun,
    debugCompletoSistema
  };
}