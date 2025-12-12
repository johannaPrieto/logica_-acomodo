import Grupo from '../models/Grupo.js';
import Horario from '../models/Horario.js';
import Clase from '../models/Clase.js';
import Salon from '../models/Salon.js';
import { CONFIG } from '../utils/config.js';
import procesarArchivoCSV from '../utils/fileProcessor.js';
import validarSalonParaGrupo from '../utils/validators.js';
import radixSortClases from '../utils/radixSort.js';

class SistemaAsignacion {
  constructor() {
    this.salones = [];
    this.grupos = new Map();
    this.clases = []; // Solo clases presenciales (no virtuales ni laboratorio LNI)
    this.asignaciones = [];
    this.errores = [];
    this.clasesLaboratorio = []; // Incluye laboratorio LIN y tronco común
    this.clasesVirtuales = []; // Nueva propiedad para clases virtuales
    this.clasesPorGrupoDia = new Map();
    this.todasLasClasesPorGrupoDia = new Map(); // Incluye presenciales y virtuales
    
    // Materias de laboratorio de tronco común por semestre (códigos)
    this.materiasLaboratorioTroncoComun = {
      1: ["38973"],
      2: ["38982"]
    };

    // Materias de laboratorio LIN por semestre (códigos)
    this.materiasLaboratorioLNI = {
      3: ["38984", "39038", "39039", "39040", "39041", "39042"],
      4: ["39043", "39044", "39047", "50600", "50601"],
      5: ["39048", "39049", "39050", "39051", "39058"],
      6: ["39056", "39052", "13595"],
      7: ["39060", "39062", "39061", "39063", "50602"],
      8: ["39067", "39068", "39076", "39083", "39088"]
    };

    // Materias de laboratorio LC por semestre (códigos)
    this.materiasLaboratorioLC = {
      6: ["39025"],
      7: ["39009"],
      8: ["39014"]
    };

    // Materias de laboratorio LAE por semestre (códigos)
    this.materiasLaboratorioLAE = {
      4: ["40309"]
    };
  }

  /**
   * Inicializa los salones disponibles en el sistema
   */
  inicializarSalones() {
    for (const [edificio, config] of Object.entries(CONFIG.edificios)) {
      const { pisos, salonesPorPiso } = config;
      for (let piso = 1; piso <= pisos; piso++) {
        const cantidad = salonesPorPiso[piso - 1];
        this.crearSalonesPorPiso(edificio, piso, cantidad);
      }
    }
  }

  /**
   * Crea salones para un piso específico de un edificio
   * @param {string} edificio - Identificador del edificio
   * @param {number} piso - Número del piso
   * @param {number} cantidad - Cantidad de salones en el piso
   */
  crearSalonesPorPiso(edificio, piso, cantidad) {
    for (let i = 1; i <= cantidad; i++) {
      const id = `${edificio}-${piso}${i.toString().padStart(2, '0')}`;
      const accesible = piso === 1;
      this.salones.push(new Salon(id, edificio, piso, 40, accesible));
    }
  }

  /**
   * Procesa múltiples archivos CSV de forma concurrente
   * @param {Array} archivos - Lista de archivos a procesar
   * @returns {Object} Resultado del procesamiento
   */
  async procesarMultiplesArchivos(archivos) {
    try {
      // Convertir FileList a Array si es necesario
      const archivosArray = Array.from(archivos);

      if (archivosArray.length !== 5) {
        throw new Error('ARCHIVOS_INSUFICIENTES: Se requieren 5 archivos (uno por carrera)');
      }

      // Procesar archivos en paralelo para mejorar rendimiento
      await Promise.all(archivosArray.map(archivo => this.procesarArchivoIndividual(archivo)));

      return {
        exito: true,
        mensaje: `Procesamiento completado. ${this.clases.length} clases procesadas.`,
        clases: this.clases
      };
    } catch (error) {
      return {
        exito: false,
        mensaje: error.message
      };
    }
  }

  /**
   * Procesa un archivo CSV individual
   * @param {File} archivo - Archivo CSV a procesar
   */
  async procesarArchivoIndividual(archivo) {
    const datosCSV = await procesarArchivoCSV(archivo);
    
    for (const fila of datosCSV) {
      try {
        const clase = new Clase(fila);
        this.procesarClase(clase);
      } catch (error) {
        this.errores.push({
          clase: fila,
          mensaje: `Error procesando fila: ${error.message}`
        });
      }
    }
  }

  /**
   * Procesa una clase individual según su tipo
   * @param {Clase} clase - Clase a procesar
   */
  procesarClase(clase) {
    const tipoLaboratorio = this.esMateriaLaboratorio(clase);
    
    if (tipoLaboratorio) {
      this.procesarClaseLaboratorio(clase, tipoLaboratorio);
    } else if (clase.modalidad === 'Virtual') {
      this.procesarClaseVirtual(clase);
    } else {
      this.procesarClasePresencial(clase);
    }
    
    // Agregar a todas las clases por grupo y día
    this.agregarClaseATodasLasClasesPorGrupoDia(clase);
  }

  /**
   * Procesa una clase de laboratorio
   * @param {Clase} clase - Clase de laboratorio
   * @param {string} tipoLaboratorio - Tipo de laboratorio
   */
  procesarClaseLaboratorio(clase, tipoLaboratorio) {
    this.clasesLaboratorio.push({
      clase,
      tipo: tipoLaboratorio,
      motivo: clase._motivoLaboratorio || 'codigo', // 'codigo' o 'carrera'
      mensaje: `${clase.diaSemana} ${clase.horaInicio} - ${clase.horaFin}`
    });
  }

  /**
   * Procesa una clase virtual
   * @param {Clase} clase - Clase virtual
   */
  procesarClaseVirtual(clase) {
    this.clasesVirtuales.push({
      clase,
      mensaje: 'Clase virtual - no requiere salón'
    });
  }

  /**
   * Procesa una clase presencial
   * @param {Clase} clase - Clase presencial
   */
  procesarClasePresencial(clase) {
    this.clases.push(clase);
    
    // Crear o actualizar grupo
    if (!this.grupos.has(clase.grupoId)) {
      this.grupos.set(clase.grupoId, new Grupo(
        clase.grupoId,
        clase.carrera,
        clase.semestre,
        clase.numeroGrupo,
        clase.capacidadRequerida
      ));
    } else {
      // Actualizar capacidad máxima del grupo
      const grupo = this.grupos.get(clase.grupoId);
      if (clase.capacidadRequerida > grupo.cantidadAlumnos) {
        grupo.cantidadAlumnos = clase.capacidadRequerida;
      }
    }
    
    // Agregar a clases por grupo y día
    const clave = `${clase.grupoId}-${clase.diaSemana}`;
    if (!this.clasesPorGrupoDia.has(clave)) {
      this.clasesPorGrupoDia.set(clave, []);
    }
    this.clasesPorGrupoDia.get(clave).push(clase);
  }

  /**
   * Agrega una clase al registro de todas las clases por grupo y día
   * @param {Clase} clase - Clase a agregar
   */
  agregarClaseATodasLasClasesPorGrupoDia(clase) {
    const clave = `${clase.grupoId}-${clase.diaSemana}`;
    
    if (!this.todasLasClasesPorGrupoDia.has(clave)) {
      this.todasLasClasesPorGrupoDia.set(clave, []);
    }
    
    this.todasLasClasesPorGrupoDia.get(clave).push(clase);
  }

  /**
   * Verifica si una materia es de laboratorio y retorna su tipo
   * @param {Clase} clase - Clase a verificar
   * @returns {string|null} Tipo de laboratorio o null si no aplica
   */
  esMateriaLaboratorio(clase) {
    if (!clase.semestre) return null;

    // Verificar si es materia de laboratorio de tronco común
    if (this.materiasLaboratorioTroncoComun[clase.semestre]?.includes(clase.codigoAsignatura)) {
      // marcar motivo por carrera (tronco común detectado por lista fija)
      clase._motivoLaboratorio = 'carrera';
      return 'Tronco Común';
    }

    // Verificar si es materia de laboratorio LNI/LIN (basado en código y semestre)
    // Nota: no depender de `clase.carrera` ya que el primer dígito de `grupoId`
    // puede no coincidir con el identificador esperado. Se detecta por código.
    if (this.materiasLaboratorioLNI[clase.semestre]?.includes(clase.codigoAsignatura)) {
      clase._motivoLaboratorio = 'codigo';
      return 'LIN';
    }

    // Verificar si es materia de laboratorio LC (Licenciatura en Contaduría)
    if (this.materiasLaboratorioLC[clase.semestre]?.includes(clase.codigoAsignatura)) {
      clase._motivoLaboratorio = 'codigo';
      return 'LC';
    }

    // Verificar si es materia de laboratorio LAE (Licenciatura en Administración de Empresas)
    if (this.materiasLaboratorioLAE[clase.semestre]?.includes(clase.codigoAsignatura)) {
      clase._motivoLaboratorio = 'codigo';
      return 'LAE';
    }

    return null;
  }

  /**
   * Obtiene el bloque horario de un grupo en un día específico
   * @param {string} grupoId - ID del grupo
   * @param {string} dia - Día de la semana
   * @returns {Object|null} Bloque horario o null si no existe
   */
  obtenerBloqueGrupoDia(grupoId, dia) {
    const clave = `${grupoId}-${dia}`;
    const clases = this.clasesPorGrupoDia.get(clave) || [];
    
    if (clases.length === 0) return null;
    
    // Encontrar hora de inicio más temprana y hora de fin más tardía
    let horaInicioMin = '23:59';
    let horaFinMax = '00:00';
    
    clases.forEach(clase => {
      if (clase.horaInicio < horaInicioMin) horaInicioMin = clase.horaInicio;
      if (clase.horaFin > horaFinMax) horaFinMax = clase.horaFin;
    });
    
    return {
      nombre: 'Horario Grupo',
      inicio: horaInicioMin,
      fin: horaFinMax,
      bloqueOriginal: null
    };
  }

  /**
   * Busca un salón disponible para un grupo y horario
   * @param {Grupo} grupo - Grupo que necesita salón
   * @param {Horario} horario - Horario requerido
   * @returns {Salon|null} Salón disponible o null si no hay
   */
  buscarSalonDisponible(grupo, horario) {
    // Filtrar salones que cumplan con las condiciones básicas
    const salonesCandidatos = this.salones.filter(salon => {
      try {
        validarSalonParaGrupo(salon, grupo, horario);
        return true;
      } catch (error) {
        return false;
      }
    });
    
    if (salonesCandidatos.length === 0) return null;
    
    // Ordenar por capacidad ascendente para asignar el más ajustado
    return salonesCandidatos.sort((a, b) => a.capacidad - b.capacidad)[0];
  }

  /**
   * Genera un reporte completo del estado del sistema
   * @param {Map} gruposDivididos - Información de grupos divididos (opcional)
   * @returns {Object} Reporte detallado
   */
  generarReporte(gruposDivididos = null) {
    return {
      resumen: {
        totalClases: this.clases.length + this.clasesVirtuales.length + this.clasesLaboratorio.length,
        clasesPresenciales: this.clases.length,
        clasesVirtuales: this.clasesVirtuales.length,
        clasesLaboratorio: this.clasesLaboratorio.length,
        asignadas: this.asignaciones.length,
        errores: this.errores.length,
        gruposDivididos: gruposDivididos ? gruposDivididos.size : 0
      },
      detalleAsignacionesBloques: this.generarDetalleAsignacionesBloques(),
      detalleAsignaciones: this.asignaciones.map(a => ({
        clase: a.clase.nombreAsignatura,
        grupo: a.clase.grupoId,
        salon: a.salon ? a.salon.id : 'Virtual',
        dia: a.clase.diaSemana,
        horario: `${a.clase.horaInicio} - ${a.clase.horaFin}`
      })),
      detalleErrores: this.errores.map(e => ({
        clase: e.clase.nombreAsignatura,
        grupo: e.clase.grupoId,
        error: e.mensaje
      })),
      detalleLaboratorio: this.clasesLaboratorio.map(c => ({
        clase: c.clase.nombreAsignatura,
        grupo: c.clase.grupoId,
        tipo: c.tipo,
        motivo: c.motivo || (c.clase && c.clase._motivoLaboratorio) || 'desconocido',
        semestre: c.clase.semestre,
        carrera: c.clase.carrera,
        salon: c.clase.salonActual || 'No asignado',
        mensaje: c.mensaje
      })),
      detalleVirtuales: this.clasesVirtuales.map(c => ({
        clase: c.clase.nombreAsignatura,
        grupo: c.clase.grupoId,
        mensaje: c.mensaje
      })),
      detalleGruposDivididos: gruposDivididos ? this.generarDetalleGruposDivididos(gruposDivididos) : []
    };
  }

  /**
   * Genera el detalle de asignaciones por bloques
   * @returns {Array} Lista de asignaciones por bloques
   */
  generarDetalleAsignacionesBloques() {
    const detalle = [];

    this.salones.forEach(salon => {
      if (salon.asignacionesBloques) {
        salon.asignacionesBloques.forEach(asig => {
          const clave = `${asig.grupoId}-${asig.dia}`;
          const clasesGrupoDia = this.clasesPorGrupoDia.get(clave) || [];
          const asignaturas = clasesGrupoDia.map(c => c.nombreAsignatura).join(', ');

          detalle.push({
            salon: salon.id,
            dia: asig.dia,
            horario: `${asig.horario.horaInicio} - ${asig.horario.horaFin}`,
            grupo: asig.grupoId,
            asignaturas
          });
        });
      }
    });

    return detalle;
  }

  /**
   * Genera el detalle de grupos divididos
   * @param {Map} gruposDivididos - Mapa de grupos divididos
   * @returns {Array} Lista de grupos divididos
   */
  generarDetalleGruposDivididos(gruposDivididos) {
    const detalle = [];

    for (const [grupoId, info] of gruposDivididos) {
      const salon1 = info.salones[0];
      const salon2 = info.salones[1];
      const dias1 = info.dias[salon1.id].join(', ');
      const dias2 = info.dias[salon2.id].join(', ');

      detalle.push({
        grupo: grupoId,
        salon1: salon1.id,
        salon2: salon2.id,
        edificio1: salon1.edificio,
        edificio2: salon2.edificio,
        piso1: salon1.piso,
        piso2: salon2.piso,
        dias1: dias1,
        dias2: dias2,
        distancia: this.calcularDistanciaSalones(salon1, salon2)
      });
    }

    return detalle;
  }

  /**
   * Calcula la distancia conceptual entre dos salones
   * @param {Salon} salon1 - Primer salón
   * @param {Salon} salon2 - Segundo salón
   * @returns {string} Descripción de la distancia
   */
  calcularDistanciaSalones(salon1, salon2) {
    if (salon1.edificio !== salon2.edificio) {
      return `Edificios diferentes (${salon1.edificio} ↔ ${salon2.edificio})`;
    }

    if (salon1.piso !== salon2.piso) {
      const diffPiso = Math.abs(salon1.piso - salon2.piso);
      return `Mismo edificio, ${diffPiso} piso(s) de diferencia`;
    }

    // Extraer números de los IDs para calcular proximidad
    const num1 = parseInt(salon1.id.replace(/^\w-/, ''));
    const num2 = parseInt(salon2.id.replace(/^\w-/, ''));
    const diffNum = Math.abs(num1 - num2);

    if (diffNum === 0) {
      return 'Mismo salón';
    } else if (diffNum <= 2) {
      return 'Muy cercano (≤2 salones)';
    } else if (diffNum <= 5) {
      return 'Cercano (≤5 salones)';
    } else {
      return 'Distante (>5 salones)';
    }
  }

  /**
   * Ordena las clases usando grupos prioritarios
   * @param {Array} gruposPrioritarios - Lista de grupos prioritarios
   * @returns {Array} Clases ordenadas
   */
  ordenarClasesConPrioridades(gruposPrioritarios = []) {
    this.clases = radixSortClases(this.clases, gruposPrioritarios);
    // Reconstruir el mapa de clases por grupo y día después de ordenar
    this.reconstruirClasesPorGrupoDia();
    return this.clases;
  }

  /**
   * Reconstruye el mapa de clases por grupo y día
   */
  reconstruirClasesPorGrupoDia() {
    this.clasesPorGrupoDia = new Map();
    
    this.clases.forEach(clase => {
      const clave = `${clase.grupoId}-${clase.diaSemana}`;
      
      if (!this.clasesPorGrupoDia.has(clave)) {
        this.clasesPorGrupoDia.set(clave, []);
      }
      
      this.clasesPorGrupoDia.get(clave).push(clase);
    });
  }

  /**
   * Genera datos para exportación a CSV
   * @returns {Array} Datos formateados para exportación
   */
  generarDatosExportacion() {
    const datos = [];
    
    // Procesar asignaciones exitosas
    this.asignaciones.forEach(asignacion => {
      const { clase, salon } = asignacion;
      const bloqueInfo = this.obtenerBloqueAsignacion(salon, clase);
      
      datos.push({
        Grupo: clase.grupoId,
        Carrera: clase.carrera,
        Semestre: clase.semestre,
        'Número Grupo': clase.numeroGrupo,
        'Día': clase.diaSemana,
        'Hora Inicio': clase.horaInicio,
        'Hora Fin': clase.horaFin,
        'Asignatura': clase.nombreAsignatura,
        'Capacidad Requerida': clase.capacidadRequerida,
        'Salón Asignado': salon.id,
        'Edificio': salon.edificio,
        'Piso': salon.piso,
        'Capacidad Salón': salon.capacidad,
        'Accesible': salon.accesible ? 'Sí' : 'No',
        'Horario': bloqueInfo || 'N/A'
      });
    });
    
    // Procesar errores
    this.errores.forEach(error => {
      const clase = error.clase;
      datos.push({
        Grupo: clase.grupoId,
        Carrera: clase.carrera,
        Semestre: clase.semestre,
        'Número Grupo': clase.numeroGrupo,
        'Día': clase.diaSemana,
        'Hora Inicio': clase.horaInicio,
        'Hora Fin': clase.horaFin,
        'Asignatura': clase.nombreAsignatura,
        'Capacidad Requerida': clase.capacidadRequerida,
        'Salón Asignado': 'NO ASIGNADO',
        'Edificio': 'N/A',
        'Piso': 'N/A',
        'Capacidad Salón': 'N/A',
        'Accesible': 'N/A',
        'Bloque': 'N/A'
      });
    });
    
    return this.ordenarDatosExportacion(datos);
  }

  /**
   * Obtiene información del bloque de una asignación
   * @param {Salon} salon - Salón asignado
   * @param {Clase} clase - Clase asignada
   * @returns {string|null} Información del bloque o null
   */
  obtenerBloqueAsignacion(salon, clase) {
    const bloqueInfo = salon.asignacionesBloques?.find(b => 
      b.grupoId === clase.grupoId && b.dia === clase.diaSemana
    );
    
    return bloqueInfo ? `${bloqueInfo.horario.horaInicio} - ${bloqueInfo.horario.horaFin}` : null;
  }

  /**
   * Ordena datos para exportación por grupo, día y hora
   * @param {Array} datos - Datos a ordenar
   * @returns {Array} Datos ordenados
   */
  ordenarDatosExportacion(datos) {
    const diasOrden = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    return datos.sort((a, b) => {
      if (a.Grupo !== b.Grupo) return a.Grupo.localeCompare(b.Grupo);
      if (a['Día'] !== b['Día']) {
        return diasOrden.indexOf(a['Día']) - diasOrden.indexOf(b['Día']);
      }
      return a['Hora Inicio'].localeCompare(b['Hora Inicio']);
    });
  }

  /**
   * Convierte datos a formato CSV
   * @param {Array} datos - Datos a convertir
   * @returns {string} Contenido CSV
   */
  convertirA_CSV(datos) {
    if (datos.length === 0) return '';
    
    const headers = Object.keys(datos[0]);
    const csvRows = [headers.join(',')];
    
    datos.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escapar comillas y envolver en comillas si contiene coma o comillas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }

  /**
   * Reserva un salón para un grupo (asignación fija)
   * @param {Salon} salon - Salón a reservar
   * @param {Grupo} grupo - Grupo para el salón
   */
  reservarSalonParaGrupo(salon, grupo) {
    if (!this.grupos.has(grupo.id)) {
      throw new Error(`Grupo ${grupo.id} no encontrado`);
    }
    
    // Marcar el salón como asignado fijo para este grupo
    salon.grupoAsignadoFijo = grupo.id;
    
    // Ocupar el salón para todas las clases del grupo
    const diasGrupo = this.obtenerDiasGrupo(grupo.id);
    
    diasGrupo.forEach(dia => {
      const bloque = this.obtenerBloqueGrupoDia(grupo.id, dia);
      if (bloque) {
        const horario = new Horario(bloque.inicio, bloque.fin);
        salon.ocupar(dia, horario, grupo.id);
      }
    });
  }

  /**
   * Obtiene los días en que un grupo tiene clases
   * @param {string} grupoId - ID del grupo
   * @returns {Set} Conjunto de días
   */
  obtenerDiasGrupo(grupoId) {
    const dias = new Set();
    for (const [clave] of this.clasesPorGrupoDia.entries()) {
      if (clave.startsWith(`${grupoId}-`)) {
        const dia = clave.split('-')[1];
        dias.add(dia);
      }
    }
    return dias;
  }

  /**
   * Verifica si un salón está disponible para todas las clases de un grupo
   * @param {Salon} salon - Salón a verificar
   * @param {Grupo} grupo - Grupo a verificar
   * @returns {boolean} True si está disponible
   */
  salonDisponibleParaTodasLasClases(salon, grupo) {
    const diasGrupo = this.obtenerDiasGrupo(grupo.id);
    
    for (const dia of diasGrupo) {
      const bloque = this.obtenerBloqueGrupoDia(grupo.id, dia);
      if (bloque) {
        const horario = new Horario(bloque.inicio, bloque.fin);
        try {
          validarSalonParaGrupo(salon, grupo, horario);
        } catch (error) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Libera un salón para un grupo específico
   * @param {Salon} salon - Salón a liberar
   * @param {string} grupoId - ID del grupo
   */
  liberarSalonParaGrupo(salon, grupoId) {
    // Remover la asignación fija
    if (salon.grupoAsignadoFijo === grupoId) {
      salon.grupoAsignadoFijo = null;
    }
    
    // Remover horarios ocupados y asignaciones de bloques para este grupo
    salon.horariosOcupados = salon.horariosOcupados.filter(h => h.grupoId !== grupoId);
    salon.asignacionesBloques = salon.asignacionesBloques.filter(asig => asig.grupoId !== grupoId);
  }

  /**
   * Descarga los datos de asignación en formato CSV
   */
  descargarCSV() {
    const datos = this.generarDatosExportacion();
    const csv = this.convertirA_CSV(datos);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `asignacion_salones_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

export default SistemaAsignacion;