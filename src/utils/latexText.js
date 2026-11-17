// Best-effort plain-text rendering of LaTeX, used where real math layout is impossible (DOCX export, search).
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Pi: 'Π', Phi: 'Φ', Theta: 'Θ', Lambda: 'Λ' };
const SYM = { times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', infty: '∞', cdot: '·', circ: '°', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', sum: 'Σ', int: '∫', partial: '∂', nabla: '∇', angle: '∠', triangle: '△', ldots: '…', cdots: '⋯', in: '∈', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃', therefore: '∴', because: '∵', perp: '⊥', parallel: '∥', sim: '∼', propto: '∝', prime: '′' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ', '(': '⁽', ')': '⁾' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '(': '₍', ')': '₎' };

const script = (s, map, mark) => (s.split('').every((c) => map[c]) ? s.split('').map((c) => map[c]).join('') : `${mark}(${s})`);

export function latexToText(latex) {
  let s = String(latex || '');
  s = s.replace(/\\(?:left|right|quad|qquad|displaystyle)(?![a-zA-Z])/g, '').replace(/\\[,;!]/g, ' ');
  for (let i = 0; i < 6; i++) s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, '$1√($2)').replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\vec\s*\{([^{}]*)\}/g, '$1\u20D7').replace(/\\overline\s*\{([^{}]*)\}/g, (_, x) => x.split('').join('\u0305') + '\u0305');
  s = s.replace(/\\begin\{[a-zA-Z]*matrix\}/g, '[').replace(/\\end\{[a-zA-Z]*matrix\}/g, ']').replace(/\\\\/g, '; ').replace(/&/g, ' ');
  s = s.replace(/\^\s*\{([^{}]*)\}/g, (_, x) => script(x, SUP, '^')).replace(/\^\s*([A-Za-z0-9+-])/g, (_, x) => script(x, SUP, '^'));
  s = s.replace(/_\s*\{([^{}]*)\}/g, (_, x) => script(x, SUB, '_')).replace(/_\s*([A-Za-z0-9+-])/g, (_, x) => script(x, SUB, '_'));
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name) => GREEK[name] || SYM[name] || name);
  return s.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}
