import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTITUTION_TYPES } from '../../src/constants/options.js';
import {
  idSchema, emailSchema, textSchema, httpsUrlSchema, sessionCreateInput, institutionCreateInput, inviteCreateInput, memberRoleChangeInput,
  uploadRequestInput, sanitizeFileName, aiGenerateInput, totpCodeInput, recoveryCodeInput, staffCreateInput, INSTITUTION_TYPE_IDS, AI_QUESTION_TYPES, UPLOAD_PURPOSES,
} from '../../src/shared/schemas/index.js';

const ok = (schema, v) => { const r = schema.safeParse(v); assert.ok(r.success, JSON.stringify(r.error?.issues)); return r.data; };
const bad = (schema, v, why = '') => assert.equal(schema.safeParse(v).success, false, `should reject: ${why || JSON.stringify(v)}`);

test('institution types match the legacy options exactly', () => {
  assert.deepEqual(INSTITUTION_TYPE_IDS, INSTITUTION_TYPES.map(([id]) => id));
});

test('primitives: ids, e-mail, text and URLs', () => {
  for (const v of ['abc', 'uid123_inst456', 'A-b_9']) ok(idSchema, v);
  for (const v of ['', 'a b', 'a/b', '../x', 'a'.repeat(129), 'x;DROP', 12]) bad(idSchema, v);
  assert.equal(ok(emailSchema, '  Teacher@Example.COM '), 'teacher@example.com', 'trimmed and lower-cased');
  for (const v of ['nope', 'a@b', '', 'x'.repeat(250) + '@e.com']) bad(emailSchema, v);
  assert.equal(ok(textSchema(10, { min: 2 }), '  hi  '), 'hi');
  bad(textSchema(5), 'toolong'); bad(textSchema(10, { min: 2 }), ' a '); bad(textSchema(10), 'bad\u0000char');
  ok(httpsUrlSchema, 'https://example.com/logo.png');
  for (const v of ['http://example.com', 'javascript:alert(1)', 'data:text/html,x', 'example.com', 'https://' + 'a'.repeat(2100) + '.com']) bad(httpsUrlSchema, v);
});

test('session input must look like a JWT and nothing else', () => {
  const jwt = `${'a'.repeat(30)}.${'b'.repeat(60)}.${'c'.repeat(40)}`;
  ok(sessionCreateInput, { idToken: jwt });
  bad(sessionCreateInput, { idToken: 'short' }); bad(sessionCreateInput, { idToken: 'no dots here but long enough to pass the length check abcdefghijklmnop' });
  bad(sessionCreateInput, { idToken: jwt, admin: true }, 'unknown keys are refused'); bad(sessionCreateInput, {});
});

test('institution creation: valid, defaults filled, hostile input refused', () => {
  const v = ok(institutionCreateInput, { name: '  Dhaka Model School ', type: 'school' });
  assert.deepEqual(v, { name: 'Dhaka Model School', type: 'school', address: '', phone: '', email: '', website: '', logoUrl: '', info: '' });
  ok(institutionCreateInput, { name: 'আদর্শ মাদ্রাসা', type: 'madrasa', email: 'Info@School.edu', website: 'https://school.edu', logoUrl: 'https://res.example.com/l.png' });
  bad(institutionCreateInput, { name: 'A', type: 'school' }, 'name too short');
  bad(institutionCreateInput, { name: 'Good name', type: 'hacker-space' }, 'type outside the list');
  bad(institutionCreateInput, { name: 'Good name', type: 'school', plan: 'enterprise' }, 'a client can never set its own plan');
  bad(institutionCreateInput, { name: 'Good name', type: 'school', aiUsed: -100 });
  bad(institutionCreateInput, { name: 'Good name', type: 'school', createdBy: 'someone-else' });
  bad(institutionCreateInput, { name: 'Good name', type: 'school', website: 'javascript:alert(1)' });
  bad(institutionCreateInput, { name: 'Good name', type: 'school', logoUrl: 'http://insecure.example/l.png' });
  bad(institutionCreateInput, { name: 'x'.repeat(121), type: 'school' });
});

test('invitations and role changes only accept real roles', () => {
  ok(inviteCreateInput, { institutionId: 'inst1', email: 'T@x.com', role: 'teacher' });
  bad(inviteCreateInput, { institutionId: 'inst1', email: 'T@x.com', role: 'super_admin' }, 'platform roles are not tenant roles');
  bad(inviteCreateInput, { institutionId: 'inst1', email: 'T@x.com', role: 'root' });
  ok(memberRoleChangeInput, { institutionId: 'inst1', uid: 'u1', role: 'viewer' });
  bad(memberRoleChangeInput, { institutionId: 'inst1', uid: 'u1', role: 'viewer', extra: 1 });
});

test('file names are sanitised the way the server will store them', () => {
  assert.equal(sanitizeFileName('C:\\fakepath\\..\\my report (final).PDF '), 'my report (final).pdf');
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFileName('.hidden.png'), 'hidden.png');
  assert.equal(sanitizeFileName('a\u0000b\u0007c.png'), 'abc.png');
  assert.equal(sanitizeFileName('  many   spaces .png'), 'many spaces .png');
  assert.equal(sanitizeFileName(null), '');
  assert.ok(sanitizeFileName(`${'x'.repeat(300)}.png`).length <= 120);
  assert.ok(sanitizeFileName(`${'x'.repeat(300)}.png`).endsWith('.png'), 'the extension survives truncation');
});

test('uploads: allow-listed types only, sizes capped per purpose, extension must match the type', () => {
  const base = { institutionId: 'inst1', purpose: 'logo', fileName: 'logo.PNG', contentType: 'IMAGE/PNG', size: 1000 };
  const v = ok(uploadRequestInput, base);
  assert.equal(v.fileName, 'logo.png'); assert.equal(v.contentType, 'image/png');
  bad(uploadRequestInput, { ...base, contentType: 'image/svg+xml', fileName: 'logo.svg' }, 'SVG can carry scripts');
  bad(uploadRequestInput, { ...base, contentType: 'text/html', fileName: 'x.html' }, 'HTML');
  bad(uploadRequestInput, { ...base, contentType: 'application/x-msdownload', fileName: 'x.exe' }, 'executables');
  bad(uploadRequestInput, { ...base, fileName: 'logo.exe' }, 'extension does not match the type');
  bad(uploadRequestInput, { ...base, fileName: 'logo.png.exe' });
  bad(uploadRequestInput, { ...base, fileName: 'noextension' });
  bad(uploadRequestInput, { ...base, fileName: '..' });
  bad(uploadRequestInput, { ...base, size: UPLOAD_PURPOSES.logo.maxBytes + 1 }, 'over the cap');
  ok(uploadRequestInput, { ...base, size: UPLOAD_PURPOSES.logo.maxBytes });
  bad(uploadRequestInput, { ...base, size: 0 }); bad(uploadRequestInput, { ...base, size: 1.5 }); bad(uploadRequestInput, { ...base, size: -5 });
  bad(uploadRequestInput, { ...base, purpose: 'root-access' });
  bad(uploadRequestInput, { ...base, purpose: 'avatar', contentType: 'image/gif', fileName: 'a.gif' }, 'avatars: no GIF');
  ok(uploadRequestInput, { ...base, purpose: 'question-image', contentType: 'image/gif', fileName: 'a.gif' });
  ok(uploadRequestInput, { ...base, purpose: 'attachment', contentType: 'application/pdf', fileName: 'Exam Notes.pdf', size: 5_000_000 });
  ok(uploadRequestInput, { ...base, purpose: 'attachment', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: 'marks.xlsx' });
  bad(uploadRequestInput, { ...base, purpose: 'attachment', contentType: 'application/pdf', fileName: 'a.pdf', size: 16 * 1024 * 1024 });
  ok(uploadRequestInput, { ...base, purpose: 'voice-message', contentType: 'audio/webm', fileName: 'voice.webm', size: 400000 });
  bad(uploadRequestInput, { ...base, extra: true });
  for (const [purpose, rule] of Object.entries(UPLOAD_PURPOSES)) for (const t of rule.types) assert.ok(t !== 'image/svg+xml' && !t.includes('html') && !t.includes('javascript'), `${purpose} allows ${t}`);
});

test('AI generation input mirrors the legacy function limits', () => {
  const v = ok(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'গণিত' });
  assert.deepEqual([v.count, v.difficulty, v.language, v.marks, v.chapter, v.material], [5, 'medium', 'bn', 1, '', '']);
  assert.deepEqual(AI_QUESTION_TYPES, ['mcq', 'cq', 'short', 'broad', 'math', 'tf']);
  ok(aiGenerateInput, { institutionId: 'inst1', type: 'cq', subject: 'Physics', count: 20, material: 'x'.repeat(12000), objectives: 'y'.repeat(1500), marks: 50 });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'essay', subject: 'x' }, 'unsupported type');
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: '' });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', count: 21 });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', count: 0 });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', count: 2.5 });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', material: 'x'.repeat(12001) });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', marks: 51 });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', difficulty: 'impossible' });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', language: 'fr' });
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', model: 'gemini-pro-ultra' }, 'a client cannot pick the model');
  bad(aiGenerateInput, { institutionId: 'inst1', type: 'mcq', subject: 'x', apiKey: 'AIza...' }, 'a client cannot send keys');
});

test('MFA codes and staff creation', () => {
  ok(totpCodeInput, { code: '123456' }); ok(totpCodeInput, { code: '123 456' });
  for (const code of ['12345', '1234567', 'abcdef', '12-3456', '']) bad(totpCodeInput, { code });
  ok(recoveryCodeInput, { code: 'a1b2c-d3e4f' }); ok(recoveryCodeInput, { code: 'A1B2C D3E4F' }); ok(recoveryCodeInput, { code: 'a1b2cd3e4f' });
  bad(recoveryCodeInput, { code: 'zzzzz-zzzzz' }); bad(recoveryCodeInput, { code: 'a1b2c-d3e4' });
  ok(staffCreateInput, { email: 'fin@x.com', roleId: 'finance_admin', displayName: 'Rina Akter' });
  bad(staffCreateInput, { email: 'fin@x.com', roleId: 'teacher', displayName: 'Rina' }, 'tenant role is not a staff role');
  bad(staffCreateInput, { email: 'fin@x.com', roleId: 'god_mode', displayName: 'Rina' });
});
