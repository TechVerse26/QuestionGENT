import { useEffect, useState } from 'react';
import { Trash2, UserPlus, MailX } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { Input, Select } from '../../components/common/Field.jsx';
import { Badge, PageHeader, Spinner } from '../../components/common/Misc.jsx';
import { useToast } from '../../components/common/Toast.jsx';
import { useConfirm } from '../../components/common/Confirm.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useCurrent } from '../../hooks/useCurrent.js';
import { listMembers, updateMemberRole, removeMember, createInvitation, listInvitations, revokeInvitation } from '../../services/institutionService.js';
import { checkLimit, invalidateUsage } from '../../services/planService.js';
import { logActivity } from '../../services/activityService.js';
import { millis } from '../../services/db.js';
import { ROLES, ROLE_LABELS } from '../../constants/roles.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Team() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, institution, institutionId, can } = useCurrent();
  const manage = can('members.manage');
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('teacher');
  const [busy, setBusy] = useState(false);
  const roleName = (r) => (ROLE_LABELS[r] ? ROLE_LABELS[r][lang] : r);

  const load = async () => {
    try {
      setMembers(await listMembers(institutionId));
      if (manage) setInvites(await listInvitations(institutionId));
    } catch (e) { toast.error(t(e.message)); setMembers([]); }
  };
  useEffect(() => { load(); }, [institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const admins = (members || []).filter((m) => m.role === 'institution_admin').length;

  const invite = async (e) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) { toast.error(t('Enter a valid email address')); return; }
    if ((members || []).some((m) => m.email === addr) || invites.some((i) => i.email === addr)) { toast.error(t('This person is already a member or has a pending invitation.')); return; }
    setBusy(true);
    try {
      const msg = await checkLimit(institution, 'users', 1 + invites.length);
      if (msg) throw new Error(msg);
      await createInvitation({ institutionId, institutionName: institution.name, email: addr, role, uid: user.uid });
      logActivity(institutionId, user.uid, 'member.invite', { role });
      setEmail('');
      toast.success(t('Invitation created. Ask them to register or sign in with {email}.', { email: addr }));
      load();
    } catch (err) { toast.error(t(err.message)); } finally { setBusy(false); }
  };

  const changeRole = async (m, r) => {
    try { await updateMemberRole(institutionId, m.uid, r); toast.success(t('Role updated')); load(); } catch (e) { toast.error(t(e.message)); }
  };
  const remove = async (m) => {
    if (!(await confirm({ title: t('Remove member'), message: t('Remove {name} from this institution?', { name: m.displayName || m.email }), danger: true, confirmLabel: t('Remove') }))) return;
    try { await removeMember(institutionId, m.uid); invalidateUsage(institutionId); toast.success(t('Member removed')); load(); } catch (e) { toast.error(t(e.message)); }
  };

  return (
    <div>
      <PageHeader title={t('Team')} subtitle={t('{n} members', { n: members ? members.length : 0 })} />
      {manage && (
        <form onSubmit={invite} className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[14rem] flex-1"><label className="label">{t('Invite by email')}</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu" /></div>
          <div className="w-56"><label className="label">{t('Role')}</label><Select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</Select></div>
          <Button type="submit" variant="primary" icon={UserPlus} loading={busy}>{t('Invite')}</Button>
          <p className="hint w-full">{t('Invitations are not emailed automatically. The person sees it after signing in with the same verified email address.')}</p>
        </form>
      )}

      <div className="panel mb-4 overflow-x-auto">
        {members === null ? <div className="p-6"><Spinner /></div> : (
          <table className="tbl min-w-[560px]">
            <thead><tr><th>{t('Member')}</th><th>{t('Role')}</th><th>{t('Joined')}</th><th /></tr></thead>
            <tbody>
              {members.map((m) => {
                const self = m.uid === user.uid;
                const lastAdmin = m.role === 'institution_admin' && admins <= 1;
                return (
                  <tr key={m.id}>
                    <td><p className="font-medium">{m.displayName || '—'}{self && <Badge className="ml-2" tone="brand">{t('You')}</Badge>}</p><p className="text-xs text-muted">{m.email}</p></td>
                    <td>{manage && !self && !lastAdmin ? <Select className="h-8 w-52" value={m.role} onChange={(e) => changeRole(m, e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</Select> : roleName(m.role)}</td>
                    <td className="whitespace-nowrap text-muted">{m.createdAt ? new Date(millis(m.createdAt)).toLocaleDateString() : '—'}</td>
                    <td>{manage && !self && !lastAdmin && <Button size="icon" variant="ghost" onClick={() => remove(m)} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {manage && invites.length > 0 && (
        <div className="panel overflow-x-auto">
          <h2 className="border-b border-line px-4 py-3 text-base">{t('Pending invitations')}</h2>
          <table className="tbl"><tbody>
            {invites.map((i) => (
              <tr key={i.id}><td>{i.email}</td><td>{roleName(i.role)}</td>
                <td className="text-right"><Button size="icon" variant="ghost" onClick={async () => { try { await revokeInvitation(i.id); load(); } catch (e) { toast.error(t(e.message)); } }} aria-label={t('Cancel invitation')}><MailX className="h-4 w-4" /></Button></td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
