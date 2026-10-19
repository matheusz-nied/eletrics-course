import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Canvases start one at a time. The first frames of a view compile every
 * shader of its part, and on a low-end phone or software WebGL several views
 * starting together hold the page for many seconds. A view waits until the
 * one before it is ready, or until that one has had `MAX_TURN_MS`.
 */
export const MAX_TURN_MS = 4000;

interface Ticket {
  grant: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

const waiting: Ticket[] = [];
let active: Ticket | null = null;

function next() {
  if (active) return;
  const ticket = waiting.shift();
  if (!ticket) return;
  active = ticket;
  ticket.timer = setTimeout(() => release(ticket), MAX_TURN_MS);
  ticket.grant();
}

function release(ticket: Ticket) {
  const index = waiting.indexOf(ticket);
  if (index >= 0) waiting.splice(index, 1);
  if (active !== ticket) return;
  clearTimeout(ticket.timer);
  active = null;
  next();
}

/**
 * Joins the queue: `grant` is called when it is this view's turn (at once if
 * no other view is starting). The returned function ends the turn, or leaves
 * the queue before it came; calling it again does nothing.
 */
export function takeTurn(grant: () => void): () => void {
  const ticket: Ticket = { grant };
  waiting.push(ticket);
  next();
  return () => release(ticket);
}

/**
 * Whether this view may create its canvas while `wanted`, and the function to
 * call once its first frame is done. Leaving (`wanted` false, or unmounting)
 * gives the turn up too.
 */
export function useStartTurn(wanted: boolean): [granted: boolean, done: () => void] {
  const leave = useRef<(() => void) | null>(null);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!wanted) return;
    const end = takeTurn(() => setGranted(true));
    leave.current = end;
    return () => {
      leave.current = null;
      end();
      setGranted(false);
    };
  }, [wanted]);

  const done = useCallback(() => leave.current?.(), []);

  return [wanted && granted, done];
}

/** Test helper: forgets every view waiting for a turn. */
export function resetStartQueue() {
  if (active) clearTimeout(active.timer);
  active = null;
  waiting.length = 0;
}
