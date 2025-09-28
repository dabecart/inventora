export default function IconButton({ title, onClick, children, className = null, style = {}, isDisabled = false }) {
  return (
    <button 
      onClick={onClick} 
      disabled={isDisabled} 
      title={title} 
      className={`flex items-center justify-center p-2 rounded-md hover:opacity-90 h-full ${className}`}
      style={style}
      >
        {children}
    </button>
  );
}