import React, { useState } from 'react';

export interface NotebookCellProps {
  inputNumber?: number;
  code?: string;
  language?: string;
  title?: string;
  initialCollapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const NotebookCell: React.FC<NotebookCellProps> = ({
  inputNumber = 1,
  code,
  language = 'python',
  title,
  initialCollapsed = false,
  children,
  className = '',
}) => {
  const [isCodeCollapsed, setIsCodeCollapsed] = useState(initialCollapsed);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`eng-notebook-cell ${className}`}>
      {/* Input Cell (Code) */}
      {code && (
        <div className="eng-cell-input-block">
          <div className="eng-cell-header">
            <div className="eng-cell-prompt">
              <span className="prompt-label">In [{inputNumber}]:</span>
              {title && <span className="eng-cell-title">{title}</span>}
            </div>

            <div className="eng-cell-actions">
              <button
                type="button"
                onClick={() => setIsCodeCollapsed(!isCodeCollapsed)}
                className="eng-cell-toggle-btn"
                data-tooltip={isCodeCollapsed ? 'Expand code block' : 'Collapse code block'}
                data-tooltip-pos="top"
              >
                {isCodeCollapsed ? 'Show Code ▾' : 'Hide Code ▴'}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="eng-cell-copy-btn"
                data-tooltip={copied ? 'Copied to clipboard!' : 'Copy code to clipboard'}
                data-tooltip-pos="top"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {!isCodeCollapsed && (
            <div className="eng-cell-code-container">
              <pre className={`eng-cell-code language-${language}`}>
                <code>{code}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Output Cell (Interactive Component) */}
      <div className="eng-cell-output-block">
        <div className="eng-cell-output-prompt">
          <span className="prompt-label out">Out [{inputNumber}]:</span>
        </div>
        <div className="eng-cell-output-content">{children}</div>
      </div>
    </div>
  );
};

export default NotebookCell;
