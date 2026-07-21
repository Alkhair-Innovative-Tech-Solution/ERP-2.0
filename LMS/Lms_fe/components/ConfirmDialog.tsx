import * as React from "react"

import { cn } from "@/lib/utils"

interface DialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = 'danger'
}: DialogProps) {
    if (!isOpen) return null

    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-yellow-600 hover:bg-yellow-700',
        info: 'bg-primary-600 hover:bg-primary-700'
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {title}
                </h3>
                <p className="text-gray-600 mb-6">
                    {description}
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                        className={cn(
                            "px-4 py-2 rounded-lg text-white transition-colors",
                            variantStyles[variant]
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
