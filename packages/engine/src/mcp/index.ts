import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCP_TOOLS } from './tools.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'clipchat', version: '0.1.0' });

  for (const tool of MCP_TOOLS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.tool(tool.name, tool.description, tool.schema.shape, async (input: any) => {
      const result = await tool.handler(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    });
  }

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ClipChat MCP server running on stdio');
}
