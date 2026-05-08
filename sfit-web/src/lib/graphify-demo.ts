import { z } from 'zod';

export const GraphifyDemoSchema = z.object({
  marker: z.string(),
  count: z.number(),
});

export type GraphifyDemoInput = z.infer<typeof GraphifyDemoSchema>;

export function graphifyDemoCompute(input: GraphifyDemoInput): number {
  return input.count * 2;
}

export function graphifyDemoFormat(input: GraphifyDemoInput): string {
  return `${input.marker}=${graphifyDemoCompute(input)}`;
}
