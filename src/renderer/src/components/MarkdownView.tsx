import { Children, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GlossaryText } from './Glossary'

/** Só URLs https absolutas; o resto (inclusive "//host/…", que no Windows viraria caminho de rede) é descartado. */
const httpsOnly = (url: string) => (/^https:\/\//i.test(url) ? url : '')

/** Termos do glossário nos trechos de texto puro (links e código ficam como estão). */
const withTerms = (content: ReactNode) => Children.map(content, (child) => (typeof child === 'string' ? <GlossaryText>{child}</GlossaryText> : child))

/** Markdown seguro (sem HTML bruto); links abrem no navegador externo. Use via `Markdown`, que carrega este módulo sob demanda. */
export default function MarkdownView({ children, className = '', glossary = false }: { children: string; className?: string; glossary?: boolean }) {
  return (
    <div className={`markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={httpsOnly}
        components={{
          img: ({ src, alt }) => (typeof src === 'string' && src ? <img src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" /> : null),
          a: ({ href, children: content }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                if (href && /^https:\/\//i.test(href)) void window.api.app.openExternal(href)
              }}
            >
              {content}
            </a>
          ),
          ...(glossary
            ? {
                p: ({ children: content }) => <p>{withTerms(content)}</p>,
                li: ({ children: content }) => <li>{withTerms(content)}</li>
              }
            : {})
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
