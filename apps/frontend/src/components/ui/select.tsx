import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ options, value, placeholder = "Select...", onValueChange, disabled, className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState(value || "");

    const selectedOption = options.find(option => option.value === selectedValue);

    const handleSelect = (optionValue: string) => {
      setSelectedValue(optionValue);
      onValueChange?.(optionValue);
      setIsOpen(false);
    };

    React.useEffect(() => {
      setSelectedValue(value || "");
    }, [value]);

    return (
      <div className="relative">
        <button
          ref={ref}
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={cn(!selectedOption && "text-muted-foreground")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        {isOpen && (
          <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <div className="max-h-60 overflow-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    option.disabled && "pointer-events-none opacity-50"
                  )}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {selectedValue === option.value && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export interface MultiSelectProps {
  options: SelectOption[];
  value?: string[];
  placeholder?: string;
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
  maxDisplay?: number;
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  ({ 
    options, 
    value = [], 
    placeholder = "Select...", 
    onValueChange, 
    disabled, 
    className,
    maxDisplay = 3
  }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedValues, setSelectedValues] = React.useState<string[]>(value);

    const selectedOptions = options.filter(option => selectedValues.includes(option.value));

    const handleSelect = (optionValue: string) => {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      
      setSelectedValues(newValues);
      onValueChange?.(newValues);
    };

    React.useEffect(() => {
      setSelectedValues(value);
    }, [value]);

    const displayText = React.useMemo(() => {
      if (selectedOptions.length === 0) return placeholder;
      if (selectedOptions.length <= maxDisplay) {
        return selectedOptions.map(opt => opt.label).join(", ");
      }
      return `${selectedOptions.slice(0, maxDisplay).map(opt => opt.label).join(", ")} +${selectedOptions.length - maxDisplay}`;
    }, [selectedOptions, placeholder, maxDisplay]);

    return (
      <div className="relative">
        <button
          ref={ref}
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={cn(selectedOptions.length === 0 && "text-muted-foreground")}>
            {displayText}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        {isOpen && (
          <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <div className="max-h-60 overflow-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    option.disabled && "pointer-events-none opacity-50"
                  )}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {selectedValues.includes(option.value) && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

MultiSelect.displayName = "MultiSelect";