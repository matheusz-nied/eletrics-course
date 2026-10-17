let count = 0;

/** An id unique within the page being rendered: "termo-borne-3". */
export function uniqueId(prefix: string): string {
  count += 1;
  return `${prefix}-${count}`;
}
