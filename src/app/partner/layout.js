/**
 * The partner app. Deliberately outside the staff `(app)` route group — no
 * shared shell, no sidebar, no staff store. The two applications only have
 * the design system in common.
 */
export default function PartnerRootLayout({ children }) {
  return <div className="min-h-dvh bg-paper">{children}</div>
}
