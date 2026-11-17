import { LoaderCircle } from 'lucide-react';

const VARIANTS = { default: '', primary: 'btn-primary', danger: 'btn-danger', ghost: 'btn-ghost' };

export default function Button({ variant = 'default', size, loading = false, icon: Icon, children, className = '', ...rest }) {
  const sz = size === 'sm' ? 'btn-sm' : size === 'icon' ? 'btn-sm btn-icon' : '';
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} className={`btn ${VARIANTS[variant] || ''} ${sz} ${className}`}>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}
