import { Search } from 'lucide-react';
import './search-input.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Поиск…', testId }: SearchInputProps) {
  return (
    <div className="search-input">
      <Search className="search-input__icon" strokeWidth={1.75} aria-hidden />
      <input
        type="search"
        className="search-input__field"
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
