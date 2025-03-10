const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Define the directory where static files are located (assuming vue-puppeteer-client/dist or public)
const STATIC_DIR = path.join(__dirname, 'vue-puppeteer-client', 'public');

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  // Parse the URL
  const parsedUrl = url.parse(req.url);
  
  // Extract the pathname from the URL
  let pathname = parsedUrl.pathname;
  
  // If path is '/', serve index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Resolve the file path
  const filePath = path.join(STATIC_DIR, pathname);
  
  // Get the file extension
  const extname = path.extname(filePath);
  
  // Set the default content type
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read the file and serve it
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // If the file doesn't exist, serve a 404 page or simply a 404 status
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>The requested resource was not found on this server.</p>');
      } else {
        // For other errors, return a 500 status
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // If no error, serve the file with the appropriate content type
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server on port 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
}); 