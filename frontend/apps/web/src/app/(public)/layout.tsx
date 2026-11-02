import { AppShell } from '@/components/layout/app-shell';

// Anyone reads; guest actions go through useRequireLogin() (blueprint §3-2). No access re-check needed.
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
