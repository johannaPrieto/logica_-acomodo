/**
 * Muestra los salones en la interfaz en formato calendario con bloques reales
 * @param {Array} salones - Lista de salones a mostrar
 * @param {Map} gruposDivididos - Mapa de grupos divididos (opcional)
 */
function mostrarSalonesEnInterfaz(salones, gruposDivididos = null) {
  const contenedor = document.getElementById('contenedor-salones');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  // Constantes para calendario
  const diasSemana = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'];

  // Ordenar salones por id
  salones.sort((a, b) => a.id.localeCompare(b.id));

  // Mostrar mensaje inicial de acomodo
  mostrarMensajeAcomodamiento();

  // Solo mostrar información de grupos divididos si ya se completó la asignación
  if (gruposDivididos !== null) {
    if (gruposDivididos.size > 0) {
      mostrarSeccionGruposDivididos(gruposDivididos);
    } else {
      mostrarMensajeSinGruposDivididos();
    }
  }

  salones.forEach(salon => {
    const divSalon = document.createElement('div');
    divSalon.className = `salon ${salon.asignacionesBloques?.length > 0 ? 'ocupado' : 'libre'}`;

    let calendarHTML = '';

    // Normalizador de días
    const normalizarDia = (dia) => {
      if (!dia) return dia;
      const s = String(dia).trim().toLowerCase();
      const sinAcentos = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mapa = {
        'lunes': 'LUNES',
        'martes': 'MARTES',
        'miercoles': 'MIÉRCOLES',
        'jueves': 'JUEVES',
        'viernes': 'VIERNES',
      };
      return mapa[sinAcentos] || dia;
    };

    // Función para convertir hora a minutos
    const convertirHoraAMinutos = (hora) => {
      const [horas, minutos] = hora.split(':').map(Number);
      return horas * 60 + minutos;
    };

    // Función para convertir minutos a hora
    const convertirMinutosAHora = (minutos) => {
      const horas = Math.floor(minutos / 60);
      const mins = minutos % 60;
      return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    // Generar HTML para cada día
    diasSemana.forEach(dia => {
      // Filtrar asignaciones para este día
      const asignacionesDia = salon.asignacionesBloques?.filter(asig => 
        normalizarDia(asig.dia) === dia
      ) || [];

      // Ordenar asignaciones por hora de inicio
      const asignacionesOrdenadas = asignacionesDia.sort((a, b) => {
        return convertirHoraAMinutos(a.horario.horaInicio) - convertirHoraAMinutos(b.horario.horaInicio);
      });

      // Generar bloques de tiempo
      const bloques = [];
      
      // Procesar asignaciones y huecos
      let tiempoActual = 7 * 60; // 07:00 en minutos
      const finJornada = 22 * 60; // 22:00 en minutos

      asignacionesOrdenadas.forEach(asignacion => {
        const inicioAsignacion = convertirHoraAMinutos(asignacion.horario.horaInicio);
        const finAsignacion = convertirHoraAMinutos(asignacion.horario.horaFin);

        // Agregar bloque libre si hay un hueco antes de esta asignación
        if (inicioAsignacion > tiempoActual) {
          bloques.push({
            horaInicio: convertirMinutosAHora(tiempoActual),
            horaFin: convertirMinutosAHora(inicioAsignacion),
            estado: 'Libre',
            grupo: null
          });
        }

        // Agregar bloque asignado
        bloques.push({
          horaInicio: asignacion.horario.horaInicio,
          horaFin: asignacion.horario.horaFin,
          estado: 'Asignado',
          grupo: asignacion.grupoId
        });

        tiempoActual = finAsignacion;
      });

      // Agregar bloque libre si queda tiempo al final
      if (tiempoActual < finJornada) {
        bloques.push({
          horaInicio: convertirMinutosAHora(tiempoActual),
          horaFin: convertirMinutosAHora(finJornada),
          estado: 'Libre',
          grupo: null
        });
      }

      // Generar tabla
      let tableHTML = `<table class="tabla-calendario"><thead><tr><th>Hora</th><th>Estado</th><th>Grupo</th></tr></thead><tbody>`;
      
      if (bloques.length === 0) {
        // Si no hay bloques, mostrar día completamente libre
        tableHTML += `<tr><td>07:00–22:00</td><td>🟩 Libre</td><td>—</td></tr>`;
      } else {
        bloques.forEach(block => {
          const estado = block.estado === 'Asignado' ? '🟦 Asignado' : '🟩 Libre';
          const grupoText = block.grupo || '—';
          tableHTML += `<tr><td>${block.horaInicio}–${block.horaFin}</td><td>${estado}</td><td>${grupoText}</td></tr>`;
        });
      }
      
      tableHTML += '</tbody></table>';
      calendarHTML += `<div class="dia-calendario"><h4>🗓️ ${dia}</h4>${tableHTML}</div>`;
    });

    divSalon.innerHTML = `
      <div class="salon-header">
        ${salon.id} — Cap: ${salon.capacidad}${salon.accesible ? ' — ♿' : ''}
      </div>
      <div class="salon-content">
        ${calendarHTML || '<div class="sin-asignaciones">Sin asignaciones</div>'}
      </div>
    `;

    contenedor.appendChild(divSalon);
  });
}

/**
 * Muestra el mensaje inicial de acomodo
 */
function mostrarMensajeAcomodamiento() {
  const contenedor = document.getElementById('contenedor-salones');
  
  const mensaje = document.createElement('div');
  mensaje.className = 'mensaje-acomodo-inicial';
  mensaje.innerHTML = `
    <div class="mensaje-content">
      <i class="fas fa-cogs"></i>
      <h3>Primero el acomodamiento</h3>
      <p>Procesando archivos y asignando salones...</p>
    </div>
  `;
  
  contenedor.appendChild(mensaje);
}

/**
 * Muestra la sección de grupos divididos en dos salones
 * @param {Map} gruposDivididos - Mapa de grupos divididos
 */
function mostrarSeccionGruposDivididos(gruposDivididos) {
  const contenedor = document.getElementById('contenedor-salones');
  
  // Crear contenedor para la sección de grupos divididos
  const seccionDivididos = document.createElement('div');
  seccionDivididos.className = 'grupos-divididos-section';
  
  const header = document.createElement('div');
  header.className = 'grupos-divididos-header';
  header.innerHTML = `
    <h3><i class="fas fa-split"></i> Grupos Divididos en Dos Salones</h3>
    <p class="grupos-divididos-subtitle">Los siguientes grupos utilizan dos salones distintos durante la semana:</p>
  `;
  
  seccionDivididos.appendChild(header);
  
  // Crear lista de grupos divididos
  const listaDivididos = document.createElement('div');
  listaDivididos.className = 'grupos-divididos-lista';
  
  // Ordenar grupos divididos por ID
  const gruposOrdenados = Array.from(gruposDivididos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  gruposOrdenados.forEach(([grupoId, info]) => {
    const salon1 = info.salones[0];
    const salon2 = info.salones[1];
    const dias1 = info.dias[salon1.id].join(', ');
    const dias2 = info.dias[salon2.id].join(', ');
    
    const itemDividido = document.createElement('div');
    itemDividido.className = 'grupo-dividido-item';
    
    // Formato detallado
    itemDividido.innerHTML = `
      <div class="grupo-dividido-header">
        <span class="grupo-id">Grupo ${grupoId}</span>
        <span class="division-arrow">→</span>
        <span class="salones-division">${salon1.id} / ${salon2.id}</span>
      </div>
      <div class="grupo-dividido-detalles">
        <div class="salon-detalle">
          <span class="salon-nombre">${salon1.id}:</span>
          <span class="salon-dias">${dias1}</span>
        </div>
        <div class="salon-detalle">
          <span class="salon-nombre">${salon2.id}:</span>
          <span class="salon-dias">${dias2}</span>
        </div>
      </div>
    `;
    
    listaDivididos.appendChild(itemDividido);
  });
  
  seccionDivididos.appendChild(listaDivididos);
  
  // Insertar después del mensaje inicial
  const mensajeInicial = contenedor.querySelector('.mensaje-acomodo-inicial');
  if (mensajeInicial) {
    contenedor.insertBefore(seccionDivididos, mensajeInicial.nextSibling);
  } else {
    contenedor.insertBefore(seccionDivididos, contenedor.firstChild);
  }
}

/**
 * Muestra el mensaje cuando no hay grupos divididos
 */
function mostrarMensajeSinGruposDivididos() {
  const contenedor = document.getElementById('contenedor-salones');
  
  // Remover mensaje inicial si existe
  const mensajeInicial = contenedor.querySelector('.mensaje-acomodo-inicial');
  if (mensajeInicial) {
    mensajeInicial.remove();
  }
  
  const mensaje = document.createElement('div');
  mensaje.className = 'sin-grupos-divididos';
  mensaje.innerHTML = `
    <div class="mensaje-content">
      <i class="fas fa-check-circle"></i>
      <h3>Sin Grupos Divididos</h3>
      <p>Todos los grupos han sido asignados a un solo salón durante toda la semana.</p>
    </div>
  `;
  
  contenedor.appendChild(mensaje);
}

export default mostrarSalonesEnInterfaz;