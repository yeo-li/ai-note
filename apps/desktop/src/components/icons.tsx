type IconProps = {
  className?: string;
};

const BASE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
};

export function IconPlus({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-3.5 3v-3H7a2 2 0 0 1-2-2v-7Z" />
      <path d="M9.5 9.5h5M9.5 12h3.5" />
    </svg>
  );
}

export function IconSidebarPanel({ open, className }: IconProps & { open: boolean }) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
      {open ? <path d="M14 10.5 16.5 12 14 13.5" /> : <path d="M16.5 10.5 14 12l2.5 1.5" />}
    </svg>
  );
}

export function IconPin({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M14.5 3.5 19 8l-2 2-1.2-.4-2.8 2.8.6 3.1-1.4 1.4-3.6-3.6-3.6 3.6-1-1 3.6-3.6L4 8.7l1.4-1.4 3.1.6 2.8-2.8L10.9 4.9Z" />
    </svg>
  );
}

export function IconStar({ filled, className }: IconProps & { filled: boolean }) {
  return (
    <svg className={className} {...BASE_PROPS} fill={filled ? "currentColor" : "none"}>
      <path d="M12 4.2 14.4 9l5.3.8-3.85 3.75.9 5.25L12 16.3l-4.75 2.5.9-5.25L4.3 9.8 9.6 9Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSparkles({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M11.5 3.5 13 7.5 17 9l-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" strokeLinejoin="round" />
      <path d="M18 14.5 18.9 17l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTag({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M11.5 4h6a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-.44 1.06l-7 7a1.5 1.5 0 0 1-2.12 0l-5.5-5.5a1.5 1.5 0 0 1 0-2.12l7-7A1.5 1.5 0 0 1 11.5 4Z" strokeLinejoin="round" />
      <circle cx="15.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconBolt({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M19.5 19.5 15.8 15.8" />
    </svg>
  );
}

export function IconPencil({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M4 19.5 4.6 16.2 15.4 5.4a1.5 1.5 0 0 1 2.12 0l.78.78a1.5 1.5 0 0 1 0 2.12L7.5 19l-3.5.5Z" strokeLinejoin="round" />
      <path d="M13.5 7.5 16.5 10.5" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12" />
    </svg>
  );
}

export function IconFolder({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M4 7a1.5 1.5 0 0 1 1.5-1.5h4.1l1.7 2H18.5A1.5 1.5 0 0 1 20 9v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevron({ className, open }: IconProps & { open: boolean }) {
  return (
    <svg className={className} {...BASE_PROPS}>
      {open ? <path d="M7 14h10l-5-6Z" fill="currentColor" stroke="none" /> : <path d="M7 10h10l-5 6Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}
