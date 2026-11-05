import React, { useState, useId } from 'react';

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
  const codeId = useId();
  const [copyError, setCopyError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); setCopied(false); }
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
                aria-expanded={!isCodeCollapsed}
                aria-controls={codeId}
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

          <div id={codeId} hidden={isCodeCollapsed} className="eng-cell-code-container">
              <pre className={`eng-cell-code language-${language}`}>
                <code>{code}</code>
              </pre>
            </div>
          <span role="status">{copyError ? "Copy failed. Select and copy the code manually." : copied ? "Code copied." : ""}</span>
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
