import { ReviewStreakSkeleton } from './review-streak'

function PulseBlock({ className }: { className: string }) {
    return <div className={`${className} bg-default-100 animate-pulse`} />
}

export function ReviewContentSkeleton() {
    return (
        <div className="space-y-6 pb-10">
            <div className="space-y-4 flex flex-col items-center">
                <PulseBlock className="h-28 w-full rounded-lg" />
                <ReviewStreakSkeleton />
            </div>

            <div className="space-y-5 pt-1">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex items-start gap-6 py-2">
                        <div className="w-10 shrink-0 space-y-1 pt-1 sm:w-16">
                            <PulseBlock className="ml-auto h-3 w-7 rounded" />
                            <PulseBlock className="ml-auto h-4 w-10 rounded" />
                        </div>

                        <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <PulseBlock className="h-8 w-24 rounded-full" />
                                <PulseBlock className="h-8 w-20 rounded-full" />
                                <PulseBlock className="h-8 w-28 rounded-full" />
                            </div>
                            <PulseBlock className="h-3 w-36 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
