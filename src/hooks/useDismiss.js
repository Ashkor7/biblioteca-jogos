import { useEffect } from 'react';

/**
 * Fecha um menu suspenso ao clicar fora dele ou apertar Esc.
 * `ref` envolve o gatilho e o menu; `triggerRef` recebe o foco de volta no Esc.
 */
export function useDismiss(open, onClose, ref, triggerRef) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, ref, triggerRef]);
}
