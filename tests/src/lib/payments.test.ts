import { mock } from "node:test";
import assert from "node:assert";

void (async () => {
  // Force dev so db.ts falls back to the globalThis prisma singleton, which we
  // replace with an in-memory fake before importing payments.ts. This avoids
  // node:test's experimental mock.module (unavailable in Node 22) and tsx's
  // CJS require path, which cannot resolve the @/ path alias under --test.
  process.env.NODE_ENV = "development";

  const fakePrisma = {
    integrationConfig: { findUnique: mock.fn(async () => null) },
    paymentIntent: { create: mock.fn(async () => ({ id: "pi_mock" })) },
  };
  globalThis.prisma = fakePrisma;

  const {
    splitSettlement,
    createIntent,
    integrationMode,
    COMMISSION_PCT,
  } = await import("@/lib/payments");

  let passes = 0;
  let failures = 0;

  async function test(
    name: string,
    fn: () => Promise<void> | void,
  ) {
    try {
      await fn();
      passes++;
      console.log(`ok - ${name}`);
    } catch (err) {
      failures++;
      console.error(`not ok - ${name}`);
      console.error(err instanceof Error ? err.stack : String(err));
    }
  }

  async function describe(name: string, fn: () => Promise<void> | void) {
    console.log(`# ${name}`);
    await fn();
  }

  await test("splitSettlement computes 1.5% commission by default", () => {
    assert.deepStrictEqual(splitSettlement(10000), {
      grossSen: 10000,
      commissionSen: 150,
      netSen: 9850,
    });
  });

  await test("splitSettlement rounds commission to nearest sen", () => {
    const result = splitSettlement(1001);
    assert.strictEqual(result.commissionSen, 15);
    assert.strictEqual(result.netSen, 986);
  });

  await test("splitSettlement supports custom commission percentage", () => {
    assert.deepStrictEqual(splitSettlement(10000, 10), {
      grossSen: 10000,
      commissionSen: 1000,
      netSen: 9000,
    });
  });

  await test("splitSettlement returns zero net when amount is zero", () => {
    assert.deepStrictEqual(splitSettlement(0), { grossSen: 0, commissionSen: 0, netSen: 0 });
  });

  await test("splitSettlement uses COMMISSION_PCT constant of 1.5", () => {
    assert.strictEqual(COMMISSION_PCT, 1.5);
  });

  await describe("integrationMode", async () => {
    await test("defaults to MOCK when no IntegrationConfig exists", async () => {
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => null);
      assert.strictEqual(await integrationMode("gateway"), "MOCK");
    });

    await test("returns LIVE when IntegrationConfig mode is LIVE", async () => {
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => ({ mode: "LIVE" }));
      assert.strictEqual(await integrationMode("gateway"), "LIVE");
    });

    await test("returns MOCK when IntegrationConfig mode is MOCK", async () => {
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => ({ mode: "MOCK" }));
      assert.strictEqual(await integrationMode("gateway"), "MOCK");
    });
  });

  await describe("createIntent MOCK mode", async () => {
    await test("creates a MOCK intent with checkoutToken and stores PENDING record", async () => {
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => null);
      fakePrisma.paymentIntent.create = mock.fn(async () => ({ id: "pi_mock" }));

      const result = await createIntent({
        amountSen: 50000,
        purpose: "DONATION",
        description: "Derma tabung am",
        payerName: "Ali",
        payerEmail: "ali@example.com",
        entityId: "don_1",
      });

      assert.strictEqual(result.provider, "MOCK");
      assert.strictEqual(result.amountSen, 50000);
      assert.strictEqual(result.checkoutUrl, null);
      assert.match(result.checkoutToken ?? "", /^chk_[0-9a-f]+$/);
      assert.match(result.ref, /^MOCK-DON-/);
      assert.ok(result.expiresAt instanceof Date);

      assert.strictEqual(fakePrisma.paymentIntent.create.mock.calls.length, 1);
      assert.deepStrictEqual(fakePrisma.paymentIntent.create.mock.calls[0].arguments[0], {
        data: {
          gatewayRef: result.ref,
          provider: "MOCK",
          kind: "DONATION",
          entityId: "don_1",
          amountSen: 50000,
          status: "PENDING",
        },
      });
    });

    await test("creates a MOCK intent for QURAN_BOOKING purpose", async () => {
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => null);
      fakePrisma.paymentIntent.create = mock.fn(async () => ({ id: "pi_mock" }));

      const result = await createIntent({
        amountSen: 30000,
        purpose: "QURAN_BOOKING",
        description: "Kelas Al-Quran 4 jam",
        payerName: "Siti",
        payerEmail: "siti@example.com",
        entityId: "qrn_1",
      });

      assert.strictEqual(result.provider, "MOCK");
      assert.match(result.ref, /^MOCK-QUR-/);
    });
  });

  await describe("createIntent LIVE mode without gateway key", async () => {
    await test("throws when HITPAY_API_KEY is not configured", async () => {
      delete process.env.HITPAY_API_KEY;
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => ({
        mode: "LIVE",
        config: JSON.stringify({ provider: "HITPAY" }),
      }));
      fakePrisma.paymentIntent.create = mock.fn(async () => ({ id: "pi_mock" }));

      await assert.rejects(
        () =>
          createIntent({
            amountSen: 50000,
            purpose: "DONATION",
            description: "Derma tabung am",
            payerName: "Ali",
            payerEmail: "ali@example.com",
            entityId: "don_1",
          }),
        /HITPAY_API_KEY belum dikonfigurasi/,
      );

      assert.strictEqual(fakePrisma.paymentIntent.create.mock.calls.length, 0);
    });

    await test("throws when BILLPLZ_API_KEY is not configured", async () => {
      delete process.env.BILLPLZ_API_KEY;
      process.env.BILLPLZ_COLLECTION_ID = "col_test";
      fakePrisma.integrationConfig.findUnique = mock.fn(async () => ({
        mode: "LIVE",
        config: JSON.stringify({ provider: "BILLPLZ" }),
      }));
      fakePrisma.paymentIntent.create = mock.fn(async () => ({ id: "pi_mock" }));

      await assert.rejects(
        () =>
          createIntent({
            amountSen: 50000,
            purpose: "DONATION",
            description: "Derma tabung am",
            payerName: "Ali",
            payerEmail: "ali@example.com",
            entityId: "don_1",
          }),
        /BILLPLZ_API_KEY belum dikonfigurasi/,
      );

      assert.strictEqual(fakePrisma.paymentIntent.create.mock.calls.length, 0);
    });
  });

  console.log(`\n# ${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();
