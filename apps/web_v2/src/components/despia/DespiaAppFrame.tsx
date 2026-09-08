'use client';

import type { CSSProperties, ReactNode } from 'react';

type DespiaAppFrameProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  style?: CSSProperties;
};

/** Fixed inset root → safe-top → header → stage → footer → safe-bottom */
export default function DespiaAppFrame({
  children,
  header,
  footer,
  scroll = true,
  className = '',
  contentClassName = '',
  headerClassName = '',
  footerClassName = '',
  style,
}: DespiaAppFrameProps) {
  return (
    <div className={`despia-app-root ${className}`.trim()} style={style}>
      <div className="despia-safe-top" aria-hidden />
      {header ? (
        <header className={`despia-app-header ${headerClassName}`.trim()}>{header}</header>
      ) : null}
      <main
        className={`${scroll ? 'despia-app-content' : 'despia-app-stage'} ${contentClassName}`.trim()}
      >
        {children}
      </main>
      {footer ? (
        <footer className={`despia-app-footer ${footerClassName}`.trim()}>{footer}</footer>
      ) : null}
      <div className="despia-safe-bottom" aria-hidden />
    </div>
  );
}
