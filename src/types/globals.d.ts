/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="next" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_BASE_URL?: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'next/navigation' {
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
    forward: () => void;
    refresh: () => void;
    prefetch: (url: string) => void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
}

declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
  }
  
  export const Shield: ComponentType<LucideProps>;
  export const Info: ComponentType<LucideProps>;
  export const CheckCircle: ComponentType<LucideProps>;
  export const AlertCircle: ComponentType<LucideProps>;
  export const X: ComponentType<LucideProps>;
  export const Globe: ComponentType<LucideProps>;
  export const Users: ComponentType<LucideProps>;
  export const RefreshCw: ComponentType<LucideProps>;
  export const Check: ComponentType<LucideProps>;
  export const Settings: ComponentType<LucideProps>;
  export const AlertTriangle: ComponentType<LucideProps>;
  export const Key: ComponentType<LucideProps>;
  export const Clock: ComponentType<LucideProps>;
  export const Copy: ComponentType<LucideProps>;
  export const Database: ComponentType<LucideProps>;
  export const ArrowRight: ComponentType<LucideProps>;
  export const ExternalLink: ComponentType<LucideProps>;
}

export {};
