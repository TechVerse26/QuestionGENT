import katex from 'katex';
import 'katex/dist/katex.min.css';

export function renderMath(latex, display = false) {
  try {
    return katex.renderToString(String(latex || ''), { throwOnError: false, displayMode: !!display, output: 'html', strict: 'ignore', trust: false });
  } catch (e) {
    return '';
  }
}
