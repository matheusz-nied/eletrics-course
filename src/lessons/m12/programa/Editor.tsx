/**
 * Code editor of the microcontroller widget: a <textarea> with a line
 * number gutter and the error line highlighted. Tab inserts two spaces
 * (Esc, then Tab, leaves the editor), Enter keeps the indentation and
 * Ctrl+Enter uploads.
 */
import { memo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (code: string) => void;
  onUpload: () => void;
  errorLine: number | null;
  hintId: string;
}

function Editor({ id, value, onChange, onUpload, errorLine, hintId }: Props) {
  const gutter = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);
  const [scrollTop, setScrollTop] = useState(0);
  const lines = value.split('\n').length;

  const onScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    if (gutter.current) gutter.current.scrollTop = top;
    setScrollTop(top);
  };

  /** Replaces the selection and puts the caret at `caret` (relative to start). */
  const replace = (
    ta: HTMLTextAreaElement,
    start: number,
    end: number,
    text: string,
    caret: number,
  ) => {
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + caret;
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = ta;
    if (e.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onUpload();
      return;
    }
    if (e.key === 'Tab' && !escaped.current && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      if (e.shiftKey) {
        const lead = /^ {1,2}/.exec(value.slice(lineStart))?.[0].length ?? 0;
        if (lead > 0) {
          onChange(value.slice(0, lineStart) + value.slice(lineStart + lead));
          requestAnimationFrame(() => {
            ta.selectionStart = Math.max(lineStart, s - lead);
            ta.selectionEnd = Math.max(lineStart, end - lead);
          });
        }
        return;
      }
      replace(ta, s, end, '  ', 2);
      return;
    }
    escaped.current = false;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      let indent = /^\s*/.exec(line)![0];
      if (/\{\s*$/.test(line)) indent += '  ';
      replace(ta, s, end, `\n${indent}`, indent.length + 1);
    }
  };

  return (
    <div className="mide__code">
      <div className="mide__gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={i + 1 === errorLine ? 'mide__ln mide__ln--erro' : 'mide__ln'}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="mide__area">
        {errorLine !== null && errorLine <= lines && (
          <div
            className="mide__band"
            style={{
              top: `calc(0.75rem + ${errorLine - 1} * 1.5em)`,
              transform: `translateY(${-scrollTop}px)`,
            }}
            aria-hidden="true"
          />
        )}
        <textarea
          id={id}
          className="mide__textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-describedby={hintId}
          aria-invalid={errorLine !== null || undefined}
        />
      </div>
    </div>
  );
}

export default memo(Editor);
