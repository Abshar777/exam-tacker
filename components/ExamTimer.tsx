"use client";
import { useEffect, useState } from "react";

interface ExamTimerProps {
  timeRemainingMs: number;
  onExpire: () => void;
}

export default function ExamTimer({ timeRemainingMs, onExpire }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(timeRemainingMs);

  useEffect(() => {
    setRemaining(timeRemainingMs);
  }, [timeRemainingMs]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isWarning = remaining < 10 * 60 * 1000; // last 10 min
  const isCritical = remaining < 5 * 60 * 1000; // last 5 min

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-lg transition-colors ${
        isCritical
          ? "bg-red-100 text-red-700 border border-red-300 animate-pulse"
          : isWarning
          ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
          : "bg-indigo-100 text-indigo-700 border border-indigo-200"
      }`}
    >
      <span>⏱</span>
      <span>
        {hours > 0 && `${pad(hours)}:`}
        {pad(minutes)}:{pad(seconds)}
      </span>
      <span className="text-xs font-normal ml-1 opacity-70">remaining</span>
    </div>
  );
}
