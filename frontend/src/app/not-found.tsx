import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#20211E] flex flex-col items-center justify-center p-6 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-[#7D9F68] mb-3">
        404 • Page Not Found
      </span>
      <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#20211E] mb-4">
        A quiet detour.
      </h1>
      <p className="text-sm text-[#6F7069] max-w-md mb-8 leading-relaxed">
        The page you are looking for has either been moved or is not part of this syllabus.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-full bg-[#20211E] hover:bg-[#343631] text-white text-xs font-medium transition-all shadow-sm"
      >
        Return to VIVORA Home →
      </Link>
    </div>
  );
}
