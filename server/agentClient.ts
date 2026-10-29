import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

export interface InteractionOptions {
  prompt: string;
  agentName?: string;
  environmentId?: string;
  previousInteractionId?: string;
  inlineSources?: Array<{ type: 'inline'; content: string; target: string }>;
  signal?: AbortSignal;
}

let genAIClient: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Invokes the Google Managed Agent using the official @google/genai Interactions API
 * Target: antigravity-preview-05-2026
 */
export async function createManagedAgentStream(opts: InteractionOptions) {
  const ai = getGenAI();
  const agentName = opts.agentName ?? 'antigravity-preview-05-2026';

  const config: Record<string, unknown> = {
    agent: agentName,
    input: opts.prompt,
    stream: true,
  };

  if (opts.environmentId) {
    config.environment = opts.environmentId;
  } else {
    config.environment = 'remote';
  }

  if (opts.previousInteractionId) {
    config.previous_interaction_id = opts.previousInteractionId;
  }

  return ai.interactions.create(config as any, { timeout: 300000 });
}

/**
 * Recursively load local scripts to seed into the remote container
 */
export function loadAgentFiles(dir: string, basePath: string): Array<{ type: 'inline'; content: string; target: string }> {
  let files: Array<{ type: 'inline'; content: string; target: string }> = [];
  if (!fs.existsSync(dir)) return files;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const targetPath = path.posix.join(basePath, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(loadAgentFiles(fullPath, targetPath));
      } else {
        files.push({
          type: 'inline',
          content: fs.readFileSync(fullPath, 'utf-8'),
          target: targetPath,
        });
      }
    }
  } catch (err) {
    console.warn(`Could not read agent directory ${dir}:`, err);
  }
  return files;
}

export interface AgentEvent {
  type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'interaction' | 'complete' | 'error' | 'done';
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  result?: string;
  interaction?: Record<string, unknown>;
  message?: string;
}

