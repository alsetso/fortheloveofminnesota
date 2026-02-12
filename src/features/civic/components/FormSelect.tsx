interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}

export default function FormSelect({ 
  label, 
  value, 
  onChange, 
  options,
  required = false 
}: FormSelectProps) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-foreground mb-0.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs border border-border rounded px-2 py-1 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-foreground-muted"
        required={required}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

