# Updating Puppeteer Dev Tools

Follow these steps to publish a new version of the package:

## 1. Update the package version

```bash
# Increment patch version (for bug fixes)
npm version patch

# Or for minor feature additions
npm version minor

# Or for major changes
npm version major
```

## 2. Build the package

```bash
npm run build
```

## 3. Publish the update

```bash
npm publish --access public
```

## 4. Verify the publication

```bash
npm view @mikesterific/puppeteer-dev-tools
```

## Publishing to an organization scope

If you want to publish to an organization scope in the future (like @modelcontextprotocol), you'll need to:

1. Get added as a maintainer to the organization on npm
2. Update the package name in package.json
3. Follow the same publish steps above


