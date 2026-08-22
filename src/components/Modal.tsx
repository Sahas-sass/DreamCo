interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Modal({ isOpen, title, message, type = 'info', onClose }: ModalProps) {
  if (!isOpen) return null;

  const colors = {
    success: 'text-green-600 bg-green-100/50 border-green-200',
    error: 'text-red-600 bg-red-100/50 border-red-200',
    info: 'text-dreamco-blue bg-blue-100/50 border-blue-200'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Heavy Blur Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      ></div>
      
      {/* Glassmorphic Card */}
      <div className="relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full transform transition-all flex flex-col items-center text-center">
        
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 border ${colors[type]}`}>
          {type === 'success' && <span className="text-3xl font-bold">✓</span>}
          {type === 'error' && <span className="text-3xl font-bold">!</span>}
          {type === 'info' && <span className="text-3xl font-bold italic">i</span>}
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-8 font-medium">{message}</p>
        
        <button 
          onClick={onClose}
          className="w-full bg-gradient-to-r from-dreamco-blue to-blue-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-95"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}