import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../src/mcp/index.js';

describe('MCP Server', () => {
  it('lists all 10 tools', async () => {
    const server = createMcpServer();
    // @ts-ignore — access internal tool registry for testing
    const tools = server._registeredTools;
    expect(Object.keys(tools)).toHaveLength(10);
    expect(Object.keys(tools)).toContain('trim_video');
    expect(Object.keys(tools)).toContain('get_video_info');
  });
});
