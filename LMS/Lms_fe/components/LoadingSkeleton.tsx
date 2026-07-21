export default function LoadingSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-20 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-16 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function TableLoadingSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="animate-pulse">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-12 bg-gray-200"></div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-50 border-t border-gray-200"></div>
                ))}
            </div>
        </div>
    )
}

export function CardLoadingSkeleton() {
    return (
        <div className="animate-pulse bg-white rounded-lg shadow-sm p-6">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
    )
}
