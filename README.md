# Puppeteer

A Model Context Protocol server that provides browser automation capabilities using Puppeteer. This server enables LLMs to interact with web pages, take screenshots, and execute JavaScript in a real browser environment.

## Components

### Tools

- **puppeteer_navigate**
  - Navigate to any URL in the browser
  - Input: `url` (string)

- **puppeteer_screenshot**
  - Capture screenshots of the entire page or specific elements
  - Inputs:
    - `name` (string, required): Name for the screenshot
    - `selector` (string, optional): CSS selector for element to screenshot
    - `width` (number, optional, default: 800): Screenshot width
    - `height` (number, optional, default: 600): Screenshot height

- **puppeteer_click**
  - Click elements on the page
  - Input: `selector` (string): CSS selector for element to click

- **puppeteer_hover**
  - Hover elements on the page
  - Input: `selector` (string): CSS selector for element to hover

- **puppeteer_fill**
  - Fill out input fields
  - Inputs:
    - `selector` (string): CSS selector for input field
    - `value` (string): Value to fill

- **puppeteer_select**
  - Select an element with SELECT tag
  - Inputs:
    - `selector` (string): CSS selector for element to select
    - `value` (string): Value to select

- **puppeteer_evaluate**
  - Execute JavaScript in the browser console
  - Input: `script` (string): JavaScript code to execute

### Resources

The server provides access to two types of resources:

1. **Console Logs** (`console://logs`)
   - Browser console output in text format
   - Includes all console messages from the browser

2. **Screenshots** (`screenshot://<name>`)
   - PNG images of captured screenshots
   - Accessible via the screenshot name specified during capture

## Key Features

- Browser automation
- Console log monitoring
- Screenshot capabilities
- JavaScript execution
- Basic web interaction (navigation, clicking, form filling)

## Configuration to use Puppeteer Server
Here's the Claude Desktop configuration to use the Puppeter server:

### Docker

**NOTE** The docker implementation will use headless chromium, where as the NPX version will open a browser window.

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "-e", "DOCKER_CONTAINER=true", "mcp/puppeteer"]
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

## Build

Docker build:

```bash
docker build -t mcp/puppeteer -f src/puppeteer/Dockerfile .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

## Memory Profiling Tools

This MCP server has been extended with Chrome DevTools Protocol integration to provide memory profiling capabilities that can help detect memory leaks in web applications.

### Available Memory Profiling Tools

#### 1. Get Memory Metrics

```javascript
await mcp__puppeteer_evaluate('get_memory_metrics')
```

Returns the current memory usage metrics from Chrome, including:
- JavaScript heap size limit
- Total JavaScript heap size
- Used JavaScript heap size
- Usage percentage

#### 2. Take Heap Snapshot

```javascript
await mcp__puppeteer_evaluate('take_heap_snapshot', { detailed: true })
```

Captures a heap snapshot and provides a summary analysis, including:
- Total number of objects
- Total memory size
- Node count
- Detached DOM trees count
- Largest objects by memory consumption

#### 3. Start Memory Monitoring

```javascript
await mcp__puppeteer_evaluate('start_memory_monitoring', { 
  duration: 60,   // Duration in seconds (default: 30)
  interval: 1000  // Sampling interval in milliseconds (default: 1000)
})
```

Monitors memory usage over time to detect potential memory leaks:
- Collects memory metrics at regular intervals
- Calculates memory growth rate
- Provides recommendations based on analysis
- Returns a timeline of memory usage

#### 4. Analyze Detached DOM

```javascript
await mcp__puppeteer_evaluate('analyze_detached_dom')
```

Analyzes detached DOM nodes that might be causing memory leaks:
- Identifies DOM nodes no longer in the document but still in memory
- Reports retained size of detached nodes
- Provides recommendations for fixing memory leaks

### Memory Leak Detection Workflow

1. Navigate to the page you want to analyze
2. Take baseline memory metrics with `get_memory_metrics`
3. Perform actions that might cause memory leaks (e.g., navigating between views)
4. Start memory monitoring with `start_memory_monitoring`
5. If a potential leak is detected, use `analyze_detached_dom` for deeper analysis
6. Take a heap snapshot with `take_heap_snapshot` for detailed memory analysis

### Example Usage

```javascript
// Navigate to the target page
await mcp__puppeteer_navigate({ url: 'https://example.com/app' });

// Get baseline memory metrics
const baselineMetrics = await mcp__get_memory_metrics({});

// Perform actions that might trigger memory leaks
// For example, navigate between different views multiple times
for (let i = 0; i < 5; i++) {
  await mcp__puppeteer_click({ selector: '#view1-tab' });
  await mcp__puppeteer_click({ selector: '#view2-tab' });
}

// Monitor memory for potential leaks
const monitoringResults = await mcp__start_memory_monitoring({ 
  duration: 30, 
  interval: 1000 
});

// If a potential leak is detected, analyze detached DOM nodes
if (monitoringResults.potentialLeak) {
  const detachedDOMAnalysis = await mcp__analyze_detached_dom({});
}

// Take a detailed heap snapshot for further analysis
const heapSnapshot = await mcp__take_heap_snapshot({ detailed: true });
```

## HTTP Server Functionality

The project includes a simple HTTP server (`http-server.js`) that serves the Vue Puppeteer client interface for browser automation. This allows you to interact with the browser automation features through a web interface.

### Installation

Before running the HTTP server, make sure you have the required dependencies installed:

```bash
# Install the project dependencies
npm install

# If you haven't already, build the Vue client
cd vue-puppeteer-client
npm install
npm run build
cd ..
```

### Starting the HTTP Server

To start the HTTP server, run:

```bash
node http-server.js
```

The server will start on port 3000, and you can access the interface at [http://localhost:3000/](http://localhost:3000/).

### Features

- Serves static files from the Vue Puppeteer client interface
- Provides a web-based interface for browser automation
- Supports all Puppeteer functionality through a user-friendly web UI
- Automatically routes requests to the appropriate static files
- Returns appropriate MIME types for different file extensions

### Integration with MCP

The HTTP server complements the Model Context Protocol (MCP) server by providing a visual interface for the same browser automation capabilities. While the MCP server enables programmatic access for AI models, the HTTP server makes these features accessible through a human-friendly web interface.

### Using the Web Interface

Once you have the HTTP server running, you can use the web interface to:

1. **Browser Navigation**
   - Navigate to any URL
   - View the webpage within the interface
   - Go back, forward, or refresh the page

2. **Page Interaction**
   - Click on elements
   - Fill out forms
   - Select options from dropdowns
   - Hover over elements

3. **Debugging**
   - View browser console logs in real-time
   - Inspect network requests
   - Take screenshots of the page or specific elements

4. **Memory Profiling**
   - Access memory metrics
   - Take heap snapshots
   - Monitor memory usage over time
   - Analyze detached DOM nodes

The interface provides a user-friendly way to test and debug browser automation tasks before implementing them programmatically via the MCP server.

## Publishing and Importing

To publish this package so it can be imported into another codebase that uses MCP, follow these steps:

### Publishing to npm

1. **Prepare the package**:
   - Ensure all required dependencies are in the `package.json`
   - Update the version number in `package.json` if needed
   - Make sure the TypeScript files compile successfully

2. **Build the package**:
   ```bash
   npm run build
   ```

3. **Login to npm**:
   ```bash
   npm login
   ```

4. **Publish the package**:
   ```bash
   npm publish
   ```
   
   If this is a scoped package (like `@modelcontextprotocol/server-puppeteer`), you will need to use:
   ```bash
   npm publish --access public
   ```

### Importing into Another Project

Once published, you can import this package into another MCP project using:

1. **Install the package**:
   ```bash
   npm install @modelcontextprotocol/server-puppeteer
   ```

2. **Use in your MCP configuration**:
   ```json
   {
     "mcpServers": {
       "puppeteer": {
         "command": "node",
         "args": ["./node_modules/@modelcontextprotocol/server-puppeteer/dist/index.js"]
       }
     }
   }
   ```

3. **Programmatic Usage**:
   If you want to use it programmatically in your codebase:
   ```javascript
   import { Server } from '@modelcontextprotocol/server-puppeteer';
   
   // Initialize and use the server according to your needs
   const puppeteerServer = new Server({
     // Your configuration here
   });
   ```

### Publishing Docker Image

If you prefer to use the Docker approach:

1. **Build the Docker image**:
   ```bash
   docker build -t yourname/mcp-puppeteer -f Dockerfile .
   ```

2. **Push to Docker Hub**:
   ```bash
   docker push yourname/mcp-puppeteer
   ```

3. **Use in another project**:
   ```json
   {
     "mcpServers": {
       "puppeteer": {
         "command": "docker",
         "args": ["run", "-i", "--rm", "--init", "-e", "DOCKER_CONTAINER=true", "yourname/mcp-puppeteer"]
       }
     }
   }
   ```

### Including HTTP Server Functionality

If you want to include the HTTP server functionality in your imported package:

1. **Copy the HTTP server file**:
   Make sure to include `http-server.js` in your published package by adding it to the `files` array in `package.json`:
   ```json
   "files": [
     "dist",
     "http-server.js"
   ]
   ```

2. **Add an HTTP server script**:
   Add a script to your `package.json` to easily start the HTTP server:
   ```json
   "scripts": {
     "build": "tsc && shx chmod +x dist/*.js",
     "prepare": "npm run build",
     "watch": "tsc --watch",
     "test": "jest",
     "serve": "node http-server.js"
   }
   ```

3. **Using in another project**:
   After installing the package in your project, you can start the HTTP server using:
   ```bash
   npx @modelcontextprotocol/server-puppeteer serve
   ```
   
   Or add it to your project's scripts:
   ```json
   "scripts": {
     "start-puppeteer-ui": "npx @modelcontextprotocol/server-puppeteer serve"
   }
   ```
