import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
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

const REMARK_PLUGINS = [remarkGfm, remarkDirective, remarkLemmySpoiler] as const;

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: Props) {
  const processed = preprocessSpoilers(content);
  const wrapperClass = [styles.markdown, className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ''}
              loading="lazy"
              style={{ maxWidth: '100%', height: 'auto', borderRadius: 6, display: 'block', marginTop: 6 }}
            />
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
