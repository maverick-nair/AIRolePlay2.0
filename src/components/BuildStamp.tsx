// Product name and commit id, so a reader can confirm which build a page comes from.
export default function BuildStamp({ product }: { product: string }) {
  const build = import.meta.env.VITE_BUILD ?? "dev";
  return (
    <footer className="max-w-7xl mx-auto px-6 md:px-10 pb-8 pt-2">
      <p className="text-ink/70 text-xs font-display tracking-wide">
        {product} 2.0 · build {build}
      </p>
    </footer>
  );
}
