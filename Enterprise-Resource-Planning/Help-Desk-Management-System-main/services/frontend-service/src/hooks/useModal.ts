/**
 * useModal Hook
 * Modal state management
 */

import { useState, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';

export const useModal = (modalId: string) => {
  const { activeModal, openModal, closeModal } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    openModal(modalId);
    setIsOpen(true);
  }, [modalId, openModal]);

  const close = useCallback(() => {
    closeModal();
    setIsOpen(false);
  }, [closeModal]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  return {
    isOpen: activeModal === modalId || isOpen,
    open,
    close,
    toggle,
  };
};

