export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout - no header, no footer, just the children
  return <>{children}</>;
}
