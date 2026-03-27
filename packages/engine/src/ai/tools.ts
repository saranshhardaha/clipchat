import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';
import { z } from 'zod';
import { MCP_TOOLS } from '../mcp/tools.js';

// Converts a Zod type to a JSON Schema property definition.
// Only handles the types present in src/types/tools.ts.
function zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  if (zodType instanceof z.ZodDefault) {
    return zodTypeToJsonSchema(zodType._def.innerType);
  }
  if (zodType instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (zodType instanceof z.ZodEnum) {
    return { type: 'string', enum: zodType.options };
  }
  if (zodType instanceof z.ZodArray) {
    return { type: 'array', items: zodTypeToJsonSchema(zodType.element) };
  }
  if (zodType instanceof z.ZodObject) {
    return zodObjectToJsonSchema(zodType);
  }
  if (zodType instanceof z.ZodLiteral) {
    return { type: typeof zodType.value, enum: [zodType.value] };
  }
  if (zodType instanceof z.ZodUnion) {
    const options = zodType.options as z.ZodTypeAny[];
    // Collapse union of literals into a single enum (cleaner for LLMs)
    if (options.every((o) => o instanceof z.ZodLiteral)) {
      const values = options.map((o) => (o as z.ZodLiteral<unknown>).value);
      return { type: typeof values[0], enum: values };
    }
    return { oneOf: options.map(zodTypeToJsonSchema) };
  }
  throw new Error(`Unsupported Zod type: ${zodType.constructor.name}`);
}

// Converts a ZodObject to a JSON Schema object with properties + required.
function zodObjectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema.shape)) {
    properties[key] = zodTypeToJsonSchema(value as z.ZodTypeAny);
    const isOptional = value instanceof z.ZodOptional || value instanceof z.ZodDefault;
    if (!isOptional) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}

// Returns all 10 FFmpeg tools formatted for the OpenRouter/OpenAI tool_calls API.
export function buildOpenRouterTools(): ChatCompletionTool[] {
  return MCP_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodObjectToJsonSchema(tool.schema as z.ZodObject<z.ZodRawShape>),
    },
  }));
}

// Creates an OpenAI client pointed at OpenRouter.
export function createOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable is not set');
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
