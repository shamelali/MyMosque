import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-sand px-6">
      <div className="card max-w-sm p-8 text-center">
        <WifiOff className="mx-auto h-8 w-8 text-brand-900/30" />
        <h1 className="mt-4 text-lg font-semibold text-brand-950">Tiada sambungan</h1>
        <p className="mt-1 text-sm text-brand-900/55">
          Anda sedang luar talian. Halaman yang telah dibuka boleh dilihat semula; tindakan yang memerlukan
          data baharu akan disegerakkan apabila sambungan pulih.
        </p>
        <Link href="/" className="btn-primary mt-5">Cuba lagi</Link>
      </div>
    </div>
  );
}
