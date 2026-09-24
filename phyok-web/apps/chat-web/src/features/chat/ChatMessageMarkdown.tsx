"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessageMarkdownProps = {
  content: string;
};

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  table: ({ node: _node, children, ...props }) => (
    <div className="message-markdown-table-wrap">
      <table {...props}>{children}</table>
    </div>
  )
};

export function ChatMessageMarkdown({ content }: ChatMessageMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

export default ChatMessageMarkdown;
