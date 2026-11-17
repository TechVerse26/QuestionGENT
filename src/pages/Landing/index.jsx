import { Link } from 'react-router-dom';
import MainLayout from '../../layouts/MainLayout.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { QUESTION_TYPES } from '../../constants/questionTypes.js';

const serif = { fontFamily: "'Noto Serif Bengali', 'Source Serif 4', serif" };

// A small static sheet that shows what the product produces (mixed MCQ + CQ in one paper)
function Sheet() {
  return (
    <div className="mx-auto w-full max-w-[380px] border border-line bg-white p-5 text-[12.5px] leading-relaxed text-[#111]" style={serif} aria-hidden="true">
      <p className="text-center text-[15px] font-bold">আদর্শ উচ্চ বিদ্যালয়</p>
      <p className="text-center">বার্ষিক পরীক্ষা ২০২৬ | নবম শ্রেণি</p>
      <div className="mt-2 grid grid-cols-3 border-l border-t border-[#111] text-[11px]">
        {['বিষয়: বিজ্ঞান', 'সময়: ২ ঘণ্টা', 'পূর্ণমান: ৫০'].map((x) => <div key={x} className="border-b border-r border-[#111] px-1.5 py-0.5">{x}</div>)}
      </div>
      <div className="mt-3 flex justify-between bg-[#0B6E4F] px-2 py-0.5 font-bold text-white"><span>ক-বিভাগ: বহুনির্বাচনি</span><span>মান: ২০</span></div>
      <div className="mt-1.5 flex justify-between"><span>১. পানির রাসায়নিক সংকেত কোনটি?</span><b>[১]</b></div>
      <div className="grid grid-cols-4 pl-4"><span>ক. CO₂</span><span>খ. H₂O</span><span>গ. NaCl</span><span>ঘ. O₂</span></div>
      <div className="mt-3 flex justify-between bg-[#0B6E4F] px-2 py-0.5 font-bold text-white"><span>খ-বিভাগ: সৃজনশীল</span><span>মান: ১০</span></div>
      <p className="mt-1.5">১. রহিম সাহেব তার বাগানে ১০০টি আমগাছ রোপণ করলেন...</p>
      {[['ক.', 'আম কোন ধরনের ফল?', '১'], ['খ.', 'গাছ রোপণের উপকারিতা ব্যাখ্যা করো।', '২'], ['গ.', 'মোট আমের সংখ্যা নির্ণয় করো।', '৩'], ['ঘ.', 'উদ্যোগটি লাভজনক কি না বিশ্লেষণ করো।', '৪']].map(([a, b, m]) => (
        <div key={a} className="flex justify-between pl-3"><span>{a} {b}</span><b>[{m}]</b></div>
      ))}
    </div>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  const user = useAuthStore((s) => s.user);
  const features = [
    ['One paper, every question type', 'Mix MCQ, creative, short, broad, math and your own custom types in the same paper, with per-section marks and answering rules.'],
    ['A question bank that remembers', 'Search by class, subject and chapter, catch duplicates, keep history, and reuse questions across papers and sets.'],
    ['Print-ready Bengali output', 'The preview is paginated like the real page. Print or save as PDF, or export a Word file and a separate answer key.'],
  ];
  return (
    <MainLayout>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">{t('Build the whole exam paper in one place.')}</h1>
          <p className="mb-6 max-w-xl text-lg text-muted">{t('MCQ, creative, short and broad questions in a single paper, with a print-ready Bengali layout and a question bank behind it.')}</p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn btn-primary h-11 px-5" to={user ? '/app/dashboard' : '/register'}>{user ? t('Open dashboard') : t('Create account')}</Link>
            {!user && <Link className="btn h-11 px-5" to="/login">{t('Sign in')}</Link>}
          </div>
        </div>
        <Sheet />
      </section>

      <section className="border-y border-line bg-surface2">
        <div className="mx-auto grid max-w-6xl md:grid-cols-3">
          {features.map(([h, p], i) => (
            <div key={h} className={`p-6 ${i ? 'md:border-l md:border-line' : ''}`}>
              <h2 className="mb-2 text-lg">{t(h)}</h2>
              <p className="text-sm text-muted">{t(p)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-4 text-2xl">{t('Question types you can use')}</h2>
        <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {QUESTION_TYPES.map((x) => <li key={x.id} className="border-b border-line py-2 text-sm">{lang === 'bn' ? x.bn : x.en}</li>)}
        </ul>
      </section>
    </MainLayout>
  );
}
