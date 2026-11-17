import { cloneElement, forwardRef, isValidElement, useId } from 'react';

export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const child = isValidElement(children) && !children.props.id ? cloneElement(children, { id }) : children;
  return (
    <div className={className}>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      {child}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} {...props} className={`input ${className}`} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return <select ref={ref} {...props} className={`input ${className}`}>{children}</select>;
});

export const Textarea = forwardRef(function Textarea({ className = '', rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} {...props} className={`input ${className}`} />;
});
