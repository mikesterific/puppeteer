const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Define the directory where static files are located
const STATIC_DIR = path.join(__dirname, 'vue-puppeteer-client', 'public');

// Define the target development server
const TARGET_PORT = 5173;
const TARGET_URL = `http://localhost:${TARGET_PORT}/`;

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
  
  // For the root path, redirect to the target development server
  if (pathname === '/') {
    // Send an HTML page that automatically redirects to the target URL
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="refresh" content="0;url=${TARGET_URL}" />
        <title>Redirecting to Development Server</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 5px;
          }
          h1 { color: #333; }
          .loading { margin-top: 20px; }
          .redirect-link {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 15px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Puppeteer Dev Tools</h1>
          <p>Redirecting you to your development server at <a href="${TARGET_URL}">${TARGET_URL}</a>...</p>
          <div class="loading">Loading...</div>
          <a class="redirect-link" href="${TARGET_URL}">Click here if you are not redirected automatically</a>
        </div>
        <script>
          window.onload = function() {
            window.location.href = "${TARGET_URL}";
          };
        </script>
      </body>
      </html>
    `);
    return;
  }
  
  // For other paths, serve static files as before
  const filePath = path.join(STATIC_DIR, pathname);
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // If the file doesn't exist, redirect to the target URL with the path
        res.writeHead(302, { 'Location': `${TARGET_URL}${pathname.replace(/^\//, '')}` });
        res.end();
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server on port 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Redirecting to development server at ${TARGET_URL}`);
}); 