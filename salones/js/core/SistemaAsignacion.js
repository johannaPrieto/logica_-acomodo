
import Grupo from '../models/Grupo.js';
import Horario from '../models/Horario.js';
import Clase from '../models/Clase.js';
import Salon from '../models/Salon.js';
import procesarArchivoCSV from '../utils/fileProcessor.js';
import validarSalonParaGrupo from '../utils/validators.js';
import radixSortClases from '../utils/radixSort.js';

// Importar aquí para evitar dependencias circulares

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
    
    // Lista de materias de laboratorio de tronco común por semestre (aplicable a todas las carreras)
    this.materiasLaboratorioTroncoComun = {
      1: [
        "Herramientas Digitales"
      ],
      2: [
        "Introducción a la Inteligencia de Negocios"
      ]
    };

    // Lista de materias de laboratorio LIN por semestre
    this.materiasLaboratorioLNI = {
      3: [
        "Analisis de procesos",
        "Datos de negocios",
        "Programacion",
        "Estadistica inferencial",
        "Fundamentos de redes"
      ],
      4: [
        "Base datos",
        "Analisis infraestructura tecnologica",
        "Programacion estadistica",
        "Fundamentos de Análisis y Modelado para Negocios",
        "Programación Avanzada",
        "Paradigmas de Programación y Gestión de Datos"
      ],
      5: [
        "Base datos Avanzada",
        "Programacion para la extraccion de datos",
        "Seguridad informatica",
        "Tecnologia digital para la informacion",
        "Tecnologías Digitales para la Innovación"
      ],
      6: [
        "Big data",
        "Metodologías y Herramientas para la Innovación"
      ],
      7: [
        "Ciencias de datos",
        "Patrones de comportamiento de datos"
      ],
      8: [
        "Computacion en la nube",
        "Machine learning"
      ]
    };
    
    // Definir bloques de tiempo
    this.bloquesTiempo = [
      { nombre: 'Mañana', inicio: '07:00', fin: '13:00' },
      { nombre: 'Tarde', inicio: '12:00', fin: '18:00' },
      { nombre: 'Noche', inicio: '18:00', fin: '22:00' }
    ];
  }

  // Inicializar salones disponibles
  inicializarSalones() {
    // Edificio F: 4 salones por piso (16 salones total)
    for (let piso = 1; piso <= 4; piso++) {
      for (let i = 1; i <= 4; i++) {
        const id = `F-${piso}${i.toString().padStart(2, '0')}`;
        const accesible = piso === 1;
        this.salones.push(new Salon(id, 'F', piso, 40, accesible));
      }
    }

    // Edificio E: Piso 1-3: 6 salones, Piso 4: 5 salones (23 salones total)
    for (let piso = 1; piso <= 4; piso++) {
      const cantidadSalones = piso === 4 ? 5 : 6;
      for (let i = 1; i <= cantidadSalones; i++) {
        const id = `E-${piso}${i.toString().padStart(2, '0')}`;
        const accesible = piso === 1;
        this.salones.push(new Salon(id, 'E', piso, 40, accesible));
      }
    }

    // Edificio D: 6 salones por piso (24 salones total)
    for (let piso = 1; piso <= 4; piso++) {
      for (let i = 1; i <= 6; i++) {
        const id = `D-${piso}${i.toString().padStart(2, '0')}`;
        const accesible = piso === 1;
        this.salones.push(new Salon(id, 'D', piso, 40, accesible));
      }
    }
  }

  // Procesar múltiples archivos CSV
  async procesarMultiplesArchivos(archivos) {
    try {
      // Validar que se hayan proporcionado 5 archivos
      if (archivos.length !== 5) {
        throw new Error('ARCHIVOS_INSUFICIENTES: Se requieren 5 archivos (uno por carrera)');
      }

      // Procesar cada archivo
      for (const archivo of archivos) {
        await this.procesarArchivoIndividual(archivo);
      }

      // Nota: El ordenamiento Radix se hará después de seleccionar grupos prioritarios

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

  // Procesar un archivo CSV individual
  async procesarArchivoIndividual(archivo) {
    const datosCSV = await procesarArchivoCSV(archivo);
    
    // Procesar cada fila del CSV
    for (const fila of datosCSV) {
      const clase = new Clase(fila);
      
      // Verificar si es una materia de laboratorio
      if (this.esMateriaLaboratorio(clase)) {
        // Agregar a la lista de clases de laboratorio
        this.clasesLaboratorio.push({
          clase,
          mensaje: 'Materia de laboratorio - no requiere asignación de salón'
        });
        
        // Agregar a todas las clases por grupo y día (para tener el horario completo)
        this.agregarClaseATodasLasClasesPorGrupoDia(clase);
        continue; // Saltar al siguiente registro
      }
      
      // Si es virtual, no necesita salón
      if (clase.modalidad === 'Virtual') {
        // Agregar a la lista de clases virtuales
        this.clasesVirtuales.push({
          clase,
          mensaje: 'Clase virtual - no requiere salón'
        });
        
        // Agregar a todas las clases por grupo y día (para tener el horario completo)
        this.agregarClaseATodasLasClasesPorGrupoDia(clase);
        continue; // Saltar al siguiente registro
      }
      
      // Agregar clase al sistema (solo clases presenciales que no son laboratorio LNI)
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
      
      // Agregar a todas las clases por grupo y día (para tener el horario completo)
      this.agregarClaseATodasLasClasesPorGrupoDia(clase);
    }
    
    // Agrupar clases por grupo y día (solo clases presenciales)
    this.agruparClasesPorGrupoDia();
  }

  // Nuevo método para agregar una clase a todas las clases por grupo y día
  agregarClaseATodasLasClasesPorGrupoDia(clase) {
    const clave = `${clase.grupoId}-${clase.diaSemana}`;
    
    if (!this.todasLasClasesPorGrupoDia.has(clave)) {
      this.todasLasClasesPorGrupoDia.set(clave, []);
    }
    
    this.todasLasClasesPorGrupoDia.get(clave).push(clase);
  }

  // Nuevo método para agrupar clases por grupo y día (solo presenciales)
  agruparClasesPorGrupoDia() {
    this.clasesPorGrupoDia = new Map();

    this.clases.forEach(clase => {
      const clave = `${clase.grupoId}-${clase.diaSemana}`;

      if (!this.clasesPorGrupoDia.has(clave)) {
        this.clasesPorGrupoDia.set(clave, []);
      }

      this.clasesPorGrupoDia.get(clave).push(clase);
    });
  }

  // Nuevo método para verificar si es materia de laboratorio
  esMateriaLaboratorio(clase) {
    // Verificar que el semestre esté definido
    if (!clase.semestre) {
      return false;
    }

    // Primero verificar si es materia de laboratorio de tronco común (aplicable a todas las carreras)
    if (this.materiasLaboratorioTroncoComun[clase.semestre] &&
        this.materiasLaboratorioTroncoComun[clase.semestre].includes(clase.nombreAsignatura)) {
      return true;
    }

    // Si no es de tronco común, verificar si es de la carrera LNI (carrera 3)
    if (clase.carrera !== 3) {
      return false;
    }

    // Verificar si el semestre tiene materias de laboratorio LNI definidas
    if (!this.materiasLaboratorioLNI[clase.semestre]) {
      return false;
    }

    // Verificar si la asignatura está en la lista de laboratorio LNI para ese semestre
    return this.materiasLaboratorioLNI[clase.semestre].includes(clase.nombreAsignatura);
  }

  // Obtener el bloque de tiempo para un grupo en un día (solo presenciales)
  obtenerBloqueGrupoDia(grupoId, dia) {
    const clave = `${grupoId}-${dia}`;
    const clases = this.clasesPorGrupoDia.get(clave) || [];

    if (clases.length === 0) {
      return null;
    }
    
    // Encontrar la hora de inicio más temprana y la hora de fin más tardía
    let horaInicioMin = '23:59';
    let horaFinMax = '00:00';
    
    clases.forEach(clase => {
      if (clase.horaInicio < horaInicioMin) {
        horaInicioMin = clase.horaInicio;
      }
      if (clase.horaFin > horaFinMax) {
        horaFinMax = clase.horaFin;
      }
    });
    
    // Determinar a qué bloque pertenece
    for (const bloque of this.bloquesTiempo) {
      if (horaInicioMin >= bloque.inicio && horaFinMax <= bloque.fin) {
        return {
          nombre: bloque.nombre,
          inicio: horaInicioMin,
          fin: horaFinMax,
          bloqueOriginal: bloque
        };
      }
    }
    
    // Si no encaja en ningún bloque, usar el horario real
    return {
      nombre: 'Personalizado',
      inicio: horaInicioMin,
      fin: horaFinMax,
      bloqueOriginal: null
    };
  }

  // Buscar salón disponible para un grupo y horario
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
    
    // Si no hay salones candidatos, retornar null
    if (salonesCandidatos.length === 0) {
      return null;
    }
    
    // Ordenar salones por capacidad (ascendente) para asignar el más ajustado
    salonesCandidatos.sort((a, b) => a.capacidad - b.capacidad);
    
    // Retornar el primer salón candidato (el más pequeño que cumpla)
    return salonesCandidatos[0];
  }

  // Generar reporte de asignación
  generarReporte() {
    // Preparar detalle de asignaciones por bloques
    const detalleAsignacionesBloques = [];
    
    this.salones.forEach(salon => {
      if (salon.asignacionesBloques) {
        salon.asignacionesBloques.forEach(asig => {
          const clave = `${asig.grupoId}-${asig.dia}`;
          const clasesGrupoDia = this.clasesPorGrupoDia.get(clave) || [];
          const asignaturas = clasesGrupoDia.map(c => c.nombreAsignatura).join(', ');
          
          detalleAsignacionesBloques.push({
            salon: salon.id,
            dia: asig.dia,
            bloque: asig.bloque,
            grupo: asig.grupoId,
            horario: `${asig.horario.horaInicio} - ${asig.horario.horaFin}`,
            asignaturas
          });
        });
      }
    });
    
    const reporte = {
      totalClases: this.clases.length + this.clasesVirtuales.length + this.clasesLaboratorio.length,
      clasesPresenciales: this.clases.length,
      clasesVirtuales: this.clasesVirtuales.length,
      clasesLaboratorio: this.clasesLaboratorio.length,
      asignadas: this.asignaciones.length,
      errores: this.errores.length,
      detalleAsignacionesBloques,
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
        semestre: c.clase.semestre,
        carrera: c.clase.carrera,
        mensaje: c.mensaje
      })),
      detalleVirtuales: this.clasesVirtuales.map(c => ({
        clase: c.clase.nombreAsignatura,
        grupo: c.clase.grupoId,
        mensaje: c.mensaje
      }))
    };
    
    return reporte;
  }

  // Método para ordenar clases con grupos prioritarios
  ordenarClasesConPrioridades(gruposPrioritarios = []) {
    this.clases = radixSortClases(this.clases, gruposPrioritarios);
  }

  // Generar datos para exportación CSV
  generarDatosExportacion() {
    const datosExportacion = [];

    // Procesar asignaciones exitosas
    this.asignaciones.forEach(asignacion => {
      const clase = asignacion.clase;
      const salon = asignacion.salon;

      // Buscar el bloque correspondiente
      const bloqueInfo = salon.asignacionesBloques.find(b =>
        b.grupoId === clase.grupoId &&
        this.clasesPorGrupoDia.get(`${clase.grupoId}-${b.dia}`)?.some(c =>
          c.nombreAsignatura === clase.nombreAsignatura
        )
      );

      datosExportacion.push({
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
        'Bloque': bloqueInfo ? bloqueInfo.bloque : 'N/A'
      });
    });

    // Procesar errores (grupos no asignados)
    this.errores.forEach(error => {
      const clase = error.clase;
      datosExportacion.push({
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

    // Ordenar por grupo, día y hora
    return datosExportacion.sort((a, b) => {
      if (a.Grupo !== b.Grupo) return a.Grupo.localeCompare(b.Grupo);
      if (a['Día'] !== b['Día']) {
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        return dias.indexOf(a['Día']) - dias.indexOf(b['Día']);
      }
      return a['Hora Inicio'].localeCompare(b['Hora Inicio']);
    });
  }

  // Convertir datos a CSV
  convertirA_CSV(datos) {
    if (datos.length === 0) return '';

    const headers = Object.keys(datos[0]);
    const csvRows = [];

    // Agregar headers
    csvRows.push(headers.join(','));

    // Agregar filas de datos
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

  // Descargar archivo CSV
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