# Integrating Puppeteer MCP in a New Project

This guide shows how to integrate the Puppeteer MCP server in a new or existing project, either by using the published npm package or the local tarball.

## Option 1: Install from npm (After Publishing)

```bash
npm install @modelcontextprotocol/server-puppeteer
```

## Option 2: Install from Local Tarball

```bash
# Copy the tarball to your project directory
cp /Users/michaeljones/git/puppeteer/modelcontextprotocol-server-puppeteer-0.6.3.tgz ./

# Install from the local tarball
npm install ./modelcontextprotocol-server-puppeteer-0.6.3.tgz
```

## Configure in Your Project

### 1. Add MCP Configuration

Create or update your MCP configuration file (typically in your project root):

```json
// mcp-config.json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["./node_modules/@modelcontextprotocol/server-puppeteer/dist/index.js"]
    }
  }
}
```

### 2. Add Scripts to package.json

```json
"scripts": {
  "start-puppeteer": "node ./node_modules/@modelcontextprotocol/server-puppeteer/dist/index.js",
  "start-puppeteer-ui": "node ./node_modules/@modelcontextprotocol/server-puppeteer/http-server.js"
}
```

## Using the Puppeteer MCP Server

### Start the Server

```bash
npm run start-puppeteer
```

### Start the Web UI

```bash
npm run start-puppeteer-ui
```

Then access the UI at http://localhost:3000/

## Using with Claude or Other MCP-compatible Assistants

Once the MCP server is running, Claude and other MCP-compatible assistants can use it to automate browser interactions. The assistant will be able to use all the tools documented in the README, including:

- Browser navigation
- Clicking elements
- Filling forms
- Taking screenshots
- Memory profiling

Remember to reference the full documentation in the README.md file for detailed usage instructions.

