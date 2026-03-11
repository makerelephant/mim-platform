#!/usr/bin/env node
/**
 * MiM Brain Intelligence MCP Server
 *
 * Conversational co-pilot for the CEO.
 * Connects directly to Supabase (bypasses Vercel),
 * exposing 28 tools across 9 domains:
 *
 *   Organizations  (4): search, get, create, update
 *   Contacts       (4): search, get, create, update
 *   Tasks          (3): list, create, update
 *   Pipeline       (2): list, update
 *   Knowledge      (4): search, get, semantic_search, embed_knowledge
 *   Intelligence   (3): entity dossier, activity feed, business summary
 *   Scanners       (3): trigger scan, generate report, get report
 *   Instructions   (3): create, list, update
 *   Brain          (2): ask_brain, embed_correspondence
 *
 * Transport: stdio (for Claude Desktop / Claude Code)
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerOrganizationTools } from "./tools/organizations.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerIntelligenceTools } from "./tools/intelligence.js";
import { registerScannerTools } from "./tools/scanners.js";
import { registerInstructionTools } from "./tools/instructions.js";
import { registerAskBrainTool } from "./tools/ask-brain.js";

// Create MCP server
const server = new McpServer({
  name: "mim-brain",
  version: "1.0.0",
});

// Register all tool domains
registerOrganizationTools(server);
registerContactTools(server);
registerTaskTools(server);
registerPipelineTools(server);
registerKnowledgeTools(server);
registerIntelligenceTools(server);
registerScannerTools(server);
registerInstructionTools(server);
registerAskBrainTool(server);

// Start with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MiM Brain MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
