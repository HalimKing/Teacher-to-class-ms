interface FaceGuideProps {
    tone: 'neutral' | 'good' | 'warn';
}

export default function FaceGuide({ tone }: FaceGuideProps) {
    return (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
                className={`aspect-[3/4] h-[74%] w-auto max-w-[92%] rounded-[50%] border-2 sm:h-[84%] ${
                    tone === 'good' ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]' : 'border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                }`}
            />
        </div>
    );
}
