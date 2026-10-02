"use client";
import { useEffect } from "react";
import YuvalLogo from "./YuvalLogo";
import ClockTimer from "./ClockTimer";

export const SPLASH_SECONDS = 5;

export default function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, SPLASH_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white animate-fade-in"
    >
      <YuvalLogo size={250} />
      <ClockTimer seconds={SPLASH_SECONDS} size={92} />
      <p className="text-red-100 text-lg">
        פותח ע״י <span className="font-bold text-white">גיל בן יהודה</span>
        <span className="block text-sm text-red-100/90" dir="ltr">gilbeny@gmail.com</span>
      </p>
      <p className="text-red-200/70 text-xs absolute bottom-8">לחצו כדי לדלג</p>
    </div>
  );
}
