import React from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export default function InstanceInput({
  value,
  onChange,
  placeholder = 'instance.tld',
  id,
  className,
  style,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={className}
      style={style}
    />
  );
}
