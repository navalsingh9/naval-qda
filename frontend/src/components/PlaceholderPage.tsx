export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="page-card">
      <p className="eyebrow">Coming next</p>
      <h2>{title}</h2>
      <p className="description">This section will be implemented in a later session.</p>
    </section>
  )
}
