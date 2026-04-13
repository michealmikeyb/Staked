import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstanceInput from './InstanceInput';

describe('InstanceInput', () => {
  it('renders with placeholder text', () => {
    render(<InstanceInput value="" onChange={() => {}} placeholder="my.instance.tld" />);
    expect(screen.getByPlaceholderText('my.instance.tld')).toBeInTheDocument();
  });

  it('shows the current value', () => {
    render(<InstanceInput value="lemmy.world" onChange={() => {}} />);
    expect(screen.getByDisplayValue('lemmy.world')).toBeInTheDocument();
  });

  it('calls onChange with the new value when typed', () => {
    const handleChange = vi.fn();
    render(<InstanceInput value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'sh.itjust.works' } });
    expect(handleChange).toHaveBeenCalledWith('sh.itjust.works');
  });

  it('applies a provided className', () => {
    render(<InstanceInput value="" onChange={() => {}} className="my-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('my-class');
  });
});
