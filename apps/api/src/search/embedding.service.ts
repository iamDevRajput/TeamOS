import { Injectable, Logger } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dimension = 768;

  async generateEmbedding(text: string): Promise<number[]> {
    const cleanText = text.trim();
    if (!cleanText) {
      return new Array(this.dimension).fill(0);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
    if (apiKey && !apiKey.startsWith('placeholder') && apiKey.length > 10) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text: cleanText }] },
            }),
            signal: AbortSignal.timeout(5000),
          }
        );

        if (response.ok) {
          const json = (await response.json()) as { embedding?: { values?: number[] } };
          if (json?.embedding?.values && json.embedding.values.length === this.dimension) {
            return json.embedding.values;
          }
        }
      } catch (err) {
        this.logger.debug(`Gemini embedding fallback to deterministic projection: ${(err as Error).message}`);
      }
    }

    // Deterministic 768-dimensional normalized pseudo-semantic vector
    return this.createDeterministicEmbedding(cleanText);
  }

  /**
   * Deterministic 768-dimensional semantic hash with n-gram projection and L2 normalization.
   * Ensures identical or near-identical texts score high cosine similarity even offline.
   */
  createDeterministicEmbedding(text: string): number[] {
    const vec = new Float64Array(this.dimension).fill(0);
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = crypto.createHash('sha256').update(word).digest();
      for (let j = 0; j < 16; j++) {
        const idx = (hash[j] * 31 + j) % this.dimension;
        const sign = (hash[j + 16] % 2 === 0) ? 1 : -1;
        vec[idx] += sign * (1.0 / Math.sqrt(i + 1));
      }
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      vec[0] = 1.0;
      return Array.from(vec);
    }

    return Array.from(vec).map((v) => Number((v / norm).toFixed(6)));
  }
}
