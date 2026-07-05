import { CircleCheck, Info, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';
import { useThemeStore } from '@/stores/useThemeStore';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeStore((s) => s.mode);

  return (
    <Sonner
      theme={theme as 'light' | 'dark' | 'system'}
      className="toaster group"
      position="top-center"
      icons={{
        success: <CircleCheck className="h-5 w-5 font-bold text-primary" />,
        error: <ShieldAlert className="h-5 w-5 font-bold text-destructive" />,
        warning: <TriangleAlert className="h-5 w-5 font-bold text-primary" />,
        info: <Info className="h-5 w-5 font-bold text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-foreground group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error:
            'group-[.toast]:bg-destructive/10 group-[.toast]:text-destructive group-[.toast]:border-destructive/30',
          success:
            'group-[.toast]:bg-accent group-[.toast]:text-primary group-[.toast]:border-primary/30',
          warning:
            'group-[.toast]:bg-accent group-[.toast]:text-primary group-[.toast]:border-primary/30',
          info: 'group-[.toast]:bg-accent group-[.toast]:text-primary group-[.toast]:border-primary/30',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
