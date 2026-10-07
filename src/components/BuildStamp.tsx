// Product name and commit id, so a reader can confirm which build a page comes from.
export default function BuildStamp({ product }: { product: string }) {
  const build = import.meta.env.VITE_BUILD ?? "dev";
  return (
    <footer className="px-4 lg:px-5 pb-6 pt-1">
      <p className="text-ink/80 text-xs">
        {product} 2.0 · build {build}
      </p>
    </footer>
  );
}
