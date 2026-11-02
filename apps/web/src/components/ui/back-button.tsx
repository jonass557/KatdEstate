import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';

export function BackButton({
  to,
  label = 'Retour',
  className = '',
}: {
  to?: string | undefined;
  label?: string | undefined;
  className?: string | undefined;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200 shadow-sm transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}
