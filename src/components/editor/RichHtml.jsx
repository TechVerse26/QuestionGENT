import { useMemo } from 'react';
import { docToHtml } from '../../utils/richtext.js';
import { renderMath } from './katexRender.js';

// Renders a stored rich-text document. Output is built by docToHtml, which escapes text and whitelists attributes.
export default function RichHtml({ doc, className = '' }) {
  const html = useMemo(() => docToHtml(doc, { renderMath }), [doc]);
  return <div className={`rt ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
