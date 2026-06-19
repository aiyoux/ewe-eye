export function buildSurrealStatement(sql: string, vars?: Record<string, unknown>): string {
  const letPrefix = vars && Object.keys(vars).length > 0
    ? Object.entries(vars)
        .map(([key, value]) => {
          if (!/^[a-zA-Z0-9_]+$/.test(key)) {
            throw new Error(`Invalid variable name in SQL statement: ${key}`);
          }
          return `LET $${key} = ${value === null || value === undefined ? 'none' : JSON.stringify(value)};`;
        })
        .join('\n') + '\n'
    : '';

  return letPrefix + sql;
}

export function buildSurrealQuery(sql: string, vars?: Record<string, unknown>) {
  return { sql, vars };
}

export function extractQueryRows<T = Record<string, unknown>>(queryResult: unknown): T[] {
  if (!Array.isArray(queryResult)) return [];

  const nestedResult = queryResult.findLast?.(
    (entry: unknown) =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      Array.isArray((entry as { result?: unknown[] }).result)
  ) as { result?: T[] } | undefined;

  if (nestedResult?.result) {
    return nestedResult.result;
  }

  const rows: T[] = [];
  for (const entry of queryResult) {
    if (entry && typeof entry === 'object' && Array.isArray((entry as { result?: unknown[] }).result)) {
      rows.push(...((entry as { result: T[] }).result));
      continue;
    }

    if (entry && typeof entry === 'object') {
      rows.push(entry as T);
    }
  }

  return rows;
}
