import { docFromText } from '../utils/richtext.js';
import { newId } from '../utils/id.js';
import { newSection } from '../utils/paper.js';

// Small demo paper used by the Design Studio live preview
export function buildSamplePaper() {
  const mk = (type, body, marks = 1, extra = {}) => ({ id: newId(10), type, marks, difficulty: 'medium', optional: false, body, ...extra });
  const opt = (t) => ({ id: newId(6), content: docFromText(t) });
  const mcq = (stem, opts) => mk('mcq', { stem: docFromText(stem), options: opts.map(opt), optionStyle: 'bnLetter', optionPattern: '{n}.' });
  const m1 = mcq('বাংলাদেশের জাতীয় ফুল কোনটি?', ['গোলাপ', 'শাপলা', 'জবা', 'বেলি']);
  const m2 = mcq('পানির রাসায়নিক সংকেত কোনটি?', ['CO₂', 'H₂O', 'NaCl', 'O₂']);
  const m3 = mcq('আলোর বেগ প্রায় কত?', ['৩ × ১০⁸ মি/সে', '৩ × ১০⁶ মি/সে', '৩৪০ মি/সে', '৩০০ কি.মি/ঘণ্টা']);
  const sub = (label, text, marks) => ({ id: newId(6), label, content: docFromText(text), marks });
  const cq = mk('cq', { stimulus: docFromText('রহিম সাহেব তার বাগানে ১০০টি আমগাছ রোপণ করলেন। প্রতি বছর প্রতিটি গাছ থেকে গড়ে ৫০টি আম পাওয়া যায়।'), subs: [sub('ক', 'আম কোন ধরনের ফল?', 1), sub('খ', 'গাছ রোপণের ফলে পরিবেশের কী উপকার হয়? ব্যাখ্যা করো।', 2), sub('গ', 'উদ্দীপকের বাগান থেকে প্রতি বছর মোট কয়টি আম পাওয়া যায়?', 3), sub('ঘ', 'রহিম সাহেবের উদ্যোগটি অর্থনৈতিকভাবে লাভজনক কি না— বিশ্লেষণ করো।', 4)], subPattern: '{n}.' }, 0);
  const s1 = mk('short', { stem: docFromText('সালোকসংশ্লেষণ কাকে বলে?'), parts: [] }, 2);
  const s2 = mk('short', { stem: docFromText('বাংলাদেশের দুটি প্রধান নদীর নাম লেখো।'), parts: [] }, 2);
  const secA = newSection({ title: 'ক-বিভাগ: বহুনির্বাচনি প্রশ্ন', itemIds: [m1.id, m2.id, m3.id] });
  const secB = newSection({ title: 'খ-বিভাগ: সৃজনশীল প্রশ্ন', itemIds: [cq.id] });
  const secC = newSection({ title: 'গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন', itemIds: [s1.id, s2.id], answerRule: { mode: 'all', count: 0 } });
  const items = Object.fromEntries([m1, m2, m3, cq, s1, s2].map((q) => [q.id, q]));
  return {
    paper: {
      id: 'sample', title: 'Sample', status: 'draft',
      info: { institutionName: 'আদর্শ উচ্চ বিদ্যালয়', address: 'ঢাকা', logoUrl: '', examName: 'বার্ষিক পরীক্ষা ২০২৬', className: 'নবম', group: '', section: '', department: '', subject: 'সাধারণ বিজ্ঞান', subjectCode: '১২৭', year: '২০২৬', date: '', duration: '২ ঘণ্টা ৩০ মিনিট', fullMarks: '', passMarks: '', instructions: '' },
      design: {}, sections: [secA, secB, secC],
    },
    items,
  };
}
