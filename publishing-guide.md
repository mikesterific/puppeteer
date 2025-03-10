Publishing Guide for @modelcontextprotocol/server-puppeteer

## Steps to Publish

1. **Login to npm**:
   ```bash
   npm login
   ```
   - Enter your npm username, password, and email when prompted
   - If 2FA is enabled, enter the one-time code from your authenticator app

2. **Publish the package**:
   ```bash
   npm publish --access public
   ```
   This will publish the package to the npm registry with public access

3. **Verify the publication**:
   ```bash
   npm view @modelcontextprotocol/server-puppeteer
   ```
   This will show the details of the published package

## Using in Another Project

After publishing, you can install the package in another project with:

```bash
npm install @modelcontextprotocol/server-puppeteer
```

And use it in your MCP configuration as described in the README.

## Starting the HTTP Server

After installing the package, you can start the HTTP server with:

```bash
npx @modelcontextprotocol/server-puppeteer serve
```

