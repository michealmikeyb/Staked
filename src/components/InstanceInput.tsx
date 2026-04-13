import React from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function InstanceInput({
  value,
  onChange,
  placeholder = 'instance.tld',
  id,
  className,
  style,
}: Props) {
  return (
    <input
      id={id}
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
