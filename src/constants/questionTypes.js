export const QUESTION_TYPES = [
  { id: 'mcq', en: 'MCQ', bn: 'বহুনির্বাচনি (MCQ)' },
  { id: 'cq', en: 'Creative question (CQ)', bn: 'সৃজনশীল প্রশ্ন (CQ)' },
  { id: 'short', en: 'Short question', bn: 'সংক্ষিপ্ত প্রশ্ন' },
  { id: 'broad', en: 'Broad question', bn: 'বর্ণনামূলক প্রশ্ন' },
  { id: 'fill', en: 'Fill in the blanks', bn: 'শূন্যস্থান পূরণ' },
  { id: 'tf', en: 'True / False', bn: 'সত্য / মিথ্যা' },
  { id: 'matching', en: 'Matching', bn: 'মিলকরণ' },
  { id: 'math', en: 'Mathematical', bn: 'গাণিতিক প্রশ্ন' },
  { id: 'practical', en: 'Practical', bn: 'ব্যবহারিক প্রশ্ন' },
  { id: 'comprehension', en: 'Comprehension / passage', bn: 'অনুচ্ছেদভিত্তিক প্রশ্ন' },
  { id: 'case_study', en: 'Case study', bn: 'কেস স্টাডি' },
  { id: 'diagram', en: 'Diagram-based', bn: 'চিত্রভিত্তিক প্রশ্ন' },
  { id: 'map', en: 'Map-based', bn: 'মানচিত্রভিত্তিক প্রশ্ন' },
  { id: 'grammar', en: 'Grammar', bn: 'ব্যাকরণ' },
  { id: 'translation', en: 'Translation', bn: 'অনুবাদ' },
  { id: 'ordering', en: 'Ordering / rearrangement', bn: 'ক্রম সাজানো' },
  { id: 'assertion', en: 'Assertion and reason', bn: 'দাবি ও কারণ' },
  { id: 'numeric', en: 'Numeric answer', bn: 'সংখ্যাভিত্তিক উত্তর' },
  { id: 'programming', en: 'Programming / coding', bn: 'প্রোগ্রামিং প্রশ্ন' },
  { id: 'custom', en: 'Custom type', bn: 'কাস্টম প্রশ্ন' },
];

// Types made of a stimulus plus labelled sub-questions (the CQ structure)
export const STIMULUS_TYPES = ['cq', 'comprehension', 'case_study', 'diagram', 'map'];
// Types made of a stem plus optional labelled parts
export const SIMPLE_TYPES = ['short', 'broad', 'math', 'grammar', 'translation'];
export const OPTION_TYPES = ['mcq', 'assertion'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export const typeInfo = (id) => QUESTION_TYPES.find((t) => t.id === id) || QUESTION_TYPES[QUESTION_TYPES.length - 1];
export const typeLabel = (id, lang = 'en') => (lang === 'bn' ? typeInfo(id).bn : typeInfo(id).en);
