"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Type,
  Briefcase,
  Sparkles,
  FileText,
  Award,
  Mail,
  ImageIcon,
  ShieldAlert,
  Settings,
  ListChecks,
} from "@/components/admin/icons"

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

/**
 * The admin sidebar, grouped to mirror the intake form's own section order so
 * someone working from the paper form can find the matching editor without
 * translating between two structures.
 *
 * "Compliance" is its own group rather than a page buried under settings. The
 * exclusions log and the sign-off are the two things the form says must be
 * complete before anything is published, so they get equal billing with the copy.
 */
export const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Profile",
    items: [
      { href: "/admin/identity", label: "Identity", icon: User },
      { href: "/admin/headline", label: "Headline", icon: Type },
      { href: "/admin/positions", label: "Positions", icon: Briefcase },
      { href: "/admin/expertise", label: "Expertise & Languages", icon: Sparkles },
      { href: "/admin/biography", label: "Biography", icon: FileText },
      { href: "/admin/awards", label: "Awards & Education", icon: Award },
    ],
  },
  {
    title: "Contact & Media",
    items: [
      { href: "/admin/contact-info", label: "Contact", icon: Mail },
      { href: "/admin/media", label: "Media Assets", icon: ImageIcon },
    ],
  },
  {
    title: "Compliance",
    items: [
      { href: "/admin/exclusions", label: "Exclusions Log", icon: ShieldAlert },
      { href: "/admin/deliverables", label: "Deliverables & Sign-off", icon: ListChecks },
    ],
  },
  {
    title: "System",
    items: [{ href: "/admin/site-settings", label: "Site Settings", icon: Settings }],
  },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-7">
      {navGroups.map((group) => (
        <div key={group.title}>
          <p className="mb-2.5 px-3 font-display text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              // /admin must match exactly, startsWith would light the dashboard up
              // on every child route.
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-[color:var(--primary)]/10 text-[color:var(--primary-strong)]"
                        : "text-[color:var(--foreground)] hover:bg-[color:var(--surface-raised)] hover:text-[color:var(--heading)]"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
