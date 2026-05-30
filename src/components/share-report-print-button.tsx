export function ShareReportPrintButton({
  className,
  href,
}: {
  className: string;
  href: string;
}) {
  return (
    <a href={href} className={`inline-flex items-center justify-center whitespace-nowrap ${className}`}>
      Export to PDF
    </a>
  );
}
