import { useEffect, useRef, useState } from "react";

type RevealOnScrollArticleProps = {
  children: React.ReactNode;
  className?: string;
};

export function RevealOnScrollArticle({
  children,
  className = "",
}: RevealOnScrollArticleProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.25,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [visible]);

  return (
    <article
      ref={containerRef}
      className={`certificate-card-reveal h-full ${visible ? "certificate-card-visible" : ""} ${className}`.trim()}
    >
      {children}
    </article>
  );
}
