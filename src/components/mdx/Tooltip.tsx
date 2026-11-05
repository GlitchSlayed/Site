import React, { useId } from 'react';

export interface TooltipProps {
  /** The primary tooltip text to display */
  content: string;
  /** Optional secondary explanatory line */
  subtitle?: string;
  /** Optional keyboard shortcut or acronym badge (e.g., 'Z', 'L/D', 'Ctrl+K') */
  shortcut?: string;
  /** Preferred placement relative to target (default: 'top') */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Underlying HTML tag to render (default: 'span') */
  as?: 'span' | 'abbr' | 'div';
  /** Additional CSS class names */
  className?: string;
  /** Trigger content to hover or focus */
  children: React.ReactNode;
}

/**
 * Author-facing MDX Tooltip component.
 * Wraps any inline text, abbreviation, symbol, or block in a high-performance,
 * accessible glassmorphic tooltip.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  subtitle,
  shortcut,
  position = 'top',
  as: Component = 'span',
  className = '',
  children,
}) => {
  const descriptionId = useId();
  return (
    <>
    <Component
      className={`mdx-tooltip-trigger ${className}`}
      data-tooltip={content}
      data-tooltip-pos={position}
      data-tooltip-subtitle={subtitle}
      data-tooltip-shortcut={shortcut}
      tabIndex={0}
      aria-describedby={descriptionId}
    >
      {children}
    </Component>
    <span id={descriptionId} className="mdx-tooltip-description">{[content, subtitle, shortcut].filter(Boolean).join(". ")}</span>
    </>
  );
};

export default Tooltip;
