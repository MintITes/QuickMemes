import { useEffect } from 'react';
import { MainShell } from './components/layout/MainShell';
import { useUiStore } from './stores/UiStore';
import { useNotificationStore, type NotificationType } from './stores/NotificationStore';
import { useTaskStore } from './stores/TaskStore';
import './index.css';

function App() {
  const {
    theme, setResolvedTheme,
    glassEffect, glassBlur,
    cornerRadius, galleryGap,
    accentColor, toggleImportModal
  } = useUiStore();

  const { addNotification, clearAll: clearNotifications } = useNotificationStore();
  const { startTask, updateProgress, completeTask, clearTask } = useTaskStore();

  useEffect(() => {
    // Expose debug commands to global window object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).debug = {
      notify: (type: NotificationType, title: string, description?: string) => {
        addNotification({ type, title, description });
        return `Notification sent: [${type.toUpperCase()}] ${title}`;
      },
      clearNotifications: () => {
        clearNotifications();
        return "All notifications cleared";
      },
      task: {
        start: (name: string, description?: string, progress: number | null = null) => {
          startTask({ id: 'debug-task', name, description, progress });
          return `Task started: ${name}`;
        },
        update: (progress: number | null, description?: string) => {
          updateProgress(progress, description);
          return `Task updated: ${progress ?? 'indeterminate'}% ${description ?? ''}`;
        },
        complete: () => {
          completeTask();
          return "Task completed";
        },
        clear: () => {
          clearTask();
          return "Task cleared";
        }
      }
    };

    console.log(
      "%c🚀 QuickMemes Debug Mode Enabled",
      "color: #0066cc; font-weight: bold; font-size: 14px;"
    );
    console.log("Commands available:");
    console.log("- debug.notify(type, title, desc)");
    console.log("- debug.task.start(name, desc, progress)");
    console.log("- debug.task.update(progress, desc)");
    console.log("- debug.task.complete()");

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).debug;
    };
  }, [addNotification, clearNotifications, startTask, updateProgress, completeTask, clearTask]);

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Optional: visual feedback at window level
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Open modal when files are dropped
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        toggleImportModal(true);
      }
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, [toggleImportModal]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = theme === 'system' ? mediaQuery.matches : theme === 'dark';

      if (isDark) {
        root.classList.add('dark');
        setResolvedTheme('dark');
      } else {
        root.classList.remove('dark');
        setResolvedTheme('light');
      }
    };

    applyTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme, setResolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;

    // Toggle glass-mode class
    if (glassEffect) {
      root.classList.add('glass-mode');
    } else {
      root.classList.remove('glass-mode');
    }

    // Apply CSS Variables
    root.style.setProperty('--glass-blur', `${glassBlur}px`);
    root.style.setProperty('--corner-radius', `${cornerRadius}px`);
    root.style.setProperty('--gallery-gap', `${galleryGap}px`);
    root.style.setProperty('--accent-color', accentColor);

  }, [glassEffect, glassBlur, cornerRadius, galleryGap, accentColor]);

  return <MainShell />;
}

export default App;
