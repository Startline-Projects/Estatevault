interface QuestionLabelProps {
  children: React.ReactNode;
  required?: boolean;
}

export default function QuestionLabel({ children, required }: QuestionLabelProps) {
  return (
    <p className="mb-3 text-sm font-semibold text-navy">
      {children}
      {required && <span className="ml-1 text-red-500" aria-label="required">*</span>}
    </p>
  );
}
