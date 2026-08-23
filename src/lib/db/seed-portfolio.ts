import { PrismaClient } from "../../generated/prisma";
import { Prisma, type Country } from "../../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

// quiet: true suppresses dotenv's self-promotional console "tip" line (see
// prisma.config.ts for the full explanation).
dotenv.config({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  // Find a user to assign this portfolio to, or look for the user with OWNER_EMAIL
  const email = process.env.OWNER_EMAIL || "owner@example.com";
  let user = await prisma.user.findFirst({
    where: { email }
  });

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    console.log("No user found. Creating a default user: " + email);
    user = await prisma.user.create({
      data: {
        email,
        name: "Owner User"
      }
    });
  }

  const userId = user.id;
  console.log(`Seeding data for user: ${user.name} (${user.email}), ID: ${userId}`);

  // USD Holdings (Source: INDmoney)
  const usdHoldings = [
    {
      symbol: "QTUM",
      name: "Defiance Quantum ETF",
      type: "ETF", // maps to US_STOCK / MUTUAL_FUND or we can use US_STOCK for US ETF/Stocks
      country: "US",
      currency: "USD",
      quantity: 2.959213,
      avgBuyPrice: 155.96,
      currentPrice: 155.97,
      source: "INDMONEY"
    },
    {
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      type: "ETF",
      country: "US",
      currency: "USD",
      quantity: 0.312445,
      avgBuyPrice: 666.01,
      currentPrice: 670.26,
      source: "INDMONEY"
    },
    {
      symbol: "QQQ", // standard ticker for Invesco NASDAQ ETF
      name: "Invesco NASDAQ ETF",
      type: "ETF",
      country: "US",
      currency: "USD",
      quantity: 0.386726,
      avgBuyPrice: 281.03,
      currentPrice: 290.95,
      source: "INDMONEY"
    },
    {
      symbol: "NVDA",
      name: "NVIDIA",
      type: "STOCK",
      country: "US",
      currency: "USD",
      quantity: 0.015189,
      avgBuyPrice: 197.51,
      currentPrice: 192.53,
      source: "INDMONEY"
    }
  ];

  // Indian Stocks (Source: Groww)
  const growwStocks = [
    { symbol: "SWIGGY", name: "Swiggy", type: "STOCK", country: "IN", currency: "INR", quantity: 10, avgBuyPrice: 255.80, currentPrice: 240.75, source: "GROWW" },
    { symbol: "TATAMOTORS", name: "Tata Motors Passenger", type: "STOCK", country: "IN", currency: "INR", quantity: 4, avgBuyPrice: 310.00, currentPrice: 353.20, source: "GROWW" }, // Adjusted avg buy to match ₹1240 total invested (1240/4)
    { symbol: "HUDCO", name: "HUDCO", type: "STOCK", country: "IN", currency: "INR", quantity: 6, avgBuyPrice: 167.49, currentPrice: 208.27, source: "GROWW" }, // Adjusted avg to match ₹1004.94 invested (1004.94/6)
    { symbol: "WIPRO", name: "Wipro", type: "STOCK", country: "IN", currency: "INR", quantity: 7, avgBuyPrice: 192.65, currentPrice: 175.00, source: "GROWW" }, // Adjusted avg to match ₹1348.55 invested (1348.55/7)
    { symbol: "ITC", name: "ITC", type: "STOCK", country: "IN", currency: "INR", quantity: 4, avgBuyPrice: 293.00, currentPrice: 290.00, source: "GROWW" }, // Adjusted avg to match ₹1172 invested (1172/4)
    { symbol: "IOB", name: "Indian Overseas Bank", type: "STOCK", country: "IN", currency: "INR", quantity: 6, avgBuyPrice: 32.45, currentPrice: 34.47, source: "GROWW" } // Adjusted avg to match ₹194.70 invested (194.70/6)
  ];

  // Indian Stocks (Source: Paytm Money)
  const paytmStocks = [
    { symbol: "SBICARD", name: "SBI Cards", type: "STOCK", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 673.70, currentPrice: 624.85, source: "PAYTM_MONEY" },
    { symbol: "HUDCO", name: "HUDCO", type: "STOCK", country: "IN", currency: "INR", quantity: 5, avgBuyPrice: 197.62, currentPrice: 208.27, source: "PAYTM_MONEY" },
    { symbol: "HDFCBANK", name: "HDFC Bank", type: "STOCK", country: "IN", currency: "INR", quantity: 4, avgBuyPrice: 774.77, currentPrice: 796.30, source: "PAYTM_MONEY" },
    { symbol: "WIPRO", name: "Wipro", type: "STOCK", country: "IN", currency: "INR", quantity: 11, avgBuyPrice: 218.41, currentPrice: 175.00, source: "PAYTM_MONEY" },
    { symbol: "VIKRAMSOLAR", name: "Vikram Solar", type: "STOCK", country: "IN", currency: "INR", quantity: 6, avgBuyPrice: 197.63, currentPrice: 185.28, source: "PAYTM_MONEY" },
    { symbol: "TATASTEEL", name: "Tata Steel", type: "STOCK", country: "IN", currency: "INR", quantity: 8, avgBuyPrice: 136.30, currentPrice: 188.71, source: "PAYTM_MONEY" },
    { symbol: "IDFCFIRSTB", name: "IDFC First Bank", type: "STOCK", country: "IN", currency: "INR", quantity: 9, avgBuyPrice: 85.92, currentPrice: 79.22, source: "PAYTM_MONEY" },
    { symbol: "ITC", name: "ITC", type: "STOCK", country: "IN", currency: "INR", quantity: 15, avgBuyPrice: 374.95, currentPrice: 290.00, source: "PAYTM_MONEY" },
    { symbol: "TATAMTRDVR", name: "Tata Motors Passenger Vehicles", type: "STOCK", country: "IN", currency: "INR", quantity: 13, avgBuyPrice: 403.21, currentPrice: 353.20, source: "PAYTM_MONEY" },
    { symbol: "TATAMOTORS", name: "Tata Motors Commercial Vehicles", type: "STOCK", country: "IN", currency: "INR", quantity: 8, avgBuyPrice: 190.29, currentPrice: 431.90, source: "PAYTM_MONEY" },
    { symbol: "VBL", name: "Varun Beverages", type: "STOCK", country: "IN", currency: "INR", quantity: 3, avgBuyPrice: 401.36, currentPrice: 507.65, source: "PAYTM_MONEY" },
    { symbol: "IREDA", name: "Indian Renewable Energy", type: "STOCK", country: "IN", currency: "INR", quantity: 9, avgBuyPrice: 138.32, currentPrice: 127.47, source: "PAYTM_MONEY" },
    { symbol: "ONGC", name: "ONGC", type: "STOCK", country: "IN", currency: "INR", quantity: 6, avgBuyPrice: 236.36, currentPrice: 233.10, source: "PAYTM_MONEY" },
    { symbol: "CANBK", name: "Canara Bank", type: "STOCK", country: "IN", currency: "INR", quantity: 5, avgBuyPrice: 138.91, currentPrice: 128.95, source: "PAYTM_MONEY" },
    { symbol: "IOB", name: "Indian Overseas Bank", type: "STOCK", country: "IN", currency: "INR", quantity: 16, avgBuyPrice: 38.14, currentPrice: 34.47, source: "PAYTM_MONEY" },
    { symbol: "SHRIRAMFIN", name: "Shriram Finance", type: "STOCK", country: "IN", currency: "INR", quantity: 3, avgBuyPrice: 621.65, currentPrice: 1031.80, source: "PAYTM_MONEY" },
    { symbol: "NTPC", name: "NTPC", type: "STOCK", country: "IN", currency: "INR", quantity: 4, avgBuyPrice: 372.53, currentPrice: 352.05, source: "PAYTM_MONEY" },
    { symbol: "VENTURA", name: "Ventura Textiles", type: "STOCK", country: "IN", currency: "INR", quantity: 17, avgBuyPrice: 11.08, currentPrice: 9.11, source: "PAYTM_MONEY" },
    { symbol: "HDFCNIFTY", name: "HDFCNIFTY ETF", type: "STOCK", country: "IN", currency: "INR", quantity: 8, avgBuyPrice: 273.11, currentPrice: 270.46, source: "PAYTM_MONEY" } // Adjusted LTP to fit ₹2163.68 current value (2163.68/8)
  ];

  // Mutual Funds (Source: Groww)
  const growwMFs = [
    { symbol: "JIOBR_FLEXI", name: "JioBlackRock Flexi Cap Fund Direct Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 11999, currentPrice: 12180, source: "GROWW", sipAmount: 3000, sipDay: 1 },
    { symbol: "ICICI_PHARMA", name: "ICICI Prudential Pharma Healthcare and Diagnostics (P.H.D) Fund Direct Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 9000, currentPrice: 9790, source: "GROWW", sipAmount: 1000, sipDay: 25 },
    { symbol: "BANDHAN_SMALL", name: "Bandhan Small Cap Fund Direct Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 8500, currentPrice: 9152, source: "GROWW", sipAmount: 2000, sipDay: 4 },
    { symbol: "NIPPON_SMALL", name: "Nippon India Small Cap Fund Direct Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 6400, currentPrice: 7149, source: "GROWW", sipAmount: null, sipDay: null },
    { symbol: "MOTILAL_MID", name: "Motilal Oswal Midcap Fund Direct Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 6500, currentPrice: 6440, source: "GROWW", sipAmount: null, sipDay: null },
    { symbol: "INVESCO_MID", name: "Invesco India Mid Cap Fund Direct Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 2000, currentPrice: 2085, source: "GROWW", sipAmount: 1000, sipDay: 12 },
    { symbol: "HDFC_FLEXI", name: "HDFC Flexi Cap Direct Plan Growth", type: "MUTUAL_FUND", country: "IN", currency: "INR", quantity: 1, avgBuyPrice: 1999, currentPrice: 2040, source: "GROWW", sipAmount: null, sipDay: null }
  ];

  const allSecurities = [...usdHoldings, ...growwStocks, ...paytmStocks, ...growwMFs];

  for (const s of allSecurities) {
    const instType = s.type === "STOCK" ? "IN_STOCK" : s.type === "ETF" ? "US_STOCK" : "MUTUAL_FUND";
    
    // Create instrument
    const instrument = await prisma.instrument.upsert({
      where: {
        type_symbol: {
          type: instType,
          symbol: s.symbol
        }
      },
      update: {
        name: s.name
      },
      create: {
        type: instType,
        symbol: s.symbol,
        name: s.name,
        country: s.country as Country,
        currency: s.currency
      }
    });

    // Create holding
    await prisma.holding.upsert({
      where: {
        userId_instrumentId_source: {
          userId,
          instrumentId: instrument.id,
          source: s.source
        }
      },
      update: {
        quantity: new Prisma.Decimal(s.quantity),
        avgBuyPrice: new Prisma.Decimal(s.avgBuyPrice)
      },
      create: {
        userId,
        instrumentId: instrument.id,
        source: s.source,
        quantity: new Prisma.Decimal(s.quantity),
        avgBuyPrice: new Prisma.Decimal(s.avgBuyPrice)
      }
    });

    // Save Price
    await prisma.price.upsert({
      where: {
        instrumentId_asOf: {
          instrumentId: instrument.id,
          asOf: new Date("2026-06-29T00:00:00Z")
        }
      },
      update: {
        price: new Prisma.Decimal(s.currentPrice)
      },
      create: {
        instrumentId: instrument.id,
        price: new Prisma.Decimal(s.currentPrice),
        currency: s.currency,
        asOf: new Date("2026-06-29T00:00:00Z"),
        source: "SEED"
      }
    });

    // Create SIP Plan if present (mutual funds only)
    const sipAmount =
      "sipAmount" in s ? (s.sipAmount as number | null) : null;
    const sipDay = "sipDay" in s ? (s.sipDay as number | null) : null;
    if (sipAmount && sipDay) {
      const today = new Date();
      let nextDate = new Date(today.getFullYear(), today.getMonth(), sipDay);
      if (nextDate < today) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 1, sipDay);
      }

      await prisma.sipPlan.create({
        data: {
          userId,
          instrumentId: instrument.id,
          amountInr: new Prisma.Decimal(sipAmount),
          frequency: "MONTHLY",
          dayOfMonth: sipDay,
          nextDate,
          active: true,
          source: s.source
        }
      });
    }
  }

  console.log("Seeding complete!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
