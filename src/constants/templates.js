import { deepMerge } from '../utils/object.js';

export const FONT_STACKS = {
  serifBn: { label: 'Noto Serif Bengali', css: "'Noto Serif Bengali','Source Serif 4','Times New Roman',serif" },
  sansBn: { label: 'Noto Sans Bengali', css: "'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif" },
  hind: { label: 'Hind Siliguri', css: "'Hind Siliguri','Noto Sans Bengali',Arial,sans-serif" },
  tiro: { label: 'Tiro Bangla', css: "'Tiro Bangla','Noto Serif Bengali',serif" },
  times: { label: 'Times New Roman', css: "'Times New Roman','Noto Serif Bengali',serif" },
  arial: { label: 'Arial', css: "Arial,'Noto Sans Bengali',sans-serif" },
};
// Font names written into DOCX files (must exist on the machine that opens the file)
export const DOCX_FONTS = ['Nirmala UI', 'SolaimanLipi', 'Kalpurush', 'Vrinda', 'Noto Sans Bengali', 'Times New Roman', 'Arial'];
export const PAGE_SIZES = { A4: [210, 297], A5: [148, 210], Legal: [216, 356], Letter: [216, 279] };

export const DEFAULT_DESIGN = {
  templateId: 'classic',
  language: 'bn',
  digits: 'bn',
  fontFamily: 'serifBn',
  docxFont: 'Nirmala UI',
  fontSize: 11.5,
  lineHeight: 1.45,
  page: { size: 'A4', orientation: 'portrait', customW: 210, customH: 297 },
  margins: { top: 14, right: 14, bottom: 14, left: 14 },
  border: { enabled: false, style: 'solid', width: 1.2, color: '#111111', inset: 6 },
  accent: '#111111',
  header: { layout: 'centered', showLogo: true, showInstitution: true, showExam: true, infoLayout: 'grid', titleSize: 16 },
  footer: { enabled: true, text: '', pageNumbers: true, format: 'n_of_total' },
  section: { style: 'bar', align: 'left' },
  question: { spacing: 3, marksAlign: 'right' },
  watermark: { enabled: false, text: '', opacity: 0.08 },
  signature: { enabled: false, labels: ['পরীক্ষক', 'প্রধান শিক্ষক'] },
};

export const resolveDesign = (d) => deepMerge(DEFAULT_DESIGN, d || {});

export function pageDims(design) {
  const p = design.page || {};
  let [w, h] = p.size === 'Custom' ? [Number(p.customW) || 210, Number(p.customH) || 297] : PAGE_SIZES[p.size] || PAGE_SIZES.A4;
  if (p.orientation === 'landscape') [w, h] = [h, w];
  return [w, h];
}

const T = (id, en, bn, design) => ({ id, name: { en, bn }, design: { ...design, templateId: id } });
export const BUILTIN_TEMPLATES = [
  T('classic', 'Classic Academic', 'ক্লাসিক একাডেমিক', { fontFamily: 'serifBn', section: { style: 'underline', align: 'left' }, header: { layout: 'centered' } }),
  T('modern', 'Modern Institutional', 'মডার্ন প্রাতিষ্ঠানিক', { fontFamily: 'hind', accent: '#0B6E4F', header: { layout: 'split' }, section: { style: 'bar', align: 'left' } }),
  T('minimal', 'Premium Minimal', 'প্রিমিয়াম মিনিমাল', { fontFamily: 'sansBn', accent: '#222222', header: { layout: 'minimal', infoLayout: 'line' }, section: { style: 'plain', align: 'left' }, footer: { enabled: true, text: '', pageNumbers: true, format: 'n' }, question: { spacing: 4, marksAlign: 'right' } }),
  T('board', 'Board Examination', 'বোর্ড পরীক্ষা', { fontFamily: 'serifBn', border: { enabled: true, style: 'double', width: 3, color: '#111111', inset: 5 }, section: { style: 'boxed', align: 'center' }, header: { layout: 'centered' } }),
  T('university', 'University Examination', 'বিশ্ববিদ্যালয় পরীক্ষা', { language: 'en', digits: 'en', fontFamily: 'times', header: { layout: 'centered', infoLayout: 'grid' }, section: { style: 'underline', align: 'left' }, signature: { enabled: true, labels: ['Course teacher', 'Controller of examinations'] } }),
  T('coaching', 'Coaching Model Test', 'কোচিং মডেল টেস্ট', { fontFamily: 'hind', accent: '#1F5EA8', section: { style: 'bar', align: 'left' }, watermark: { enabled: true, text: 'MODEL TEST', opacity: 0.07 }, header: { layout: 'split' } }),
  T('madrasa', 'Madrasa Examination', 'মাদ্রাসা পরীক্ষা', { fontFamily: 'tiro', accent: '#0B6E4F', border: { enabled: true, style: 'solid', width: 1.5, color: '#0B6E4F', inset: 5 }, section: { style: 'boxed', align: 'center' }, header: { layout: 'centered' } }),
  T('training', 'Training Assessment', 'প্রশিক্ষণ মূল্যায়ন', { language: 'en', digits: 'en', fontFamily: 'sansBn', header: { layout: 'split', infoLayout: 'grid' }, section: { style: 'underline', align: 'left' }, footer: { enabled: true, text: 'Training assessment', pageNumbers: true, format: 'n_of_total' } }),
  T('custom', 'Custom Layout', 'কাস্টম লেআউট', {}),
];
export const builtinById = (id) => BUILTIN_TEMPLATES.find((t) => t.id === id);
