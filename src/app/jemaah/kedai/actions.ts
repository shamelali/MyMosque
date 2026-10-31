"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createIntent, confirmPayment, splitSettlement, type PaymentPurpose } from "@/lib/payments";
import { rm } from "@/lib/utils";

const BASE = "/jemaah/kedai";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

export async function addToCart(formData: FormData) {
  const user = await requirePageUser();
  const itemId = text(formData, "itemId");
  const qtyRaw = text(formData, "qty");
  const qty = Number.parseInt(qtyRaw, 10) || 1;
  if (!itemId) fail("Item tidak sah.");
  if (qty < 1) fail("Kuantiti mesti lebih daripada 0.");

  const item = await prisma.storeItem.findUnique({
    where: { id: itemId },
    select: { id: true, stock: true, status: true },
  });
  if (!item) fail("Item tidak dijumpai.");
  if (item.status !== "AKTIF") fail("Item ini tidak tersedia untuk dibeli.");
  if (item.stock < qty) fail("Stok tidak mencukupi.");

  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId: user.id } });
  }

  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, itemId },
  });
  const newQty = (existing?.qty ?? 0) + qty;
  if (newQty > item.stock) fail(`Stok mencukupi hanya ${item.stock} unit.`);

  await prisma.cartItem.upsert({
    where: { cartId_itemId: { cartId: cart.id, itemId } },
    update: { qty: newQty },
    create: { cartId: cart.id, itemId, qty },
  });

  revalidatePath(BASE);
  redirect(`${BASE}?ditambah=1`);
}

export async function removeFromCart(formData: FormData) {
  const user = await requirePageUser();
  const itemId = text(formData, "itemId");
  if (!itemId) fail("Item tidak sah.");

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) return redirect(`${BASE}/cart`);

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, itemId } });
  revalidatePath(`${BASE}/cart`);
  redirect(`${BASE}/cart`);
}

export async function updateCartQty(formData: FormData) {
  const user = await requirePageUser();
  const itemId = text(formData, "itemId");
  const qty = Number.parseInt(text(formData, "qty"), 10);
  if (!itemId || qty < 1) fail("Kuantiti tidak sah.");

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) return redirect(`${BASE}/cart`);

  const item = await prisma.storeItem.findUnique({
    where: { id: itemId },
    select: { stock: true },
  });
  if (!item || qty > item.stock) fail("Stok tidak mencukupi.");

  await prisma.cartItem.update({
    where: { cartId_itemId: { cartId: cart.id, itemId } },
    data: { qty },
  });

  revalidatePath(`${BASE}/cart`);
  redirect(`${BASE}/cart`);
}

export async function clearCart() {
  const user = await requirePageUser();
  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  revalidatePath(`${BASE}/cart`);
  redirect(`${BASE}/cart`);
}

export async function checkoutCart(formData: FormData) {
  const user = await requirePageUser();

  const buyerName = text(formData, "buyerName");
  const buyerEmail = text(formData, "buyerEmail").toLowerCase();
  const buyerPhone = text(formData, "buyerPhone");
  if (!buyerName) fail("Nama pembeli wajib diisi.");
  if (!buyerEmail || !/^[^\s@]+@[^\s@]+$/.test(buyerEmail)) {
    fail("Alamat e-mel yang sah diperlukan untuk resit.");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: { items: { include: { item: true } } },
  });
  if (!cart || cart.items.length === 0) fail("Keranjang kosong.");

  let totalSen = 0;
  for (const ci of cart.items) {
    if (ci.item.stock < ci.qty) fail(`Stok tidak mencukupi untuk ${ci.item.name}.`);
    totalSen += ci.item.priceSen * ci.qty;
  }

  const commission = splitSettlement(totalSen).commissionSen;

  const orderNo = `STORE-${Date.now().toString(36).toUpperCase()}`;
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo,
        mosqueId: cart.items[0].item.mosqueId,
        buyerUserId: user.id,
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || null,
        totalSen,
        commissionSen: commission,
        netSen: totalSen - commission,
        status: "MENUNGGU_BAYARAN",
      },
    });
    for (const ci of cart.items) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          itemId: ci.itemId,
          sku: ci.item.sku,
          name: ci.item.name,
          qty: ci.qty,
          priceSen: ci.item.priceSen,
        },
      });
    }
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return order;
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Order",
    entityId: order.id,
    mosqueId: order.mosqueId,
    after: { orderNo, totalSen, commissionSen: commission, items: cart.items.length },
  });

  revalidatePath(`${BASE}/cart`);
  redirect(`/jemaah/bayar/STORE/${order.id}`);
}
