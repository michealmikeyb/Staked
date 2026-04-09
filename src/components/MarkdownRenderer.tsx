import { useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Components } from 'react-markdown';
import styles from './MarkdownRenderer.module.css';

// Lemmy posts use `:::spoiler title` (space) but remark-directive expects `:::name[label]`
function preprocessSpoilers(text: string): string {
  return text.replace(/^:::spoiler\s+(.+)$/gm, ':::spoiler[$1]');
}

// Converts :::spoiler[label] container directives to <details>/<summary> HTML nodes
function remarkLemmySpoiler() {
  return (tree: any) => {
    visit(tree, 'containerDirective', (node: any) => {
      if (node.name !== 'spoiler') return;
      const label = node.attributes?.label ?? 'Spoiler';
      node.data = { hName: 'details', hProperties: {} };
      node.children.unshift({
        type: 'paragraph',
        data: { hName: 'summary' },
        children: [{ type: 'text', value: label }],
      });
    });
  };
}

const REMARK_PLUGINS = [remarkGfm, remarkDirective, remarkLemmySpoiler];

const imgStyle = { maxWidth: '100%', height: 'auto', borderRadius: 6, display: 'block', marginTop: 6 } as const;

const MARKDOWN_COMPONENTS: Partial<Components> = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ''} loading="lazy" style={imgStyle} />
  ),
};

interface Props {
  content: string;
  className?: string;
  components?: Partial<Components>;
}

function MarkdownRenderer({ content, className, components }: Props) {
  const processed = useMemo(() => preprocessSpoilers(content), [content]);
  const wrapperClass = className ? `${styles.markdown} ${className}` : styles.markdown;
  const mergedComponents = useMemo(
    () => components ? { ...MARKDOWN_COMPONENTS, ...components } : MARKDOWN_COMPONENTS,
    [components],
  );

  return (
    <div className={wrapperClass}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={mergedComponents}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
