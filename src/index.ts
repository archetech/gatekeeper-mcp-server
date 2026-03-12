#!/usr/bin/env node
/**
 * Gatekeeper MCP Server for Archon Protocol
 * DID resolution and search capabilities via MCP
 * 
 * Supports both stdio (local) and HTTP/SSE (remote) transports
 */

import dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from 'express';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import GatekeeperClient from '@didcid/gatekeeper/client';
import { randomUUID } from 'crypto';

// Configuration
const GATEKEEPER_URL = process.env.ARCHON_GATEKEEPER_URL || process.env.GATEKEEPER_URL || 'https://archon.technology';
const PORT = parseInt(process.env.PORT || '4251', 10);
const HOST = process.env.HOST || '0.0.0.0';
const TRANSPORT = process.env.TRANSPORT || 'stdio'; // 'stdio' or 'http'

const SERVER_NAME = "gatekeeper-mcp-server";
const SERVER_VERSION = "0.1.0";

// Global gatekeeper client
let gatekeeper: GatekeeperClient;

// Tool definitions
const tools: Tool[] = [
  {
    name: "resolve_did",
    description: "Resolve a DID to its full document including metadata, verification methods, and services",
    inputSchema: {
      type: "object",
      properties: {
        did: { 
          type: "string", 
          description: "The DID to resolve (e.g., did:cid:bagaaiera...)" 
        },
        confirm: {
          type: "boolean",
          description: "Wait for confirmation before returning (default: false)"
        }
      },
      required: ["did"]
    }
  },
  {
    name: "search_dids",
    description: "Search for DIDs by text query. Searches across DID document content including names, aliases, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query text" 
        }
      },
      required: ["query"]
    }
  },
  {
    name: "query_dids",
    description: "Query DIDs with specific field criteria (e.g., find all DIDs with a specific service type)",
    inputSchema: {
      type: "object",
      properties: {
        where: { 
          type: "object", 
          description: "Query criteria as key-value pairs (e.g., {\"didDocumentData.alias\": \"genitrix\"})" 
        }
      },
      required: ["where"]
    }
  },
  {
    name: "list_dids",
    description: "List DIDs from the gatekeeper with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        updatedAfter: {
          type: "string",
          description: "ISO timestamp - only return DIDs updated after this time"
        },
        updatedBefore: {
          type: "string",
          description: "ISO timestamp - only return DIDs updated before this time"  
        },
        resolve: {
          type: "boolean",
          description: "If true, return full DID documents instead of just DID strings"
        },
        limit: {
          type: "number",
          description: "Maximum number of DIDs to return (default: 100)"
        }
      }
    }
  },
  {
    name: "gatekeeper_status",
    description: "Get the status of the gatekeeper node including uptime, DID counts, and memory usage",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_registries",
    description: "List available DID registries (e.g., hyperswarm, BTCR, etc.)",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_version",
    description: "Get the gatekeeper API version",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_json",
    description: "Retrieve JSON data by CID from IPFS",
    inputSchema: {
      type: "object",
      properties: {
        cid: { 
          type: "string", 
          description: "The CID of the JSON data to retrieve" 
        }
      },
      required: ["cid"]
    }
  },
  {
    name: "get_text",
    description: "Retrieve text data by CID from IPFS",
    inputSchema: {
      type: "object",
      properties: {
        cid: { 
          type: "string", 
          description: "The CID of the text data to retrieve" 
        }
      },
      required: ["cid"]
    }
  }
];

// Tool handler
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    switch (name) {
      case "resolve_did": {
        const did = args.did as string;
        const confirm = args.confirm as boolean | undefined;
        
        const doc = await gatekeeper.resolveDID(did, { confirm });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(doc, null, 2)
          }]
        };
      }

      case "search_dids": {
        const query = args.query as string;
        const results = await gatekeeper.searchDocs(query);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              count: results.length,
              dids: results
            }, null, 2)
          }]
        };
      }

      case "query_dids": {
        const where = args.where as Record<string, unknown>;
        const results = await gatekeeper.queryDocs(where);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              where,
              count: results.length,
              dids: results
            }, null, 2)
          }]
        };
      }

      case "list_dids": {
        const updatedAfter = args.updatedAfter as string | undefined;
        const updatedBefore = args.updatedBefore as string | undefined;
        const resolve = args.resolve as boolean | undefined;
        const limit = args.limit as number | undefined;
        
        const results = await gatekeeper.getDIDs({
          updatedAfter,
          updatedBefore,
          resolve
        });
        
        // Apply limit if specified
        const limited = limit ? results.slice(0, limit) : results;
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: limited.length,
              total: results.length,
              dids: limited
            }, null, 2)
          }]
        };
      }

      case "gatekeeper_status": {
        const status = await gatekeeper.getStatus();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              gatekeeperUrl: GATEKEEPER_URL,
              ...status
            }, null, 2)
          }]
        };
      }

      case "list_registries": {
        const registries = await gatekeeper.listRegistries();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              registries,
              count: registries.length
            }, null, 2)
          }]
        };
      }

      case "get_version": {
        const version = await gatekeeper.getVersion();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              gatekeeperUrl: GATEKEEPER_URL,
              apiVersion: version
            }, null, 2)
          }]
        };
      }

      case "get_json": {
        const cid = args.cid as string;
        const data = await gatekeeper.getJSON(cid);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };
      }

      case "get_text": {
        const cid = args.cid as string;
        const data = await gatekeeper.getText(cid);
        return {
          content: [{
            type: "text",
            text: data || "(empty)"
          }]
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true
    };
  }
}

function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments || {});
  });

  return server;
}

async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  console.error(`Gatekeeper: ${GATEKEEPER_URL}`);
}

async function runHttp() {
  const app = express();
  
  // Parse JSON bodies for POST requests
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      server: SERVER_NAME, 
      version: SERVER_VERSION,
      gatekeeper: GATEKEEPER_URL 
    });
  });

  // Store active transports by session
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // MCP endpoint
  app.all('/mcp', async (req, res) => {
    // Get or create session ID
    const sessionId = req.headers['mcp-session-id'] as string || randomUUID();
    
    let transport = transports.get(sessionId);
    
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });
      
      const server = createServer();
      await server.connect(transport);
      
      transports.set(sessionId, transport);
      
      transport.onclose = () => {
        transports.delete(sessionId);
      };
    }
    
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(PORT, HOST, () => {
    console.log(`${SERVER_NAME} v${SERVER_VERSION} running on http://${HOST}:${PORT}`);
    console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
    console.log(`Health check: http://${HOST}:${PORT}/health`);
    console.log(`Gatekeeper: ${GATEKEEPER_URL}`);
  });
}

async function main() {
  // Initialize gatekeeper client
  gatekeeper = new GatekeeperClient();
  await gatekeeper.connect({
    url: GATEKEEPER_URL,
    waitUntilReady: true,
    intervalSeconds: 3,
    chatty: false,
    becomeChattyAfter: 2
  });

  if (TRANSPORT === 'http') {
    await runHttp();
  } else {
    await runStdio();
  }
}

// Cleanup
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
