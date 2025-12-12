/**
 * Muestra una notificación en la interfaz
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de notificación (exito, error, advertencia, info)
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('contenedor-notificaciones');
  if (!contenedor) return;
  const notificacion = document.createElement('div');
  notificacion.className = `notificacion notificacion-${tipo}`;
  notificacion.textContent = mensaje;
  
  contenedor.appendChild(notificacion);
  
  // Auto-eliminar después de 5 segundos
  setTimeout(() => {
    notificacion.remove();
  }, 5000);
}

/**
 * Muestra u oculta el indicador de carga
 * @param {boolean} mostrar - Si se debe mostrar el indicador
 */
function mostrarIndicadorCarga(mostrar) {
  const indicador = document.getElementById('indicador-carga');
  if (mostrar) {
    indicador.style.display = 'block';
  } else {
    indicador.style.display = 'none';
  }
}

export { mostrarNotificacion, mostrarIndicadorCarga };