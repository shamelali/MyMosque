import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { rm } from "@/lib/utils";
import { addToCart } from "./actions";

export default async function KedaiPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string; ditambah?: string }>;
}) {
  const user = await requirePageUser();
  const { ralat, ditambah } = await searchParams;

  const items = await prisma.storeItem.findMany({
    where: {
      status: "AKTIF",
      ...(user.mosqueId ? { mosqueId: user.mosqueId } : {}),
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Kedai Masjid"
        title="Belian Barang"
        description="Beli item yang disediakan oleh masjid. Resit akan dijana selepas pembayaran disahkan."
        back={{ href: "/jemaah", label: "Kembali ke utama" }}
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      {ditambah && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Item ditambah ke keranjang.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.length > 0 ? (
          items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader title={item.name} description={item.description} />
              <CardContent className="pb-0">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-semibold text-brand-950">{rm(item.priceSen)}</span>
                  {item.stock === 0 && (
                    <span className="text-xs font-medium text-red-600">Habis stok</span>
                  )}
                </div>
                <p className="text-[11px] text-brand-900/45 mb-1">
                  Stok: {item.stock} unit · SKU: {item.sku}
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                {item.stock === 0 ? (
                  <Button variant="outline" disabled className="w-full">
                    Habis stok
                  </Button>
                ) : (
                  <form action={addToCart} className="w-full">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="qty" value="1" />
                    <Button type="submit" className="w-full">
                      Tambah ke keranjang
                    </Button>
                  </form>
                )}
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="text-brand-900/50 text-center">Tiada item kedai untuk saat ini.</p>
        )}
      </div>

      <div className="mt-6">
        <Link href="/jemaah/kedai/cart" className="btn-primary">
          Lihat keranjang belanja
        </Link>
      </div>
    </div>
  );
}
