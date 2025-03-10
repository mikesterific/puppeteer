# Using the Local Package

If you haven't published the package to npm yet, you can still use it in another project by installing the tarball directly:

## Method 1: Installing the Tarball Directly

1. Copy the tarball file to your other project:
   ```bash
   cp /Users/michaeljones/git/puppeteer/modelcontextprotocol-server-puppeteer-0.6.3.tgz /path/to/your/project/
   ```

2. Navigate to your other project and install the tarball:
   ```bash
   cd /path/to/your/project
   npm install ./modelcontextprotocol-server-puppeteer-0.6.3.tgz
   ```

## Method 2: Using npm link

1. Register the package globally on your machine:
   ```bash
   npm link
   ```

2. In your other project, link to the package:
   ```bash
   cd /path/to/your/project
   npm link @modelcontextprotocol/server-puppeteer
   ```

## Method 3: Using in MCP Configuration

Once installed by either method, you can use it in your MCP configuration:

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

## Starting the HTTP Server

After installing the package, you can start the HTTP server with:

```bash
node ./node_modules/@modelcontextprotocol/server-puppeteer/http-server.js
```

Or use npm scripts if you've installed via npm link or published package:

```bash
npx @modelcontextprotocol/server-puppeteer serve
```

