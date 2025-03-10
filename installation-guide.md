# Installing and Using Puppeteer Dev Tools

## Installation

Install the package from npm:

```bash
npm install @mikesterific/puppeteer-dev-tools
```

## Usage in MCP Configuration

Add the following to your MCP configuration file:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["./node_modules/@mikesterific/puppeteer-dev-tools/dist/index.js"]
    }
  }
}
```

## Starting the HTTP Server

You can start the HTTP server to access the web interface:

```bash
npx @mikesterific/puppeteer-dev-tools serve
```

Then access the UI at http://localhost:3000/

## Features

- Browser automation via Puppeteer
- Memory profiling tools
- Web-based interface
- Integration with Model Context Protocol (MCP)

For full documentation, please refer to the README file in the package.

