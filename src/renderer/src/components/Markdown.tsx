import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Markdown seguro (sem HTML bruto); links abrem no navegador externo. */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
