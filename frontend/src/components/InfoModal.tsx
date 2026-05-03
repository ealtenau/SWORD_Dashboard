import { useEffect, type ReactNode } from "react";

type InfoModalProps = {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

type InlineToken = {
  text: string;
  type: "bold" | "italic" | "link" | "text";
  href?: string;
};

const inlinePattern = /(\*\*([^*]+)\*\*|_([^_]+)_|\[([^\]]+)\]\s?\(([^)]+)\))/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      tokens.push({ type: "bold", text: match[2] });
    } else if (match[3]) {
      tokens.push({ type: "italic", text: match[3] });
    } else if (match[4] && match[5]) {
      tokens.push({ type: "link", text: match[4], href: match[5] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) });
  }

  tokens.forEach((token, index) => {
    if (token.type === "bold") {
      nodes.push(<strong key={index}>{token.text}</strong>);
    } else if (token.type === "italic") {
      nodes.push(<em key={index}>{token.text}</em>);
    } else if (token.type === "link" && token.href) {
      nodes.push(
        <a href={token.href} key={index} rel="noreferrer" target="_blank">
          {token.text}
        </a>,
      );
    } else {
      nodes.push(token.text);
    }
  });

  return nodes;
}

function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      blocks.push(<h3 key={blocks.length}>{renderInline(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith("## ")) {
      blocks.push(<h2 key={blocks.length}>{renderInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("# ")) {
      blocks.push(<h2 key={blocks.length}>{renderInline(trimmed.slice(2))}</h2>);
    } else {
      blocks.push(<p key={blocks.length}>{renderInline(trimmed)}</p>);
    }
  });

  flushList();
  return blocks;
}

export function InfoModal({ content, isOpen, onClose, title }: InfoModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="info-modal-title"
        aria-modal="true"
        className="info-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="info-modal-header">
          <h2 id="info-modal-title">{title}</h2>
          <button aria-label="Close modal" className="modal-close-button" onClick={onClose} type="button">
            x
          </button>
        </header>
        <div className="info-modal-body">{renderMarkdown(content)}</div>
      </section>
    </div>
  );
}
