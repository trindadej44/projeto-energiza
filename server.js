const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types'); // Para determinar o tipo MIME dos arquivos

const server = http.createServer((req, res) => {
    let filePath;

    // Verifica se a URL é a raiz, que serve o index.html
    if (req.url === '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
    } 
    // Verifica se a URL começa com /imgs, para servir as imagens
    else if (req.url.startsWith('/imgs')) {
        filePath = path.join(__dirname, 'imgs', req.url.replace('/imgs', '')); // Mapeia a URL para a pasta imgs
    } 
    else {
        // Caso a URL não seja para o index.html ou para imagens, retorna erro 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Página não encontrada');
        return;
    }

    // Verifica se o arquivo solicitado existe
    fs.exists(filePath, (exists) => {
        if (!exists) {
            // Arquivo não encontrado
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Arquivo não encontrado');
            return;
        }

        // Determina o tipo MIME do arquivo
        const extname = path.extname(filePath);
        const mimeType = mime.lookup(extname) || 'application/octet-stream';

        // Lê e envia o arquivo solicitado
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erro ao ler o arquivo');
                return;
            }

            // Envia o cabeçalho correto com o tipo MIME
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        });
    });
});

server.listen(3004, () => {
    console.log('Servidor rodando em http://localhost:3004');
});
