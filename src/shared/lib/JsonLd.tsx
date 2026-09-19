export function JsonLd({
  data,
  id,
}: {
  data: Record<string, unknown>;
  id?: string;
}) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
