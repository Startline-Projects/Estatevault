interface QuestionLabelProps {
  children: React.ReactNode;
}

export default function QuestionLabel({ children }: QuestionLabelProps) {
  return (
    <p className="mb-3 text-sm font-semibold text-navy">{children}</p>
  );
}
