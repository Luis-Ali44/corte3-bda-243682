const fs = require('fs');
const path = require('path');

const extensions = ['.js', '.sql', '.html'];
const directoriesToScan = ['api', 'backend', 'frontend'];
const rootFilesToScan = ['schema_corte3.sql'];

function removeComments(content, ext) {
    if (ext === '.sql') {
        // Regex para strings y comentarios en SQL.
        // Captura strings (comillas simples o dobles) en el grupo 1
        // Captura comentarios (/* ... */ o -- ...) en el grupo 2
        content = content.replace(/('.*?'|".*?")|(\/\*[\s\S]*?\*\/|--.*)/g, (match, str, comment) => {
            if (comment) return ''; // Es un comentario, lo eliminamos
            return match; // Es un string, lo mantenemos intacto
        });
    } else if (ext === '.js') {
        // Regex para strings y comentarios en JS.
        // Captura strings (', ", `) en el grupo 1, y comentarios (/* */, //) en el grupo 2
        content = content.replace(/(".*?"|'.*?'|`[\s\S]*?`)|(\/\*[\s\S]*?\*\/|\/\/.*)/g, (match, str, comment) => {
            if (comment) return ''; // Es un comentario, lo eliminamos
            return match; // Es un string, lo mantenemos intacto
        });
    } else if (ext === '.html') {
        // Eliminar comentarios HTML
        content = content.replace(/<!--[\s\S]*?-->/g, '');
        // Eliminar comentarios de JS dentro de etiquetas <script>
        content = content.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, open, scriptContent, close) => {
            let cleaned = scriptContent.replace(/(".*?"|'.*?'|`[\s\S]*?`)|(\/\*[\s\S]*?\*\/|\/\/.*)/g, (m, str, com) => {
                if (com) return '';
                return m;
            });
            return open + cleaned + close;
        });
    }
    
    // Eliminar líneas que quedaron vacías por eliminar comentarios
    // (Opcional, pero mantiene el código limpio)
    content = content.split('\n').filter(line => line.trim() !== '').join('\n');
    
    return content;
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else {
            const ext = path.extname(fullPath);
            if (extensions.includes(ext)) {
                let content = fs.readFileSync(fullPath, 'utf8');
                const cleanContent = removeComments(content, ext);
                if (content !== cleanContent) {
                    fs.writeFileSync(fullPath, cleanContent, 'utf8');
                    console.log('Limpiado:', fullPath);
                }
            }
        }
    }
}

console.log('Iniciando limpieza de comentarios...');

// Procesar directorios
directoriesToScan.forEach(dir => {
    scanDir(path.join(__dirname, dir));
});

// Procesar archivos sueltos en la raíz
rootFilesToScan.forEach(file => {
    const p = path.join(__dirname, file);
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        const ext = path.extname(p);
        const cleanContent = removeComments(content, ext);
        if (content !== cleanContent) {
            fs.writeFileSync(p, cleanContent, 'utf8');
            console.log('Limpiado:', p);
        }
    }
});

console.log('¡Todos los comentarios han sido eliminados con éxito!');
