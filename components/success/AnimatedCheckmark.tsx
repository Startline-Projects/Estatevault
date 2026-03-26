export default function AnimatedCheckmark() {
  return (
    <>
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 animate-bounce-once">
          <svg
            className="h-10 w-10 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              className="animate-draw-check"
            />
          </svg>
        </div>
      </div>
      <style jsx>{`
        @keyframes bounce-once {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
        @keyframes draw-check {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw-check {
          stroke-dasharray: 30;
          animation: draw-check 0.6s ease-out 0.3s forwards;
          stroke-dashoffset: 30;
        }
      `}</style>
    </>
  );
}
