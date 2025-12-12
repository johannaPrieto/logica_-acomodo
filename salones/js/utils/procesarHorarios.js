const fs = require('fs');
const path = require('path');

// Función para leer y parsear CSV
function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = values[index] ? values[index].trim() : '';
        });
        return obj;
    });
}

// Leer todos los archivos CSV
const csvFiles = [
    'Horarios_Normalizados_Completo_LAE.csv',
    'Horarios_Normalizados_Completo_LC.csv',
    'Horarios_Normalizados_Completo_LIN.csv',
    'Horarios_Normalizados_Completo_LNI.csv',
    'Horarios_Normalizados_Completo_TC.csv'
];

let allData = [];

csvFiles.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, '../../../Grupos_documento', file), 'utf8');
    const data = parseCSV(content);
    allData = allData.concat(data);
});

// Filtrar datos relevantes
const relevantData = allData.map(row => ({
    grupo: row.grupo,
    dia_semana: row.dia_semana,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
    salon: row.salon
}));

// Agrupar por día y grupo
const grouped = {};

relevantData.forEach(item => {
    const key = `${item.dia_semana}_${item.grupo}`;
    if (!grouped[key]) {
        grouped[key] = [];
    }
    grouped[key].push({
        start: item.hora_inicio,
        end: item.hora_fin,
        salon: item.salon
    });
});

// Procesar cada grupo
const processed = {};

Object.keys(grouped).forEach(key => {
    const [dia, grupo] = key.split('_');
    const blocks = grouped[key];

    // Ordenar por hora_inicio
    blocks.sort((a, b) => a.start.localeCompare(b.start));

    // Eliminar duplicados
    const uniqueBlocks = [];
    const seen = new Set();
    blocks.forEach(block => {
        const blockKey = `${block.start}_${block.end}`;
        if (!seen.has(blockKey)) {
            seen.add(blockKey);
            uniqueBlocks.push(block);
        }
    });

    // Consolidar continuos
    const consolidated = [];
    uniqueBlocks.forEach(block => {
        if (consolidated.length === 0) {
            consolidated.push(block);
        } else {
            const last = consolidated[consolidated.length - 1];
            if (last.end === block.start) {
                last.end = block.end;
            } else {
                consolidated.push(block);
            }
        }
    });

    if (!processed[dia]) {
        processed[dia] = {};
    }
    processed[dia][grupo] = consolidated;
});

// Formatear salida
const output = [];

const diasOrden = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

diasOrden.forEach(dia => {
    if (processed[dia]) {
        output.push(dia);
        const grupos = Object.keys(processed[dia]).sort();
        grupos.forEach(grupo => {
            output.push(`Grupo ${grupo}`);
            processed[dia][grupo].forEach(block => {
                output.push(`${block.start} - ${block.end}`);
            });
            output.push(''); // Línea en blanco
        });
        output.push(''); // Línea en blanco entre días
    }
});

console.log(output.join('\n'));