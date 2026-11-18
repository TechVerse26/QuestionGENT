// The 50-template marketplace catalog (names/numbers/tiers from the master prompt). This file is the ACCESS MATRIX and the
// ids only: each template's design configuration and exam structure are authored in Phase 4. Existing presets keep their
// ids (classic, modern, minimal, board, university, coaching, madrasa, training) so every stored `design.templateId` stays valid.
import { TIER_IDS, tierRank } from '../plans/tiers.js';

// [number, id, English name, category]
const ROWS = [
  [1, 'classic', 'Classic Academic', 'general'], [2, 'modern', 'Modern Institutional', 'general'], [3, 'minimal', 'Premium Minimal', 'general'],
  [4, 'primary-school', 'Primary School Exam', 'school'], [5, 'class-test', 'Class Test', 'school'], [6, 'monthly-assessment', 'Monthly Assessment', 'school'],
  [7, 'half-yearly', 'Half-Yearly Examination', 'school'], [8, 'annual-final', 'Annual Final Examination', 'school'],
  [9, 'board', 'SSC Board Style', 'board'], [10, 'hsc-board', 'HSC Board Style', 'board'], [11, 'madrasa', 'Madrasa Examination', 'board'],
  [12, 'coaching', 'Coaching Model Test', 'coaching'], [13, 'mcq-practice', 'MCQ Practice Paper', 'mcq'], [14, 'creative', 'Creative Question Paper', 'school'],
  [15, 'english-medium', 'English Medium Exam', 'school'], [16, 'university', 'University Basic', 'higher-ed'], [17, 'practical', 'Practical Examination', 'practical'],
  [18, 'viva-oral', 'Viva & Oral Test', 'practical'], [19, 'training', 'Training Assessment', 'training'], [20, 'worksheet', 'Worksheet & Answer Sheet', 'school'],

  [21, 'admission-test', 'Professional Admission Test', 'admission'], [22, 'scholarship', 'Scholarship Examination', 'admission'], [23, 'job-recruitment', 'Job Recruitment Test', 'recruitment'],
  [24, 'omr-mcq', 'OMR MCQ Sheet', 'mcq'], [25, 'confidential', 'Confidential Exam Paper', 'secure'], [26, 'chapter-test', 'Subject-wise Chapter Test', 'school'],
  [27, 'university-admission-mock', 'University Admission Mock', 'admission'], [28, 'coaching-grand', 'Coaching Grand Model Test', 'coaching'],

  [29, 'bloom-blueprint', "Bloom's Taxonomy Blueprint", 'outcome'], [30, 'competency-based', 'Competency Based Assessment', 'outcome'], [31, 'case-study', 'Case Study Examination', 'advanced'],
  [32, 'bilingual', 'Bilingual Examination', 'advanced'], [33, 'university-semester-final', 'University Semester Final', 'higher-ed'], [34, 'lab-practical-rubric', 'Lab & Practical Rubric', 'practical'],
  [35, 'advanced-sectionwise', 'Advanced Section-wise Exam', 'advanced'], [36, 'multi-set', 'Multiple Set A/B/C/D', 'advanced'], [37, 'diagnostic-placement', 'Diagnostic & Placement Test', 'assessment'],
  [38, 'answer-key-scheme', 'Detailed Answer Key & Mark Scheme', 'assessment'],

  [39, 'multi-campus', 'Multi-Campus Common Exam', 'institution'], [40, 'institution-branded', 'Institution Branded Master', 'institution'], [41, 'qr-barcode-verified', 'QR & Barcode Verification', 'secure'],
  [42, 'department-common', 'Department-wise Common Exam', 'institution'], [43, 'curriculum-outcome-mapping', 'Curriculum Outcome Mapping', 'outcome'], [44, 'moderation-reviewer', 'Moderation & Reviewer Copy', 'institution'],
  [45, 'term-semester', 'Term & Semester Assessment', 'institution'],

  [46, 'whitelabel-international', 'White-label International Exam', 'enterprise'], [47, 'certification-accreditation', 'Certification & Accreditation', 'enterprise'],
  [48, 'secure-entrance', 'Secure Entrance Examination', 'enterprise'], [49, 'corporate-certification', 'Corporate Professional Certification', 'enterprise'],
  [50, 'enterprise-configurable', 'Fully Configurable Enterprise Layout', 'enterprise'],
];

// number ranges -> tier (Free 1-20, Starter 21-28, Professional 29-38, Institution 39-45, Enterprise 46-50)
const tierOf = (n) => (n <= 20 ? 'free' : n <= 28 ? 'starter' : n <= 38 ? 'professional' : n <= 45 ? 'institution' : 'enterprise');

export const TEMPLATE_CATALOG = ROWS.map(([number, id, name, category]) => ({ number, id, name: { en: name }, category, tier: tierOf(number), minRank: tierRank(tierOf(number)) }));

// Expected number of templates available per tier (cumulative) - the master prompt's access matrix.
export const TEMPLATE_ACCESS_MATRIX = { free: 20, starter: 28, professional: 38, institution: 45, enterprise: 50 };

// Presets that exist in the current app. `custom` is the blank "My layout" base, not part of the marketplace.
export const LEGACY_TEMPLATE_IDS = ['classic', 'modern', 'minimal', 'board', 'university', 'coaching', 'madrasa', 'training', 'custom'];
export const SYSTEM_TEMPLATE_IDS = ['custom'];

export const templateById = (id) => TEMPLATE_CATALOG.find((t) => t.id === id) || null;
export const accessibleTemplates = (maxRank) => TEMPLATE_CATALOG.filter((t) => t.minRank <= maxRank);

// Server-side gate: higher tiers automatically include every lower tier. Unknown ids are refused.
export function canUseTemplate(id, maxRank) {
  if (SYSTEM_TEMPLATE_IDS.includes(id)) return true;
  const t = templateById(id);
  return !!t && t.minRank <= maxRank;
}

export { TIER_IDS };
