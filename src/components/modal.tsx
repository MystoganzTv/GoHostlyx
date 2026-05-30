"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  title,
  onClose,
  dismissible = true,
  bare = false,
  alignTop = false,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  dismissible?: boolean;
  bare?: boolean;
  alignTop?: boolean;
  children: ReactNode;
}) {
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const modalViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !modalCardRef.current) {
      return;
    }

    if (modalViewportRef.current) {
      modalViewportRef.current.scrollTop = 0;
    }

    const frameId = window.requestAnimationFrame(() => {
      modalCardRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const modalContent = (
    <div ref={modalViewportRef} className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6">
      <div className={`flex min-h-full justify-center ${alignTop ? "items-start py-4 sm:py-8" : "items-center"}`}>
        {dismissible ? (
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-slate-950/78"
            onClick={onClose}
          />
        ) : (
          <div className="absolute inset-0 bg-slate-950/78" />
        )}
        <div
          ref={modalCardRef}
          tabIndex={-1}
          className={
            bare
              ? "relative z-10 w-full max-w-6xl max-h-[calc(100vh-2rem)] overflow-y-auto outline-none sm:max-h-[calc(100vh-3rem)]"
              : "workspace-card relative z-10 my-auto max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[30px] p-5 outline-none sm:p-6"
          }
        >
          {bare && dismissible ? (
            <div className="pointer-events-none sticky top-0 z-20 flex justify-end px-3 pt-3 sm:px-4 sm:pt-4">
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto workspace-button-secondary rounded-full px-3 py-1.5 text-sm transition backdrop-blur"
              >
                Close
              </button>
            </div>
          ) : null}
          {title ? (
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--workspace-text)]">{title}</h2>
              {dismissible ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="workspace-button-secondary rounded-full px-3 py-1.5 text-sm transition"
                >
                  Close
                </button>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}
