export type NamedTaskFile = { name?: string; filename?: string };

export function extractTaskNumber(filename: string): number | null;
export function mapTaskFiles<T extends NamedTaskFile>(files: T[]): Record<number, T[]>;
