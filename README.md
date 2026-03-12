# Gatekeeper MCP Server

MCP (Model Context Protocol) server for Archon Gatekeeper - provides DID resolution and search capabilities for AI agents.

## Features

- **resolve_did** - Resolve any DID to its full document
- **search_dids** - Full-text search across DID documents
- **query_dids** - Query DIDs by specific field criteria
- **list_dids** - List DIDs with optional time filters
- **gatekeeper_status** - Get node status and statistics
- **list_registries** - List available DID registries
- **get_json** / **get_text** - Retrieve IPFS content by CID

## Installation

```bash
npm install @archon-protocol/gatekeeper-mcp-server
```

Or run directly:

```bash
npx @archon-protocol/gatekeeper-mcp-server
```

## Configuration

Set environment variables:

```bash
# Gatekeeper URL (defaults to https://archon.technology)
ARCHON_GATEKEEPER_URL=https://archon.technology
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "archon-gatekeeper": {
      "command": "npx",
      "args": ["@archon-protocol/gatekeeper-mcp-server"],
      "env": {
        "ARCHON_GATEKEEPER_URL": "https://archon.technology"
      }
    }
  }
}
```

## Example Queries

### Resolve a DID

```
resolve_did: did:cid:bagaaieraxdxq4fm2kjh6yqjxjor3t2idczkmxd4v7in4u353fa6m6sms2pnq
```

### Search for DIDs

```
search_dids: "genitrix"
```

### Query DIDs by field

```
query_dids: {"didDocumentData.alias": "flaxscrip"}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run production
npm start
```

## Related

- [@archon-protocol/mcp-server](https://npmjs.com/package/@archon-protocol/mcp-server) - Full Keymaster MCP server (wallet, credentials, DMail)
- [Archon Protocol](https://archon.technology) - Decentralized identity for AI agents

## License

MIT
