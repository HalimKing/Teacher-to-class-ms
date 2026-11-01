import { forwardRef } from 'react';
import FaceGuide from './FaceGuide';

interface FaceCameraProps {
    active: boolean;
    guidance: string;
    tone: 'neutral' | 'good' | 'warn';
    badge?: string;
}

const FaceCamera = forwardRef<HTMLVideoElement, FaceCameraProps>(function FaceCamera({ active, guidance, tone, badge }, ref) {
    const guidanceClass =
        tone === 'good'
            ? 'border-emerald-300 bg-emerald-500/90 text-white'
            : tone === 'warn'
              ? 'border-amber-300 bg-amber-500/95 text-white'
              : 'border-white/30 bg-black/55 text-white';

    return (
        <div className={active ? 'relative -mx-0.5 overflow-hidden rounded-xl border bg-black sm:mx-0' : 'hidden'}>
            <video ref={ref} className="h-[min(64dvh,34rem)] w-full -scale-x-100 object-cover sm:aspect-video sm:h-auto" muted playsInline />
            {badge ? (
                <div className="absolute top-2 left-2 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                    {badge}
                </div>
            ) : null}
            <FaceGuide tone={tone} />
            <div className={`absolute inset-x-2 bottom-2 rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium backdrop-blur-sm sm:inset-x-3 sm:bottom-3 sm:px-3 sm:py-2 sm:text-sm ${guidanceClass}`}>
                {guidance}
            </div>
        </div>
    );
});

export default FaceCamera;
