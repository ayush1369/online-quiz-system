import { Flag } from 'lucide-react';

interface QuizProgressBarProps {
  currentIndex: number;
  totalQuestions: number;
  flaggedIndices?: number[];
  onSelectQuestion?: (index: number) => void;
}

export function QuizProgressBar({
  currentIndex,
  totalQuestions,
  flaggedIndices = [],
  onSelectQuestion,
}: QuizProgressBarProps) {
  const safeTotal = Math.max(1, totalQuestions);
  const currentStep = Math.min(safeTotal, Math.max(1, currentIndex + 1));
  const ratio = currentStep / safeTotal;
  const percentage = Math.round(ratio * 100);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-700 tabular-nums">
            Progress: Question {currentStep} of {safeTotal}
          </span>
          {flaggedIndices.length > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-amber-700 tabular-nums">
                <Flag className="w-3 h-3 fill-amber-500 text-amber-600 shrink-0" />
                {flaggedIndices.length} marked for review
              </span>
            </>
          )}
        </div>

        <span className="font-mono font-semibold text-blue-700 tabular-nums">
          {percentage}%
        </span>
      </div>

      <div className="relative w-full h-2.5">
        <div
          role="progressbar"
          aria-label="Quiz question progress"
          aria-valuemin={1}
          aria-valuemax={safeTotal}
          aria-valuenow={currentStep}
          aria-valuetext={`Question ${currentStep} of ${safeTotal}`}
          className="w-full h-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
        >
          <div
            className="h-full w-full bg-blue-700 rounded-full origin-left transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>

        {flaggedIndices.map((idx) => {
          const leftPct = (idx / safeTotal) * 100;
          const widthPct = 100 / safeTotal;
          const isCurrent = idx === currentIndex;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuestion?.(idx)}
              title={`Question ${idx + 1} (Marked for review)`}
              aria-label={`Jump to marked question ${idx + 1}`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              className={`absolute top-0 h-full bg-amber-500 hover:bg-amber-600 border-x border-white/80 transition-colors cursor-pointer first:rounded-l-full last:rounded-r-full ${
                isCurrent ? 'ring-2 ring-slate-900 ring-offset-1 z-10' : ''
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
