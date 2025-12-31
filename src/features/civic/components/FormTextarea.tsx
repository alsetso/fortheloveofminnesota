interface FormTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export default function FormTextarea({ 
  label, 
  value, 
  onChange, 
  rows = 2,
  placeholder 
}: FormTextareaProps) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows={rows}
        placeholder={placeholder}
      />
    </div>
  );
}

