import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { rm } from "@/lib/utils";
import { removeFromCart, updateCartQty, clearCart, checkoutCart } from "../actions";

export default async function CartPage() {
  const user = await requirePageUser();

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: { items: { include: { item: true } } },
  });

  const cartItems = cart?.items ?? [];
  const totalSen = cartItems.reduce((sum, ci) => sum + ci.item.priceSen * ci.qty, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Keranjang Belanja"
        title="Keranjang Anda"
        description="Semak item sebelum pemeriksaan."
        back={{ href: "/jemaah/kedai", label: "Kembali kedai" }}
      />

      {cartItems.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-brand-900/50">Keranjang kosong.</p>
          <Link href="/jemaah/kedai" className="btn-primary mt-4">
            Lawati kedai
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cartItems.map((ci) => (
              <Card key={ci.id}>
                <CardHeader title={ci.item.name} />
                <CardContent className="pb-0">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-semibold text-brand-950">{rm(ci.item.priceSen)}</span>
                    <span className="text-xs text-brand-900/50">× {ci.qty}</span>
                  </div>
                  <p className="text-[11px] text-brand-900/45">
                    Stok tinggal: {ci.item.stock}
                  </p>
                  <form action={updateCartQty} className="mt-3 space-y-2" method="POST">
                    <input type="hidden" name="itemId" value={ci.itemId} />
                    <div className="flex items-center gap-2">
                      <input
                        name="qty"
                        type="number"
                        min="1"
                        defaultValue={ci.qty}
                        className="w-12 input text-center"
                      />
                      <Button type="submit" size="sm" className="h-auto px-3">
                        Simpan
                      </Button>
                    </div>
                  </form>
                  <form action={removeFromCart} className="mt-2" method="POST">
                    <input type="hidden" name="itemId" value={ci.itemId} />
                    <Button type="submit" variant="destructive" size="sm" className="w-full h-auto px-3 py-2">
                      Buang
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 border-t border-brand-900/10 pt-6">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium text-brand-900">Jumlah:</span>
              <span className="text-lg font-semibold text-brand-950">{rm(totalSen)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-brand-900/50 mb-4">
              <span>Commission platform (1.5%):</span>
              <span>-{rm(Math.round((totalSen * 1.5) / 100))}</span>
            </div>

            <form action={checkoutCart} className="space-y-3" method="POST">
              <div>
                <label className="label block text-xs font-semibold text-brand-900/65 mb-1">
                  Nama pembeli
                </label>
                <input name="buyerName" type="text" required className="input w-full" />
              </div>
              <div>
                <label className="label block text-xs font-semibold text-brand-900/65 mb-1">
                  E-mel untuk resit
                </label>
                <input name="buyerEmail" type="email" required className="input w-full" />
              </div>
              <div>
                <label className="label block text-xs font-semibold text-brand-900/65 mb-1">
                  Telefon
                </label>
                <input name="buyerPhone" type="tel" className="input w-full" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="btn-primary flex-1">
                  Seterusnya ke pembayaran
                </Button>
                <form action={clearCart} method="POST" className="flex-1">
                  <Button type="submit" variant="outline" className="w-full">
                    Kosongkan semua
                  </Button>
                </form>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
