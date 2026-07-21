'use client';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Parent layout already provides Sidebar and Header
    return (
        <>
            {children}
        </>
    );
}
