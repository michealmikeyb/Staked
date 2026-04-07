// src/components/MarkdownRenderer.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownRenderer from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders a link with target="_blank" and rel="noopener noreferrer"', () => {
    render(<MarkdownRenderer content="[Click here](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'Click here' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders a blockquote for > prefix', () => {
    render(<MarkdownRenderer content="> this is a quote" />);
    expect(document.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('this is a quote')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    render(<MarkdownRenderer content="use `npm install` to install" />);
    const code = document.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toBe('npm install');
  });

  it('renders a fenced code block as pre', () => {
    render(<MarkdownRenderer content={"```\nconst x = 1;\n```"} />);
    expect(document.querySelector('pre')).toBeInTheDocument();
  });

  it('renders a spoiler as a details element with summary', () => {
    render(
      <MarkdownRenderer content={":::spoiler Click to reveal\nhidden content\n:::"} />,
    );
    const details = document.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('Click to reveal')).toBeInTheDocument();
    expect(screen.getByText('hidden content')).toBeInTheDocument();
  });

  it('applies the provided className to the wrapper div', () => {
    const { container } = render(<MarkdownRenderer content="hello" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
