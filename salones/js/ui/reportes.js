function mostrarReporte(reporte) {
  const contenedor = document.getElementById('contenedor-reporte');

  const detalleAsignaciones = (reporte.detalleAsignacionesBloques || []).map(a => `
    <tr>
      <td>${a.salon || ''}</td>
      <td>${a.dia || ''}</td>
      <td>${a.bloque || ''}</td>
      <td>${a.grupo || ''}</td>
      <td>${a.horario || ''}</td>
      <td>${a.asignaturas || ''}</td>
    </tr>
  `).join('');

  const detalleLaboratorio = (reporte.detalleLaboratorio || []).map(c => `
    <tr>
      <td>${c.clase}</td>
      <td>${c.grupo}</td>
      <td>${c.semestre}° (${c.carrera})</td>
      <td>${c.mensaje}</td>
    </tr>
  `).join('');

  const detalleVirtuales = (reporte.detalleVirtuales || []).map(c => `
    <tr>
      <td>${c.clase}</td>
      <td>${c.grupo}</td>
      <td>${c.mensaje}</td>
    </tr>
  `).join('');

  const detalleErrores = (reporte.detalleErrores || []).map(e => `
    <tr>
      <td>${e.clase}</td>
      <td>${e.grupo}</td>
      <td>${e.error}</td>
    </tr>
  `).join('');

  contenedor.innerHTML = `
    <h3>Reporte de Asignación por Bloques</h3>
    <div class="resumen">
      <p>Total de clases: ${reporte.totalClases}</p>
      <p>Clases asignadas: ${reporte.asignadas}</p>
      <p>Clases de laboratorio: ${reporte.clasesLaboratorio}</p>
      <p>Errores: ${reporte.errores}</p>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="asignaciones">Asignaciones por Bloques</button>
      <button class="tab-btn" data-tab="laboratorio">Laboratorio</button>
      <button class="tab-btn" data-tab="virtuales">Virtuales</button>
      <button class="tab-btn" data-tab="errores">Errores</button>
    </div>

    <div class="tab-content active" id="asignaciones">
      <table>
        <thead>
          <tr>
            <th>Salón</th>
            <th>Día</th>
            <th>Bloque</th>
            <th>Grupo</th>
            <th>Horario</th>
            <th>Asignaturas</th>
          </tr>
        </thead>
        <tbody>${detalleAsignaciones}</tbody>
      </table>
    </div>

    <div class="tab-content" id="laboratorio">
      <table>
        <thead>
          <tr>
            <th>Asignatura</th>
            <th>Grupo</th>
            <th>Semestre (Carrera)</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${detalleLaboratorio}</tbody>
      </table>
    </div>

    <div class="tab-content" id="virtuales">
      <table>
        <thead>
          <tr>
            <th>Asignatura</th>
            <th>Grupo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${detalleVirtuales}</tbody>
      </table>
    </div>

    <div class="tab-content" id="errores">
      <table>
        <thead>
          <tr>
            <th>Asignatura</th>
            <th>Grupo</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>${detalleErrores}</tbody>
      </table>
    </div>
  `;

  // Configurar tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

export default mostrarReporte;
