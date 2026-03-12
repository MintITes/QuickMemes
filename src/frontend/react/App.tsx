import { useEffect } from 'react';
import { MainShell } from './components/layout/MainShell';
import { useUiStore } from './stores/UiStore';
import './index.css';

function App() {
  const {
    theme, setResolvedTheme,
    glassEffect, glassBlur,
    cornerRadius, galleryGap,
    accentColor, toggleImportModal
  } = useUiStore();

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
