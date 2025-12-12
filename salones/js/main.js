import SistemaAsignacion from './core/SistemaAsignacion.js';
import AsignadorAutomatico from './core/AsignadorAutomatica.js';
import { mostrarNotificacion, mostrarIndicadorCarga } from './ui/notificaciones.js';
import mostrarReporte from './ui/reportes.js';
import mostrarSalonesEnInterfaz from './ui/visualizadorSalones.js';

// Variable global para el sistema procesado
let sistemaProcesado = null;

// Gestión de grupos prioritarios guardados
const GRUPOS_PRIORITARIOS_KEY = 'grupos_prioritarios_guardados';

function guardarGruposPrioritarios(grupos) {
  localStorage.setItem(GRUPOS_PRIORITARIOS_KEY, JSON.stringify(grupos));
}

function cargarGruposPrioritarios() {
  const guardados = localStorage.getItem(GRUPOS_PRIORITARIOS_KEY);
  return guardados ? JSON.parse(guardados) : [];
}

function agregarGrupoPrioritario(grupoId) {
  const grupos = cargarGruposPrioritarios();
  if (!grupos.includes(grupoId)) {
    grupos.push(grupoId);
    guardarGruposPrioritarios(grupos);
  }
}

function quitarGrupoPrioritario(grupoId) {
  const grupos = cargarGruposPrioritarios();
  const index = grupos.indexOf(grupoId);
  if (index > -1) {
    grupos.splice(index, 1);
    guardarGruposPrioritarios(grupos);
  }
}

// Función principal para cargar archivos y asignar salones
async function cargarArchivosYAsignar() {
  const inputArchivos = document.getElementById('input-archivos');
  const archivos = inputArchivos.files;

  if (archivos.length !== 5) {
    mostrarNotificacion('ERROR: Debe seleccionar exactamente 5 archivos CSV', 'error');
    return;
  }

  // Mostrar indicador de carga
  mostrarIndicadorCarga(true);

  try {
    // Crear sistema y procesar archivos
    const sistema = new SistemaAsignacion();
    sistema.inicializarSalones();

    const resultadoProcesamiento = await sistema.procesarMultiplesArchivos(archivos);

    if (!resultadoProcesamiento.exito) {
      mostrarNotificacion(resultadoProcesamiento.mensaje, 'error');
      return;
    }

    // Guardar el sistema procesado
    sistemaProcesado = sistema;

    // Mostrar modal para selección de grupo prioritario
    mostrarModalGrupoPrioritario();

  } catch (error) {
    mostrarNotificacion(`Error: ${error.message}`, 'error');
  } finally {
    // Ocultar indicador de carga
    mostrarIndicadorCarga(false);
  }
}

// Función para mostrar el modal de selección de grupo prioritario
function mostrarModalGrupoPrioritario() {
  const modal = document.getElementById('modal-grupo-prioritario');
  const container = document.getElementById('grupos-prioritarios-container');
  const buscador = document.getElementById('buscador-grupos');
  const btnConfirmar = document.getElementById('btn-confirmar-prioridad');
  const btnCancelar = document.getElementById('btn-cancelar-prioridad');
  const modalClose = document.querySelector('.modal-close');
  const gruposGuardadosSection = document.getElementById('grupos-guardados-section');
  const gruposGuardadosList = document.getElementById('grupos-guardados-list');

  // Limpiar búsqueda y checkboxes anteriores
  buscador.value = '';
  container.innerHTML = '';
  gruposGuardadosList.innerHTML = '';

  // Mostrar grupos prioritarios guardados
  const gruposGuardados = cargarGruposPrioritarios();
  if (gruposGuardados.length > 0) {
    gruposGuardadosSection.style.display = 'block';
    gruposGuardados.forEach(grupoId => {
      const tag = document.createElement('div');
      tag.className = 'grupo-guardado-tag';

      const span = document.createElement('span');
      span.textContent = grupoId;

      const btnQuitar = document.createElement('button');
      btnQuitar.textContent = '×';
      btnQuitar.title = `Quitar ${grupoId} de grupos prioritarios`;
      btnQuitar.addEventListener('click', () => {
        quitarGrupoPrioritario(grupoId);
        mostrarModalGrupoPrioritario(); // Recargar modal
        mostrarNotificacion(`Grupo ${grupoId} removido de prioridades`, 'info');
      });

      tag.appendChild(span);
      tag.appendChild(btnQuitar);
      gruposGuardadosList.appendChild(tag);
    });
  } else {
    gruposGuardadosSection.style.display = 'none';
  }

  // Agregar todos los grupos disponibles como checkboxes
  if (sistemaProcesado && sistemaProcesado.grupos) {
    const gruposOrdenados = Array.from(sistemaProcesado.grupos.keys()).sort();
    gruposOrdenados.forEach(grupoId => {
      const checkboxItem = document.createElement('div');
      checkboxItem.className = 'grupo-checkbox-item';
      checkboxItem.dataset.grupoId = grupoId;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `checkbox-${grupoId}`;
      checkbox.value = grupoId;

      // Preseleccionar si está en grupos guardados
      if (gruposGuardados.includes(grupoId)) {
        checkbox.checked = true;
      }

      const label = document.createElement('label');
      label.htmlFor = `checkbox-${grupoId}`;
      label.textContent = grupoId;

      checkboxItem.appendChild(checkbox);
      checkboxItem.appendChild(label);
      container.appendChild(checkboxItem);
    });
  }

  // Función para filtrar grupos
  const filtrarGrupos = () => {
    const textoBusqueda = buscador.value.toLowerCase();
    const checkboxItems = container.querySelectorAll('.grupo-checkbox-item');

    checkboxItems.forEach(item => {
      const grupoId = item.dataset.grupoId.toLowerCase();
      if (grupoId.includes(textoBusqueda)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  };

  // Event listener para el buscador
  buscador.addEventListener('input', filtrarGrupos);

  // Función para continuar con la asignación
  const continuarAsignacion = () => {
    // Obtener todos los checkboxes marcados
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const gruposPrioritarios = Array.from(checkboxes).map(cb => cb.value);

    // Guardar los grupos prioritarios seleccionados
    guardarGruposPrioritarios(gruposPrioritarios);

    ocultarModal();

    if (!sistemaProcesado) {
      mostrarNotificacion('Error: Sistema no inicializado', 'error');
      return;
    }

    // Mostrar indicador de carga
    mostrarIndicadorCarga(true);

    try {
      // Ordenar clases con prioridades actualizadas (incluyendo grupos prioritarios)
      sistemaProcesado.ordenarClasesConPrioridades(gruposPrioritarios);

      // Asignar salones automáticamente con grupos prioritarios
      const asignador = new AsignadorAutomatico(sistemaProcesado, gruposPrioritarios);
      asignador.asignarSalones();

      // Mostrar resultados
      const mensajePrioritarios = gruposPrioritarios.length > 0
        ? ` Grupos prioritarios (1er piso obligatorio): ${gruposPrioritarios.join(', ')}.`
        : '';
      const mensajeDivididos = asignador.gruposDivididos.size > 0
        ? ` ${asignador.gruposDivididos.size} grupo(s) dividido(s) en dos salones.`
        : '';
      mostrarNotificacion(`Procesamiento completado. ${sistemaProcesado.asignaciones.length} clases asignadas. ${sistemaProcesado.clasesLaboratorio.length} clases de laboratorio excluidas.${mensajePrioritarios}${mensajeDivididos}`, 'exito');

      // Generar y mostrar reporte
      const reporte = sistemaProcesado.generarReporte(asignador.gruposDivididos);
      mostrarReporte(reporte);

      // Actualizar visualización de salones
      mostrarSalonesEnInterfaz(sistemaProcesado.salones, asignador.gruposDivididos);

      // Poblar tabla de asignación
      poblarTablaAsignacion(sistemaProcesado.asignaciones);

    } catch (error) {
      mostrarNotificacion(`Error en asignación: ${error.message}`, 'error');
    } finally {
      // Ocultar indicador de carga
      mostrarIndicadorCarga(false);
    }
  };

  // Función para ocultar modal y limpiar event listeners
  const ocultarModal = () => {
    modal.classList.remove('show');
    // Limpiar event listeners para evitar acumulación
    btnConfirmar.removeEventListener('click', confirmarHandler);
    btnCancelar.removeEventListener('click', cancelarHandler);
    modalClose.removeEventListener('click', closeHandler);
    modal.removeEventListener('click', modalClickHandler);
    buscador.removeEventListener('input', filtrarGrupos);
  };

  // Event handlers
  const confirmarHandler = () => {
    const checkboxesMarcados = container.querySelectorAll('input[type="checkbox"]:checked');
    if (checkboxesMarcados.length === 0) {
      mostrarNotificacion('Por favor seleccione al menos un grupo prioritario', 'advertencia');
      return;
    }
    continuarAsignacion();
  };

  const cancelarHandler = () => {
    ocultarModal();
    mostrarNotificacion('Asignación cancelada por el usuario', 'info');
  };

  const closeHandler = () => {
    ocultarModal();
  };

  const modalClickHandler = (e) => {
    if (e.target === modal) {
      ocultarModal();
    }
  };

  // Agregar event listeners
  btnConfirmar.addEventListener('click', confirmarHandler);
  btnCancelar.addEventListener('click', cancelarHandler);
  modalClose.addEventListener('click', closeHandler);
  modal.addEventListener('click', modalClickHandler);

  // Mostrar modal
  modal.classList.add('show');
}

// Función para actualizar la visualización de salones
function actualizarVisualizacionSalones() {
  const sistema = new SistemaAsignacion();
  sistema.inicializarSalones();
  mostrarSalonesEnInterfaz(sistema.salones);

  // Limpiar búsqueda después de actualizar
  const buscadorSalon = document.getElementById('buscador-salon');
  if (buscadorSalon) {
    buscadorSalon.value = '';
    buscarSalonPorGrupo(); // Esto limpiará los filtros
  }

  mostrarNotificacion('Visualización de salones actualizada', 'exito');
}

// Función para buscar salones por grupo
function buscarSalonPorGrupo() {
  const buscador = document.getElementById('buscador-salon');
  const grupoBuscado = buscador.value.trim().toLowerCase();
  const contenedorSalones = document.getElementById('contenedor-salones');
  const salones = Array.from(document.querySelectorAll('.salon'));

  if (!grupoBuscado) {
    // Si no hay búsqueda, mostrar todos los salones normalmente
    salones.forEach(salon => {
      salon.classList.remove('destacado', 'oculto');
    });
    return;
  }

  let salonesEncontrados = [];
  let salonesNoEncontrados = [];

  salones.forEach(salon => {
    const gruposEnSalon = Array.from(salon.querySelectorAll('.tabla-calendario td')).map(el =>
      el.textContent.toLowerCase()
    );

    const contieneGrupo = gruposEnSalon.some(grupo => grupo.includes(grupoBuscado));

    if (contieneGrupo) {
      salon.classList.add('destacado');
      salon.classList.remove('oculto');
      salonesEncontrados.push(salon);
    } else {
      salon.classList.remove('destacado');
      salon.classList.add('oculto');
      salonesNoEncontrados.push(salon);
    }
  });

  // Reordenar DOM: salones encontrados primero
  if (salonesEncontrados.length > 0) {
    // Mover salones encontrados al principio
    salonesEncontrados.forEach(salon => {
      const pisoContainer = salon.closest('.piso');
      if (pisoContainer) {
        pisoContainer.insertBefore(salon, pisoContainer.firstElementChild);
      }
    });

    // Hacer scroll automático hacia el primer salón encontrado después de que el DOM se actualice
    requestAnimationFrame(() => {
      const primerSalonEncontrado = salonesEncontrados[0];
      if (primerSalonEncontrado) {
        primerSalonEncontrado.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    });
  }

  // Mostrar advertencia si no se encontraron resultados
  if (salonesEncontrados.length === 0) {
    mostrarNotificacion(`No se encontró el grupo "${buscador.value.trim()}" en ningún salón asignado`, 'advertencia');
  } else {
    mostrarNotificacion(`Se encontraron ${salonesEncontrados.length} salón(es) con el grupo "${buscador.value.trim()}"`, 'info');
  }
}

// Función para poblar la tabla de asignación
function poblarTablaAsignacion(asignaciones) {
  const tbody = document.getElementById('tabla-asignacion-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Ordenar asignaciones por grupo, día, hora
  asignaciones.sort((a, b) => {
    if (a.clase.grupoId !== b.clase.grupoId) return a.clase.grupoId.localeCompare(b.clase.grupoId);
    if (a.clase.diaSemana !== b.clase.diaSemana) {
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      return dias.indexOf(a.clase.diaSemana) - dias.indexOf(b.clase.diaSemana);
    }
    return a.clase.horaInicio.localeCompare(b.clase.horaInicio);
  });

  asignaciones.forEach(asignacion => {
    const tr = document.createElement('tr');

    const grupoTd = document.createElement('td');
    grupoTd.textContent = asignacion.clase.grupoId;
    tr.appendChild(grupoTd);

    const materiaTd = document.createElement('td');
    materiaTd.textContent = asignacion.clase.nombreAsignatura;
    tr.appendChild(materiaTd);

    const salonTd = document.createElement('td');
    if (asignacion.salon) {
      salonTd.textContent = asignacion.salon.id;
    } else {
      salonTd.textContent = asignacion.mensaje;
      salonTd.style.fontStyle = 'italic';
      salonTd.style.color = '#666';
    }
    tr.appendChild(salonTd);

    const pisoTd = document.createElement('td');
    pisoTd.textContent = asignacion.salon ? asignacion.salon.piso : '-';
    tr.appendChild(pisoTd);

    const horarioTd = document.createElement('td');
    horarioTd.textContent = `${asignacion.clase.horaInicio} - ${asignacion.clase.horaFin}`;
    tr.appendChild(horarioTd);

    const diasTd = document.createElement('td');
    diasTd.textContent = asignacion.clase.diaSemana;
    tr.appendChild(diasTd);

    const estadoTd = document.createElement('td');
    estadoTd.textContent = asignacion.salon ? 'Asignado' : 'Laboratorio';
    estadoTd.className = asignacion.salon ? 'estado-asignado' : 'estado-laboratorio';
    tr.appendChild(estadoTd);

    tbody.appendChild(tr);
  });

  // Actualizar contadores
  const totalSalones = new Set(asignaciones.filter(a => a.salon).map(a => a.salon.id)).size;
  const totalGrupos = new Set(asignaciones.map(a => a.clase.grupoId)).size;
  const totalConflictos = asignaciones.filter(a => !a.salon).length;

  document.getElementById('total-salones').textContent = totalSalones;
  document.getElementById('total-grupos').textContent = totalGrupos;
  document.getElementById('total-conflictos').textContent = totalConflictos;
  document.getElementById('porcentaje-ocupacion').textContent = 'N/A'; // Calcular si es necesario
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Configurar evento para carga de archivos
  document.getElementById('btn-procesar').addEventListener('click', cargarArchivosYAsignar);

  // Configurar búsqueda de salones
  const buscadorSalon = document.getElementById('buscador-salon');
  if (buscadorSalon) {
    buscadorSalon.addEventListener('input', buscarSalonPorGrupo);
  }

  // Configurar botón de actualizar visualización
  const btnActualizar = document.createElement('button');
  btnActualizar.className = 'btn btn-secondary btn-sm';
  btnActualizar.textContent = 'Actualizar Visualización';
  btnActualizar.addEventListener('click', actualizarVisualizacionSalones);

  // Agregar el botón a la sección de visualización
  const visualizationSection = document.querySelector('.visualization-section .section-header');
  if (visualizationSection) {
    const viewControls = visualizationSection.querySelector('.view-controls');
    if (viewControls) {
      viewControls.appendChild(btnActualizar);
    }
  }

  // Mostrar salones iniciales
  actualizarVisualizacionSalones();
});