import { useEffect, useRef, useState, type CSSProperties } from "react";

type RevealOnScrollArticleProps = {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  rootMargin?: string;
  hiddenTranslateY?: number;
};

/** Shared scroll snapshot so all cards read the same prev/curr without N listeners. */
const scrollSnapshot = { prev: 0, curr: 0 };
let scrollSubscribers = 0;

function onGlobalScroll() {
  scrollSnapshot.prev = scrollSnapshot.curr;
  scrollSnapshot.curr = typeof window !== "undefined" ? window.scrollY : 0;
}

function subscribeGlobalScroll(): () => void {
  if (typeof window === "undefined") return () => {};
  scrollSubscribers += 1;
  if (scrollSubscribers === 1) {
    const y = window.scrollY;
    scrollSnapshot.prev = y;
    scrollSnapshot.curr = y;
    window.addEventListener("scroll", onGlobalScroll, { passive: true });
  }
  return () => {
    scrollSubscribers -= 1;
    if (scrollSubscribers <= 0) {
      scrollSubscribers = 0;
      window.removeEventListener("scroll", onGlobalScroll);
    }
  };
}

export function RevealOnScrollArticle({
  children,
  className = "",
  threshold = 0,
  rootMargin = "0px 0px 120px 0px",
  hiddenTranslateY = 32,
}: RevealOnScrollArticleProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => subscribeGlobalScroll(), []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || visible) return;

    let rafId = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        // Sljedeći frame: scroll listener obično već ažurira scrollSnapshot (glatkije s Events/Clubs layoutom).
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const { prev, curr } = scrollSnapshot;
          if (curr < prev) return;

          setVisible(true);
          observer.disconnect();
        });
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(node);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [visible, threshold, rootMargin]);

  return (
    <article
      ref={containerRef}
      style={{ "--reveal-hidden-y": `${hiddenTranslateY}px` } as CSSProperties}
      className={`certificate-card-reveal h-full ${visible ? "certificate-card-visible" : ""} ${className}`.trim()}
    >
      {children}
    </article>
  );
}
