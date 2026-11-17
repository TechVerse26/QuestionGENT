import { Extension, Node } from '@tiptap/core';
import katex from 'katex';

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => (el.style.fontSize ? el.style.fontSize.replace(/['"]+/g, '') : null),
          renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// Inline LaTeX formula rendered with KaTeX. Double-click edits it (editor.storage.mathInline.onEdit).
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addStorage() { return { onEdit: null }; },
  addAttributes() {
    return {
      latex: { default: '', parseHTML: (el) => el.getAttribute('data-latex') || '', renderHTML: () => ({}) },
      display: { default: false, parseHTML: (el) => el.getAttribute('data-display') === 'true', renderHTML: () => ({}) },
    };
  },
  parseHTML() { return [{ tag: 'span[data-latex]' }]; },
  renderHTML({ node }) {
    return ['span', { 'data-latex': node.attrs.latex, 'data-display': node.attrs.display ? 'true' : 'false', class: 'math-inline' }, node.attrs.latex];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('span');
      dom.className = 'math-inline';
      dom.contentEditable = 'false';
      const paint = (n) => {
        dom.style.display = n.attrs.display ? 'block' : 'inline-block';
        try {
          katex.render(n.attrs.latex || '\\square', dom, { throwOnError: false, displayMode: !!n.attrs.display, strict: 'ignore' });
        } catch (e) {
          dom.textContent = n.attrs.latex;
        }
      };
      paint(node);
      dom.addEventListener('dblclick', () => {
        const cb = editor.storage.mathInline && editor.storage.mathInline.onEdit;
        if (cb) cb({ pos: getPos(), latex: current.attrs.latex, display: current.attrs.display });
      });
      return {
        dom,
        update: (n) => {
          if (n.type.name !== 'mathInline') return false;
          current = n;
          paint(n);
          return true;
        },
      };
    };
  },
});
