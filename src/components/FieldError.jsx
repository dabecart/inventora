export default function FieldError({ text, className = null }) {
  if (!text) return null;
  return <div className={`text-xs text-red-400 mt-1 ${className}`}>{text}</div>;
}