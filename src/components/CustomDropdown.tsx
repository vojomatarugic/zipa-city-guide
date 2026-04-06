import { useState, useRef, useEffect } from 'react';

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; emoji?: string }[];
  placeholder: string;
  required?: boolean;
}

export function CustomDropdown({ value, onChange, options, placeholder, required }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalizedValue = String(value ?? '').trim();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value).trim() === normalizedValue);

  return (
    <div ref={dropdownRef} className="relative">
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-[15px] cursor-pointer transition-all focus:outline-none text-left"
        style={{
          border: '1px solid',
          borderColor: normalizedValue ? 'var(--blue-primary)' : 'var(--border-light)',
          borderRadius: '12px',
          color: normalizedValue ? 'var(--text-primary)' : '#8B95A5',
          background: 'white',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>
          {selectedOption ? (
            <>
              {selectedOption.emoji && <span className="mr-2">{selectedOption.emoji}</span>}
              {selectedOption.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        
        {/* Arrow icon */}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 16 16" 
          fill="none" 
          style={{ 
            color: normalizedValue ? 'var(--blue-primary)' : '#8B95A5',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* DROPDOWN MENU - ZAOBLJENE IVICE! */}
      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-2 bg-white overflow-hidden"
          style={{
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {options.map((option) => {
            const selected = normalizedValue === String(option.value).trim();
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-[15px] text-left cursor-pointer transition-colors border-0 flex items-center ${
                  selected
                    ? 'bg-[#F0F7FF] hover:bg-[#E5F0FC]'
                    : 'bg-white hover:bg-blue-50'
                }`}
                style={{
                  color: 'var(--text-primary)',
                }}
              >
                {option.emoji && <span className="mr-2">{option.emoji}</span>}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}