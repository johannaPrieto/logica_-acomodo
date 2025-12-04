/**
 * Muestra los salones en la interfaz estilo "Tetris"
 * @param {Array} salones - Lista de salones a mostrar
 */
function mostrarSalonesEnInterfaz(salones) {
  const contenedor = document.getElementById('contenedor-salones');
  contenedor.innerHTML = '';

  // Agrupar por edificio
  const salonesPorEdificio = {};

  salones.forEach(salon => {
    if (!salonesPorEdificio[salon.edificio]) {
      salonesPorEdificio[salon.edificio] = [];
    }

    salonesPorEdificio[salon.edificio].push(salon);
  });

  // Construcción visual por edificio
  Object.keys(salonesPorEdificio).sort().forEach(edificio => {
    const divEdificio = document.createElement('div');
    divEdificio.className = 'edificio';

    const tituloEdificio = document.createElement('h3');
    tituloEdificio.textContent = `Edificio ${edificio}`;
    divEdificio.appendChild(tituloEdificio);

    // Contenedor para los salones
    const contenedorSalones = document.createElement('div');
    contenedorSalones.className = 'edificio-salones';

    // Ordenar salones por id
    salonesPorEdificio[edificio].sort((a, b) => a.id.localeCompare(b.id));

    salonesPorEdificio[edificio].forEach(salon => {
      const divSalon = document.createElement('div');
      divSalon.className = `salon ${salon.horariosOcupados?.length > 0 ? 'ocupado' : 'libre'}`;

      let asignacionesHTML = '';

      // Asignaciones por bloque (en orden)
      if (salon.asignacionesBloques?.length > 0) {

        // Normalizador de días
        const normalizarDia = (dia) => {
          if (!dia) return dia;
          const s = String(dia).trim().toLowerCase();
          const sinAcentos = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const mapa = {
            'lunes': 'Lunes',
            'martes': 'Martes',
            'miercoles': 'Miércoles',
            'jueves': 'Jueves',
            'viernes': 'Viernes',
          };
          return mapa[sinAcentos] || dia;
        };

        // Agrupar por día
        const asignacionesPorDia = {};
        salon.asignacionesBloques.forEach(asig => {
          const diaCanon = normalizarDia(asig.dia);
          if (!asignacionesPorDia[diaCanon]) asignacionesPorDia[diaCanon] = [];
          asignacionesPorDia[diaCanon].push(asig);
        });

        // Orden correcto de días
        const ordenDias = {
          'Lunes': 1,
          'Martes': 2,
          'Miércoles': 3,
          'Jueves': 4,
          'Viernes': 5
        };

        const diasOrdenados = Object.keys(asignacionesPorDia).sort(
          (a, b) => (ordenDias[a] || 99) - (ordenDias[b] || 99)
        );

        // Generar HTML
        diasOrdenados.forEach(dia => {
          asignacionesPorDia[dia].forEach(asig => {
            asignacionesHTML += `
              <div class="bloque-asignacion">
                <div class="bloque-dia">${dia}</div>
                <div class="bloque-horario">${asig.bloque}</div>
                <div class="bloque-grupo">Grupo ${asig.grupoId}</div>
                <div class="bloque-horas">${asig.horario.horaInicio} - ${asig.horario.horaFin}</div>
              </div>
            `;
          });
        });
      }

      divSalon.innerHTML = `
        <div class="salon-header">
          <div class="salon-id">${salon.id}</div>
          <div class="salon-capacidad">Cap: ${salon.capacidad}</div>
          ${salon.accesible ? '<div class="salon-accesible">♿</div>' : ''}
        </div>
        <div class="salon-content">
          ${asignacionesHTML || '<div class="sin-asignaciones">Sin asignaciones</div>'}
        </div>
      `;

      contenedorSalones.appendChild(divSalon);
    });

    divEdificio.appendChild(contenedorSalones);

    contenedor.appendChild(divEdificio);
  });
}

export default mostrarSalonesEnInterfaz;
