import { Router, type IRouter } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  buyItemsTable,
  bouquetPlansTable,
  closeMarketsTable,
  flowerCareEntriesTable,
  flowerKnowledgeEntriesTable,
  marketActualPurchasesTable,
  marketDayTodoItemsTable,
  marketDayTodoSnapshotsTable,
  flowerPriceBackfillsTable,
  marketBuyListEditLogsTable,
  marketBuyListStatesTable,
  marketCostsTable,
  nonFlowerBankImportDetailsTable,
  nonFlowerBankImportLinesTable,
  nonFlowerBankImportsTable,
  nonFlowerPurchaseAllocationsTable,
  nonFlowerPurchasesTable,
  marketsTable,
  marketScheduleOverridesTable,
  flowerCategories,
} from "@workspace/db";
import {
  GetMarketContextParams,
  GetMarketContextResponse,
  ListFlowerPricesResponse,
  ListFlowerPriceTrackerResponse,
  ListFlowerPriceDashboardResponse,
  CreateFlowerPriceBackfillBody,
  CreateFlowerPriceBackfillResponse,
  ListMarketsResponse,
  GetSellThroughComparisonResponse,
  ReplaceMarketCostsBody,
  ReplaceMarketCostsParams,
  ReplaceMarketCostsResponse,
  ReportMarketPurchasesResponse,
  ReportMarketPurchasesParams,
  ReplaceMarketActualPurchasesBody,
  ReplaceMarketActualPurchasesParams,
  ReplaceMarketActualPurchasesResponse,
  UpdateMarketBuyListBody,
  UpdateMarketBuyListParams,
  UpdateMarketBuyListResponse,
  UpdateMarketBouquetPlanBody,
  UpdateMarketBouquetPlanParams,
  UpdateMarketBouquetPlanResponse,
  UpdateMarketBuyItemBody,
  UpdateMarketBuyItemParams,
  UpdateMarketBuyItemResponse,
  UpdateMarketCloseBody,
  UpdateMarketCloseParams,
  UpdateMarketCloseResponse,
  ListMarketScheduleOverridesResponse,
  UpsertMarketScheduleOverrideBody,
  UpsertMarketScheduleOverrideParams,
  UpsertMarketScheduleOverrideResponse,
  DeleteMarketScheduleOverrideParams,
  ListFlowerCareResponse,
  UpdateFlowerCareBody,
  UpdateFlowerCareParams,
  UpdateFlowerCareResponse,
  ListFlowerKnowledgeResponse,
  UpdateFlowerKnowledgeBody,
  UpdateFlowerKnowledgeParams,
  UpdateFlowerKnowledgeResponse,
  ListMarketDayTodosResponse,
  ReplaceMarketDayTodosBody,
  ReplaceMarketDayTodosParams,
  ReplaceMarketDayTodosResponse,
  ListNonFlowerPurchasesResponse,
  ImportNonFlowerBankFileBody,
  ImportNonFlowerBankFileParams,
  ImportNonFlowerBankFileResponse,
  ReplaceNonFlowerBankImportDetailsBody,
  ReplaceNonFlowerBankImportDetailsParams,
  ReplaceNonFlowerBankImportDetailsResponse,
  ReplaceNonFlowerPurchasesBody,
  ReplaceNonFlowerPurchasesParams,
  ReplaceNonFlowerPurchasesResponse,
} from "@workspace/api-zod";
import type { FlowerCategory, FlowerKnowledgeSection, SellThroughRecord } from "@workspace/db";
import {
  formatScheduledMarketDate,
  getScheduledMarketDate,
  isSkippedMarketCycle,
  type MarketScheduleOverride as ScheduleOverride,
} from "../lib/market-schedule";

const router: IRouter = Router();

const seededMarkets = [
  { cycle: 0, venue: "Redcliffe Markets", spend: 642.8, revenue: 1846, margin: 65.2 },
  { cycle: -40, venue: "Redcliffe Markets", spend: 598.4, revenue: 1712, margin: 65.0 },
  { cycle: -41, venue: "Redcliffe Markets", spend: 621.1, revenue: 1938, margin: 67.9 },
  { cycle: -42, venue: "Redcliffe Markets", spend: 560.5, revenue: 1587, margin: 64.7 },
];

const defaultBuyItems: Array<{
  flower: string;
  detail: string;
  qty: number;
  unit: string;
  lastPrice: number;
  checked: boolean;
  category: FlowerCategory;
}> = [
  { flower: "Lisianthus", detail: "White · classic blooms", qty: 4, unit: "bunches", lastPrice: 18.5, checked: true, category: "Classic Blooms" },
  { flower: "Disbud chrysanthemum", detail: "Apricot · statement blooms", qty: 3, unit: "bunches", lastPrice: 22, checked: false, category: "Statement Blooms" },
  { flower: "Snapdragon", detail: "Blush · classic blooms", qty: 4, unit: "bunches", lastPrice: 16, checked: false, category: "Classic Blooms" },
  { flower: "Daisy", detail: "White · classic blooms", qty: 3, unit: "bunches", lastPrice: 12.5, checked: false, category: "Classic Blooms" },
  { flower: "Queen Anne’s lace", detail: "White · textural foliage", qty: 2, unit: "bunches", lastPrice: 19, checked: false, category: "Textural Foliage" },
  { flower: "Eucalyptus foliage", detail: "Silver dollar · gum", qty: 4, unit: "bunches", lastPrice: 10, checked: false, category: "Gum" },
  { flower: "Billy buttons", detail: "Golden · textural foliage", qty: 2, unit: "bunches", lastPrice: 13.5, checked: false, category: "Textural Foliage" },
];

const defaultCloseCounts = { Lisianthus: 2, Daisy: 7, Snapdragon: 3, "Eucalyptus foliage": 5 };

type FlowerCareSeed = {
  instructions: string;
  sourceName: string;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
};

const defaultFlowerCare: Record<string, FlowerCareSeed> = {
  "billy buttons": {
    instructions: "Re-cut the stems cleanly and place in fresh water. Remove any foliage below the waterline and keep the vase cool, away from direct sun and heat. Billy buttons also dry well: hang them upside down in a warm, dark, dry place once you want to preserve them.",
    sourceName: "Plantura — Craspedia care",
    sourceUrl: "https://plantura.garden/uk/flowers-perennials/craspedia/craspedia-overview",
    confidence: "medium",
  },
  "daisy": {
    instructions: "Use a clean vase and fresh water with flower food. Re-cut the stems on an angle, remove leaves below the waterline, and condition in a cool, dark place before arranging. Refresh the water every 2–3 days and keep daisies away from direct sun, heat and drafts.",
    sourceName: "NC State Extension — Selecting & caring for cut flowers",
    sourceUrl: "https://gardening.ces.ncsu.edu/gardening-plants/flowers-2/selecting-caring-for-cut-flowers",
    confidence: "medium",
  },
  "disbud chrysanthemum": {
    instructions: "Start with a clean, sanitised bucket or vase. Re-cut about 2–3 cm from the stems with a clean tool, remove every leaf that would sit below the waterline, and place immediately into flower food. Allow at least two hours to hydrate, keep cool, and rotate older stock first.",
    sourceName: "FloraLife — Chrysanthemum care and handling",
    sourceUrl: "https://floralife.com/2023/03/21/chrysanthemum-the-florists-most-reliable-asset",
    confidence: "high",
  },
  "eucalyptus foliage": {
    instructions: "Trim the stems on an angle, strip leaves that would sit below the waterline, and place into clean, cool water. Re-cut if the foliage droops and change the water regularly. Eucalyptus can be left to dry in the vase or hung to dry when you want to preserve it.",
    sourceName: "Moyses Flowers — Eucalyptus care",
    sourceUrl: "https://www.moysesflowers.mom/flower-care/eucalyptus",
    confidence: "high",
  },
  lisianthus: {
    instructions: "Give lisianthus a clean vase, fresh water and flower food as soon as possible. Re-cut the stems on an angle, remove excess foliage below the waterline, and keep the vase topped up because lisianthus are thirsty. Keep them cool, out of drafts, direct sun, heaters and fruit bowls.",
    sourceName: "Plants & Flowers Foundation Holland — Lisianthus care",
    sourceUrl: "https://www.plantsandflowersfoundationholland.org/en/flowerguide/lisianthus",
    confidence: "high",
  },
  "queen anne's lace": {
    instructions: "Buy or cut stems while the flower heads are still fairly closed. Remove all foliage below the waterline, make a sharp fresh cut, and hydrate separately in water with commercial flower food for about two hours before using in an arrangement. Change water regularly and re-cut if needed.",
    sourceName: "Floral Design Institute — Queen Anne’s Lace",
    sourceUrl: "https://www.floraldesigninstitute.com/blogs/resources-flower-library/queen-annes-lace",
    confidence: "medium",
  },
  snapdragon: {
    instructions: "Keep snapdragon stems upright while conditioning. Re-cut with a clean tool, remove leaves below the waterline, and place into clean water with flower food. Keep them away from ripening fruit because snapdragons are sensitive to ethylene; keep cool and out of direct sun and heat.",
    sourceName: "UC Davis Postharvest Research & Extension Center — Snapdragon",
    sourceUrl: "https://postharvest.ucdavis.edu/produce-facts-sheets/snapdragon",
    confidence: "high",
  },
};

function normalizeFlowerName(flower: string): string {
  return flower.trim().toLowerCase().replace(/[’]/g, "'");
}

function getFlowerCareSeed(flower: string): FlowerCareSeed {
  return defaultFlowerCare[normalizeFlowerName(flower)] ?? {
    instructions: "Use a clean vase and fresh water with flower food. Re-cut the stems with a clean tool, remove all foliage below the waterline, and keep the flowers cool and away from direct sun, heat, drafts and ripening fruit. Refresh the water regularly and re-cut if the stems begin to droop.",
    sourceName: "NC State Extension — Selecting & caring for cut flowers",
    sourceUrl: "https://gardening.ces.ncsu.edu/gardening-plants/flowers-2/selecting-caring-for-cut-flowers",
    confidence: "low",
  };
}

async function readFlowerCareEntries() {
  const purchases = await db
    .select({
      flower: marketActualPurchasesTable.flower,
      marketCycle: marketActualPurchasesTable.marketCycle,
      totalStemQty: marketActualPurchasesTable.totalStemQty,
    })
    .from(marketActualPurchasesTable)
    .orderBy(asc(marketActualPurchasesTable.flower), asc(marketActualPurchasesTable.marketCycle));
  const stats = new Map<string, { purchaseCount: number; purchasedStems: number; lastPurchasedCycle: number }>();
  for (const purchase of purchases) {
    const current = stats.get(purchase.flower) ?? { purchaseCount: 0, purchasedStems: 0, lastPurchasedCycle: purchase.marketCycle };
    current.purchaseCount += 1;
    current.purchasedStems += purchase.totalStemQty ?? 0;
    current.lastPurchasedCycle = Math.max(current.lastPurchasedCycle, purchase.marketCycle);
    stats.set(purchase.flower, current);
  }
  const flowerNames = [...stats.keys()];
  for (const flower of flowerNames) {
    const seed = getFlowerCareSeed(flower);
    await db
      .insert(flowerCareEntriesTable)
      .values({ flower, ...seed })
      .onConflictDoNothing({ target: flowerCareEntriesTable.flower });
  }
  const entries = flowerNames.length
    ? await db.select().from(flowerCareEntriesTable).where(inArray(flowerCareEntriesTable.flower, flowerNames))
    : [];
  const entriesByFlower = new Map(entries.map((entry) => [entry.flower, entry]));
  return flowerNames
    .map((flower) => {
      const entry = entriesByFlower.get(flower);
      const purchaseStats = stats.get(flower)!;
      return entry ? { ...entry, ...purchaseStats } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.flower.localeCompare(b.flower));
}

type FlowerKnowledgeSeed = {
  sourceName: string;
  sourceUrl: string;
  petSourceName: string;
  petSourceUrl: string;
  confidence: "high" | "medium" | "low";
  vaseWithFood: string;
  vaseWithoutFood: string;
  driedLife: string;
  pairing: string;
  fragrance: string;
  opens: string;
  meaning: string;
  dries: string;
  sun: string;
  water: string;
  pets: string;
};

const knowledgeSectionLabels = {
  "vase-and-dried-life": "Vase life and dried life",
  "pairing-compatibility": "Pairing compatibility",
  fragrance: "Fragrance",
  "opens-indoors": "Opens further indoors",
  "symbolic-meaning": "Symbolic / traditional meaning",
  "dries-well": "Dries well",
  "sun-sensitivity": "Sun sensitivity",
  "water-consumption": "Water consumption",
  "pet-safety": "Pet safety",
} as const;

function buildFlowerKnowledge(seed: FlowerKnowledgeSeed): FlowerKnowledgeSection[] {
  const source = (key: keyof typeof knowledgeSectionLabels, value: string, overrides?: Partial<FlowerKnowledgeSection>): FlowerKnowledgeSection => ({
    key,
    label: knowledgeSectionLabels[key],
    value,
    sourceName: seed.sourceName,
    sourceUrl: seed.sourceUrl,
    subvalues: [],
    sourceStatus: "auto-sourced",
    confidence: seed.confidence,
    ...overrides,
  });
  return [
    source("vase-and-dried-life", "See the three vase and drying estimates below.", {
      subvalues: [
        { label: "Vase life with flower food", value: seed.vaseWithFood },
        { label: "Vase life without flower food", value: seed.vaseWithoutFood },
        { label: "Dried life", value: seed.driedLife },
      ],
    }),
    source("pairing-compatibility", seed.pairing),
    source("fragrance", seed.fragrance),
    source("opens-indoors", seed.opens),
    source("symbolic-meaning", seed.meaning),
    source("dries-well", seed.dries),
    source("sun-sensitivity", seed.sun),
    source("water-consumption", seed.water),
    source("pet-safety", seed.pets, {
      sourceName: seed.petSourceName,
      sourceUrl: seed.petSourceUrl,
      confidence: seed.petSourceName.startsWith("ASPCA") ? "high" : "low",
    }),
  ];
}

const defaultFlowerKnowledge: Record<string, FlowerKnowledgeSection[]> = {
  "billy buttons": buildFlowerKnowledge({
    sourceName: "Plantura — Craspedia care",
    sourceUrl: "https://plantura.garden/uk/flowers-perennials/craspedia/craspedia-overview",
    petSourceName: "ASPCA — toxic and non-toxic plant guidance",
    petSourceUrl: "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants",
    confidence: "medium",
    vaseWithFood: "About 14–21 days is a practical florist estimate when conditioned in clean water with food; cultivar and harvest stage vary.",
    vaseWithoutFood: "About 10–14 days is a cautious estimate in clean water without food; change water before it clouds.",
    driedLife: "Several years when fully dry and kept away from humidity; the round heads hold their shape well.",
    pairing: "Works well with airy fillers, grasses, eucalyptus and soft garden flowers. Its stiff stems can dominate delicate, compact designs.",
    fragrance: "Little to no noticeable fragrance is expected.",
    opens: "No. The spherical heads are largely formed at harvest and do not noticeably open indoors.",
    meaning: "Often associated with resilience, good health, optimism and everlasting friendship; meanings are cultural rather than botanical facts.",
    dries: "Yes. It is one of the more dependable flowers for drying and can be dried in roughly 7–10 days in a warm, dark, dry place.",
    sun: "Fresh stems last longer in bright, indirect light. Avoid hot direct sun, which can fade the yellow heads and warm the water.",
    water: "Moderate to low once conditioned; use a shallow clean-water level and monitor for woody stems or clouding.",
    pets: "A species-specific ASPCA listing was not found for Craspedia. Treat it as unconfirmed rather than pet-safe, and prevent pets from chewing any bouquet material.",
  }),
  daisy: buildFlowerKnowledge({
    sourceName: "Plants & Flowers Foundation Holland — Daisy care",
    sourceUrl: "https://www.plantsandflowersfoundationholland.org/en/flowerguide/daisy",
    petSourceName: "ASPCA — Daisy",
    petSourceUrl: "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/daisy",
    confidence: "medium",
    vaseWithFood: "About 7–10 days with clean water, flower food and regular stem recutting.",
    vaseWithoutFood: "About 5–7 days without food; hygiene and frequent water changes become more important.",
    driedLife: "Usually months when completely dry, though the petals may curl or fade.",
    pairing: "Pairs easily with lisianthus, snapdragons, foliage and other relaxed meadow flowers; keep the palette and stem strength balanced.",
    fragrance: "Usually light or not noticeable; fragrance varies by daisy type.",
    opens: "Some buds may continue to open indoors, but harvested stems will not all open equally.",
    meaning: "Commonly associated with innocence, cheerfulness, loyal love and new beginnings.",
    dries: "Fairly well, but the result is more delicate than a dried billy button and may lose petal shape.",
    sun: "Keep in bright, indirect light. Direct heat and sun shorten vase life and can bleach the petals.",
    water: "Moderate to high; check the vase daily because leafy stems and warm rooms increase uptake.",
    pets: "Common-name ambiguity matters: ASPCA lists some plants called Daisy as toxic, while Gerber daisy is listed separately. Identify the species before calling a bouquet pet-safe.",
  }),
  "disbud chrysanthemum": buildFlowerKnowledge({
    sourceName: "FloraLife — Chrysanthemum handling",
    sourceUrl: "https://floralife.com/2023/03/21/chrysanthemum-the-florists-most-reliable-asset",
    petSourceName: "ASPCA — Chrysanthemum",
    petSourceUrl: "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/chrysanthemum",
    confidence: "high",
    vaseWithFood: "About 14–21 days with flower food, clean water and properly conditioned stems.",
    vaseWithoutFood: "About 7–14 days without food, depending on hygiene, temperature and stem condition.",
    driedLife: "Several months when dried carefully, although the large disbud head can become brittle and may fade.",
    pairing: "A reliable structural focal flower with lisianthus, snapdragons, eucalyptus and textural fillers; give the large head room.",
    fragrance: "Usually mild to moderate and variable; some chrysanthemums have a distinctly herbal scent.",
    opens: "Yes, if harvested before full maturity. Disbuds open gradually indoors, but a very tight or damaged bud may not fully expand.",
    meaning: "Often linked with longevity, joy, optimism and honour; colour and cultural context change the meaning.",
    dries: "Yes, with mixed results. Hang individual heads in a dark, dry, ventilated place and expect some colour change.",
    sun: "Sensitive to heat and strong direct sun once cut; bright indirect light is safer for preserving colour.",
    water: "High during conditioning and moderate thereafter; keep the vase topped up and remove foliage below the waterline.",
    pets: "ASPCA lists Chrysanthemum species as toxic to dogs, cats and horses. Keep disbuds away from pets and seek veterinary advice after ingestion.",
  }),
  "eucalyptus foliage": buildFlowerKnowledge({
    sourceName: "Moyses Flowers — Eucalyptus care",
    sourceUrl: "https://www.moysesflowers.mom/flower-care/eucalyptus",
    petSourceName: "ASPCA — Eucalyptus",
    petSourceUrl: "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/eucalyptus",
    confidence: "high",
    vaseWithFood: "About 14–21 days with clean water and flower food; foliage may last longer if refreshed and kept cool.",
    vaseWithoutFood: "About 7–14 days without food. Some stems can begin drying in the vase before they decline.",
    driedLife: "Many months to years when kept dry; leaves may darken or become crisp over time.",
    pairing: "Pairs broadly with nearly all listed flowers, especially lisianthus, snapdragons, daisies and billy buttons. Its scent and shape can overwhelm small arrangements.",
    fragrance: "Distinctive camphor-like eucalyptus fragrance, strongest when the leaves are rubbed or warmed.",
    opens: "Not applicable to foliage; it does not open like a flower. New side growth will not develop after cutting.",
    meaning: "Often used to represent protection, healing, cleansing and renewal, depending on the tradition.",
    dries: "Yes. It can dry upright in a vase or upside down; dry it with good airflow to reduce mould.",
    sun: "Avoid hot direct sun, which dries leaves unevenly and fades silver foliage. Bright indirect light is best indoors.",
    water: "Moderate at first, then lower as it dries. Check the stems and change cloudy water promptly.",
    pets: "ASPCA lists Eucalyptus species as toxic to dogs and cats. Keep foliage out of reach and do not let pets chew fallen leaves.",
  }),
  lisianthus: buildFlowerKnowledge({
    sourceName: "Plants & Flowers Foundation Holland — Lisianthus care",
    sourceUrl: "https://www.plantsandflowersfoundationholland.org/en/flowerguide/lisianthus",
    petSourceName: "ASPCA — Safe bouquet guidance",
    petSourceUrl: "https://www.aspca.org/news/safe-bouquet-mothers-day",
    confidence: "high",
    vaseWithFood: "About 10–14 days with flower food, clean water and regular topping up.",
    vaseWithoutFood: "About 5–7 days without food; thirsty stems and warm rooms can shorten this.",
    driedLife: "Several months if dried while fresh, though petals can become papery and colours usually soften.",
    pairing: "Pairs well with daisies, snapdragons, eucalyptus and airy lace flowers. Its soft petals suit gentle, low-pressure companions.",
    fragrance: "Usually faint to lightly sweet; many stems have little noticeable fragrance.",
    opens: "Yes. Lisianthus buds commonly continue opening indoors, so choose stems with a mix of buds and open flowers.",
    meaning: "Often associated with appreciation, gratitude, charm and a calm or enduring bond.",
    dries: "Moderately well. Hang small bunches with airflow; expect a delicate result and some petal drop.",
    sun: "Keep in bright, indirect light and away from heaters, drafts and ripening fruit. Strong sun accelerates fading and water loss.",
    water: "High; keep the vase topped up, use a clean vessel and remove lower foliage from the water.",
    pets: "A species-specific ASPCA listing was not found for Lisianthus. Do not infer safety from that absence; prevent chewing and confirm with a veterinarian for pet households.",
  }),
  "queen anne's lace": buildFlowerKnowledge({
    sourceName: "Floral Design Institute — Queen Anne’s Lace",
    sourceUrl: "https://www.floraldesigninstitute.com/blogs/resources-flower-library/queen-annes-lace",
    petSourceName: "ASPCA — False Queen Anne’s Lace",
    petSourceUrl: "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/false-queen-annes-lace",
    confidence: "medium",
    vaseWithFood: "About 3–7 days is a practical estimate with flower food and careful conditioning; harvest stage has a large effect.",
    vaseWithoutFood: "About 3–5 days without food. Change water often and remove any softening foliage.",
    driedLife: "Many months when dried as the heads begin to curl into a bird’s-nest shape; seeds may shed.",
    pairing: "Excellent with lisianthus, daisies, snapdragons and eucalyptus for air and texture. Its fine umbels need protection from heavy heads.",
    fragrance: "Usually faint or not noticeable; some stems have a green, carrot-like note.",
    opens: "Limited. Heads may expand slightly from a tight stage, but fully open lace will not reopen dramatically indoors.",
    meaning: "Often associated with sanctuary, femininity, delicacy and a hidden dark centre; symbolic meanings are traditional rather than fixed.",
    dries: "Yes, especially once the head starts to turn inward. It can be left upright in a dry vase or hung with airflow.",
    sun: "Keep cut stems out of direct sun and heat. Bright indirect light helps preserve the delicate umbels.",
    water: "Moderate to high during the first conditioning period; use clean water and recut stems if they wilt.",
    pets: "The common name covers different species. ASPCA lists false Queen Anne’s lace (Ammi majus) as toxic, so do not label an unidentified stem pet-safe.",
  }),
  snapdragon: buildFlowerKnowledge({
    sourceName: "UC Davis Postharvest Research & Extension Center — Snapdragon",
    sourceUrl: "https://postharvest.ucdavis.edu/produce-facts-sheets/snapdragon",
    petSourceName: "ASPCA — Garden Snapdragon",
    petSourceUrl: "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/garden-snapdragon",
    confidence: "high",
    vaseWithFood: "About 7–10 days with flower food, upright conditioning and cool storage.",
    vaseWithoutFood: "About 5–7 days without food; stems are more prone to wilt and buds may develop poorly.",
    driedLife: "Several months when dried carefully, but the spikes become brittle and colours fade.",
    pairing: "Adds height with daisies, lisianthus, eucalyptus and lace flowers. Keep stems upright and avoid crowding the spike.",
    fragrance: "Usually light or not noticeable, though some cultivars have a soft sweet scent.",
    opens: "Yes, gradually. Stems stored with only a few open flowers can continue opening indoors when kept upright.",
    meaning: "Commonly associated with grace, strength, graciousness and deception in older flower-language traditions.",
    dries: "Moderately well. Hang upright in a dark, dry, ventilated place and expect the lower florets to become fragile.",
    sun: "Avoid hot direct sun and heat; bright indirect light helps keep pastel colours from fading quickly.",
    water: "Moderate to high during conditioning. Keep the vase topped up, recut cleanly and remove leaves below the waterline.",
    pets: "ASPCA lists garden snapdragon (Antirrhinum majus) as non-toxic to dogs and cats, but any plant material can still cause stomach upset.",
  }),
};

function getFlowerKnowledgeSeed(flower: string): FlowerKnowledgeSection[] {
  return defaultFlowerKnowledge[normalizeFlowerName(flower)] ?? buildFlowerKnowledge({
    sourceName: "NC State Extension — Cut-flower care",
    sourceUrl: "https://gardening.ces.ncsu.edu/gardening-plants/flowers-2/selecting-caring-for-cut-flowers",
    petSourceName: "ASPCA — toxic and non-toxic plant guidance",
    petSourceUrl: "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants",
    confidence: "low",
    vaseWithFood: "Info not found for this flower; use clean water and commercial flower food while verifying the species.",
    vaseWithoutFood: "Info not found for this flower; expect a shorter life without flower food and monitor closely.",
    driedLife: "Info not found; dry a small test stem in a cool, dark, dry place before preserving the whole bunch.",
    pairing: "Compatibility depends on stem strength, conditioning and design. Test with similarly conditioned flowers.",
    fragrance: "Info not found for this flower.",
    opens: "Info not found; buds may or may not continue opening after harvest.",
    meaning: "No single universal meaning verified for this flower.",
    dries: "Info not found; trial-dry a stem before relying on it for a dried design.",
    sun: "Keep in bright, indirect light and away from hot direct sun until species-specific guidance is verified.",
    water: "Info not found; start with clean water, check daily and change it when cloudy.",
    pets: "Pet safety not verified for this flower. Keep it away from chewing pets until its botanical identity is confirmed.",
  });
}

async function readFlowerKnowledgeEntries() {
  const purchases = await db
    .select({
      flower: marketActualPurchasesTable.flower,
      marketCycle: marketActualPurchasesTable.marketCycle,
      totalStemQty: marketActualPurchasesTable.totalStemQty,
    })
    .from(marketActualPurchasesTable)
    .orderBy(asc(marketActualPurchasesTable.flower), asc(marketActualPurchasesTable.marketCycle));
  const stats = new Map<string, { purchaseCount: number; purchasedStems: number; lastPurchasedCycle: number }>();
  for (const purchase of purchases) {
    const current = stats.get(purchase.flower) ?? { purchaseCount: 0, purchasedStems: 0, lastPurchasedCycle: purchase.marketCycle };
    current.purchaseCount += 1;
    current.purchasedStems += purchase.totalStemQty ?? 0;
    current.lastPurchasedCycle = Math.max(current.lastPurchasedCycle, purchase.marketCycle);
    stats.set(purchase.flower, current);
  }
  const flowerNames = [...stats.keys()];
  for (const flower of flowerNames) {
    await db
      .insert(flowerKnowledgeEntriesTable)
      .values({ flower, sections: getFlowerKnowledgeSeed(flower) })
      .onConflictDoNothing({ target: flowerKnowledgeEntriesTable.flower });
  }
  const entries = flowerNames.length
    ? await db.select().from(flowerKnowledgeEntriesTable).where(inArray(flowerKnowledgeEntriesTable.flower, flowerNames))
    : [];
  const normalizedEntries = await Promise.all(entries.map(async (entry) => {
    const seededSections = getFlowerKnowledgeSeed(entry.flower);
    const sectionsByKey = new Map(entry.sections.map((section) => [section.key, section]));
    const sections = seededSections.map((seededSection) => {
      const current = sectionsByKey.get(seededSection.key);
      return current
        ? { ...current, subvalues: current.subvalues ?? [] }
        : seededSection;
    });
    const needsRepair = entry.sections.length !== sections.length
      || entry.sections.some((section, index) => JSON.stringify(section) !== JSON.stringify(sections[index]));
    if (!needsRepair) return { ...entry, sections };
    const [repaired] = await db
      .update(flowerKnowledgeEntriesTable)
      .set({ sections, updatedAt: new Date() })
      .where(eq(flowerKnowledgeEntriesTable.id, entry.id))
      .returning();
    return repaired ?? { ...entry, sections };
  }));
  const entriesByFlower = new Map(normalizedEntries.map((entry) => [entry.flower, entry]));
  return flowerNames
    .map((flower) => {
      const entry = entriesByFlower.get(flower);
      const purchaseStats = stats.get(flower)!;
      return entry ? { ...entry, ...purchaseStats } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.flower.localeCompare(b.flower));
}

type CanonicalPurchaseInput = {
  flower: string;
  detail: string;
  category: FlowerCategory;
  bunchSize: number;
  bunchesPurchased: number;
  pricePerBunch: number;
  supplier: string | null;
  source: "manual" | "receipt";
};

function normalizePurchaseInput(purchase: Record<string, unknown>): CanonicalPurchaseInput {
  const category = String(purchase.category) as FlowerCategory;
  if (!flowerCategories.includes(category)) {
    throw new Error("Invalid flower category.");
  }

  if ("bunchSize" in purchase) {
    return {
      flower: String(purchase.flower),
      detail: String(purchase.detail),
      category,
      bunchSize: Number(purchase.bunchSize),
      bunchesPurchased: Number(purchase.bunchesPurchased),
      pricePerBunch: Number(purchase.pricePerBunch),
      supplier: typeof purchase.supplier === "string" && purchase.supplier.trim() ? purchase.supplier.trim() : null,
      source: purchase.source === "receipt" ? "receipt" : "manual",
    };
  }

  // Keep the existing API/UI working while the later bunch-entry UI is built.
  // Legacy rows are represented as one-stem bunches so their totals remain exact.
  return {
    flower: String(purchase.flower),
    detail: String(purchase.detail),
    category,
    bunchSize: 1,
    bunchesPurchased: Number(purchase.stems),
    pricePerBunch: Number(purchase.unitCost),
    supplier: null,
    source: purchase.source === "receipt" ? "receipt" : "manual",
  };
}

function serializePurchase(purchase: typeof marketActualPurchasesTable.$inferSelect) {
  const totalStemQty = purchase.totalStemQty ?? purchase.bunchSize * purchase.bunchesPurchased;
  const costPerStem = purchase.costPerStem ?? purchase.pricePerBunch / purchase.bunchSize;
  return {
    ...purchase,
    totalStemQty,
    costPerStem,
    // Deprecated compatibility aliases for the current UI/API consumers.
    stems: totalStemQty,
    unitCost: costPerStem,
  };
}

function calculateSellThrough(
  purchases: Array<{ flower: string; stems: number }>,
  leftovers: Record<string, number>,
): SellThroughRecord[] {
  const purchasedByFlower = new Map<string, number>();
  for (const purchase of purchases) {
    purchasedByFlower.set(purchase.flower, (purchasedByFlower.get(purchase.flower) ?? 0) + purchase.stems);
  }

  const flowers = [...new Set([...purchasedByFlower.keys(), ...Object.keys(leftovers)])].sort((a, b) => a.localeCompare(b));
  return flowers.map((flower) => {
    const purchasedStems = purchasedByFlower.get(flower) ?? 0;
    const leftoverStems = leftovers[flower] ?? 0;
    const soldStems = Math.max(0, purchasedStems - leftoverStems);
    return {
      flower,
      purchasedStems,
      leftoverStems,
      soldStems,
      sellThroughPercent: purchasedStems > 0
        ? Math.round((soldStems / purchasedStems) * 1000) / 10
        : 0,
    };
  });
}

function parseCycle(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || !/^-?\d+$/.test(value)) return null;
  return Number(value);
}

function parseCycles(raw: unknown): number[] | null {
  const values = Array.isArray(raw)
    ? raw.flatMap((value) => typeof value === "string" ? value.split(",") : [])
    : typeof raw === "string" ? raw.split(",") : undefined;
  if (!values?.length || values.some((value) => !/^-?\d+$/.test(value))) return null;
  const cycles = [...new Set(values.map(Number))];
  return cycles.length ? cycles : null;
}

async function readScheduleOverrides(): Promise<ScheduleOverride[]> {
  const overrides = await db
    .select()
    .from(marketScheduleOverridesTable)
    .orderBy(marketScheduleOverridesTable.marketCycle);
  return overrides.map((override) => ({
    marketCycle: override.marketCycle,
    status: override.status,
    rescheduledDate: override.rescheduledDate,
  }));
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function ensureMarketContext(cycle: number) {
  await db.transaction(async (tx) => {
    for (const market of seededMarkets) {
      await tx.insert(marketsTable).values(market).onConflictDoNothing({ target: marketsTable.cycle });
    }

    await tx
      .insert(marketsTable)
      .values({ cycle, venue: "Redcliffe Markets", spend: 0, revenue: 0, margin: 0 })
      .onConflictDoNothing({ target: marketsTable.cycle });

    const existingItems = await tx
      .select({ id: buyItemsTable.id })
      .from(buyItemsTable)
      .where(eq(buyItemsTable.marketCycle, cycle));
    if (existingItems.length === 0) {
      await tx.insert(buyItemsTable).values(defaultBuyItems.map((item) => ({ ...item, marketCycle: cycle })));
    }

    const existingBuyListState = await tx
      .select({ marketCycle: marketBuyListStatesTable.marketCycle })
      .from(marketBuyListStatesTable)
      .where(eq(marketBuyListStatesTable.marketCycle, cycle));
    if (existingBuyListState.length === 0) {
      await tx.insert(marketBuyListStatesTable).values({ marketCycle: cycle, receiptCandidates: [] });
    }

    const existingPlan = await tx
      .select({ marketCycle: bouquetPlansTable.marketCycle })
      .from(bouquetPlansTable)
      .where(eq(bouquetPlansTable.marketCycle, cycle));
    if (existingPlan.length === 0) {
      await tx.insert(bouquetPlansTable).values({ marketCycle: cycle, selectedBand: "Market", count: 18 });
    }

    const existingClose = await tx
      .select({ marketCycle: closeMarketsTable.marketCycle })
      .from(closeMarketsTable)
      .where(eq(closeMarketsTable.marketCycle, cycle));
    if (existingClose.length === 0) {
      await tx.insert(closeMarketsTable).values({ marketCycle: cycle, counts: defaultCloseCounts, sellThrough: [], closed: false });
    }
  });
}

function formatMarketDayTodoPeriod(
  cycle: number,
  closed: boolean,
  items: Array<typeof marketDayTodoItemsTable.$inferSelect>,
  snapshot: typeof marketDayTodoSnapshotsTable.$inferSelect | undefined,
  overrides: ScheduleOverride[],
) {
  return {
    marketCycle: cycle,
    startDate: getScheduledMarketDate(cycle - 1, overrides),
    endDate: getScheduledMarketDate(cycle, overrides),
    closed,
    items: [...items]
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((item) => ({
        id: item.id,
        marketCycle: item.marketCycle,
        description: item.description,
        completed: item.completed,
        position: item.position,
      })),
    closedSnapshot: snapshot?.items ?? null,
  };
}

async function readMarketDayTodoPeriod(cycle: number, overrides: ScheduleOverride[]) {
  const [closeMarket] = await db
    .select({ closed: closeMarketsTable.closed })
    .from(closeMarketsTable)
    .where(eq(closeMarketsTable.marketCycle, cycle));
  const items = await db
    .select()
    .from(marketDayTodoItemsTable)
    .where(eq(marketDayTodoItemsTable.marketCycle, cycle))
    .orderBy(asc(marketDayTodoItemsTable.position), asc(marketDayTodoItemsTable.id));
  const [snapshot] = await db
    .select()
    .from(marketDayTodoSnapshotsTable)
    .where(eq(marketDayTodoSnapshotsTable.marketCycle, cycle));
  return formatMarketDayTodoPeriod(cycle, closeMarket?.closed ?? false, items, snapshot, overrides);
}

function getNextTodoMarketCycle(cycle: number, overrides: ScheduleOverride[]) {
  let nextCycle = cycle + 1;
  while (overrides.some((override) => (
    override.marketCycle === nextCycle
    && (override.status === "skipped" || override.status === "rescheduled")
  ))) {
    nextCycle += 1;
  }
  return nextCycle;
}

async function captureClosedMarketTodoAndGenerateNext(cycle: number, nextCycle: number, tx: any) {
  const [existingSnapshot] = await tx
    .select()
    .from(marketDayTodoSnapshotsTable)
    .where(eq(marketDayTodoSnapshotsTable.marketCycle, cycle));
  if (!existingSnapshot) {
    const previousItems = await tx
      .select()
      .from(marketDayTodoItemsTable)
      .where(eq(marketDayTodoItemsTable.marketCycle, cycle))
      .orderBy(asc(marketDayTodoItemsTable.position), asc(marketDayTodoItemsTable.id));
    await tx.insert(marketDayTodoSnapshotsTable).values({
      marketCycle: cycle,
      items: previousItems.map((item: typeof marketDayTodoItemsTable.$inferSelect) => ({
        description: item.description,
        completed: item.completed,
        position: item.position,
      })),
    });
    const nextItems = await tx
      .select({ id: marketDayTodoItemsTable.id })
      .from(marketDayTodoItemsTable)
      .where(eq(marketDayTodoItemsTable.marketCycle, nextCycle));
    if (nextItems.length === 0 && previousItems.length > 0) {
      await tx.insert(marketDayTodoItemsTable).values(previousItems.map((item: typeof marketDayTodoItemsTable.$inferSelect, index: number) => ({
        marketCycle: nextCycle,
        description: item.description,
        completed: false,
        position: index,
      })));
    }
  }
}

async function recalculateMarketTotals(cycle: number, tx: any, previousCostTotal?: number) {
  const [market] = await tx.select().from(marketsTable).where(eq(marketsTable.cycle, cycle));
  if (!market) return null;
  const purchases = await tx
    .select({
      totalStemQty: marketActualPurchasesTable.totalStemQty,
      costPerStem: marketActualPurchasesTable.costPerStem,
    })
    .from(marketActualPurchasesTable)
    .where(eq(marketActualPurchasesTable.marketCycle, cycle));
  const costs = await tx
    .select({ amount: marketCostsTable.amount })
    .from(marketCostsTable)
    .where(eq(marketCostsTable.marketCycle, cycle));
  const nonFlowerSpend = costs.reduce((sum: number, cost: { amount: number }) => sum + cost.amount, 0);
  const flowerSpend = purchases.reduce(
    (sum: number, purchase: { totalStemQty: number | null; costPerStem: number | null }) =>
      sum + (purchase.totalStemQty ?? 0) * (purchase.costPerStem ?? 0),
    0,
  );
  const baseSpend = purchases.length > 0
    ? flowerSpend
    : market.spend - (previousCostTotal ?? nonFlowerSpend);
  const spend = Math.max(0, baseSpend) + nonFlowerSpend;
  const margin = market.revenue > 0
    ? Math.round(((market.revenue - spend) / market.revenue) * 1000) / 10
    : 0;
  const [updated] = await tx
    .update(marketsTable)
    .set({ spend, margin })
    .where(eq(marketsTable.cycle, cycle))
    .returning();
  return updated;
}

async function readMarketContext(cycle: number) {
  await ensureMarketContext(cycle);
  const overrides = await readScheduleOverrides();
  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.cycle, cycle));
  const buyItems = await db.select().from(buyItemsTable).where(eq(buyItemsTable.marketCycle, cycle)).orderBy(buyItemsTable.id);
  const buyList = await readBuyListState(cycle);
  const actualPurchaseRows = await db.select().from(marketActualPurchasesTable).where(eq(marketActualPurchasesTable.marketCycle, cycle)).orderBy(marketActualPurchasesTable.id);
  const actualPurchases = actualPurchaseRows.map(serializePurchase);
  const costs = await db.select().from(marketCostsTable).where(eq(marketCostsTable.marketCycle, cycle)).orderBy(marketCostsTable.id);
  const [bouquetPlan] = await db.select().from(bouquetPlansTable).where(eq(bouquetPlansTable.marketCycle, cycle));
  const [closeMarket] = await db.select().from(closeMarketsTable).where(eq(closeMarketsTable.marketCycle, cycle));
  const sellThrough = calculateSellThrough(
    actualPurchases.map((purchase) => ({ flower: purchase.flower, stems: purchase.totalStemQty })),
    closeMarket.counts,
  );
  const reportedPurchases = await db
    .select({
      marketCycle: marketActualPurchasesTable.marketCycle,
      flower: marketActualPurchasesTable.flower,
      pricePerBunch: marketActualPurchasesTable.pricePerBunch,
      costPerStem: marketActualPurchasesTable.costPerStem,
    })
    .from(marketActualPurchasesTable)
    .innerJoin(
      marketBuyListStatesTable,
      eq(marketBuyListStatesTable.marketCycle, marketActualPurchasesTable.marketCycle),
    )
    .where(
      and(
        eq(marketBuyListStatesTable.reported, true),
      ),
    );
  const latestReportedPrice = new Map<string, { marketCycle: number; pricePerBunch: number }>();
  for (const purchase of reportedPurchases) {
    if (purchase.marketCycle >= cycle || isSkippedMarketCycle(purchase.marketCycle, overrides)) continue;
    const current = latestReportedPrice.get(purchase.flower);
    if (!current || purchase.marketCycle > current.marketCycle) {
      latestReportedPrice.set(purchase.flower, purchase);
    }
  }
  const estimatedBuyItems = buyItems.map((item) => {
    const latest = latestReportedPrice.get(item.flower);
    return {
      ...item,
      ...(latest ? { lastPrice: latest.pricePerBunch } : {}),
      priceSource: latest
        ? {
            kind: "reported" as const,
            marketCycle: latest.marketCycle,
            date: formatScheduledMarketDate(latest.marketCycle, overrides),
          }
        : {
            kind: "fallback" as const,
            marketCycle: null,
            date: null,
          },
    };
  });

  return {
    cycle,
    date: getScheduledMarketDate(cycle, overrides),
    venue: market.venue,
    spend: market.spend,
    revenue: market.revenue,
    margin: market.margin,
    buyItems: estimatedBuyItems,
    buyList,
    actualPurchases,
    costs,
    bouquetPlan,
    closeMarket: { ...closeMarket, sellThrough },
  };
}

function serializeNonFlowerPurchase(
  purchase: typeof nonFlowerPurchasesTable.$inferSelect,
  allocations: Array<typeof nonFlowerPurchaseAllocationsTable.$inferSelect>,
) {
  const compatibilityAllocations = allocations.length > 0
    ? allocations
    : purchase.productType
      ? [{
        id: 0,
        purchaseId: purchase.id,
        productType: purchase.productType,
        allocationQuantity: purchase.quantity,
        allocationPercentage: null,
      }]
      : [];
  return {
    ...purchase,
    costPerPiece: purchase.totalPrice / purchase.quantity,
    allocations: compatibilityAllocations,
  };
}

function formatNonFlowerPeriod(
  cycle: number,
  purchases: Array<typeof nonFlowerPurchasesTable.$inferSelect>,
  allocationsByPurchase: Map<number, Array<typeof nonFlowerPurchaseAllocationsTable.$inferSelect>>,
  importsByCycle: Map<number, Array<ReturnType<typeof serializeNonFlowerBankImport>>>,
  overrides: ScheduleOverride[],
) {
  const endDate = getScheduledMarketDate(cycle, overrides);
  const startDate = getScheduledMarketDate(cycle - 1, overrides);
  return {
    marketCycle: cycle,
    startDate,
    endDate,
    purchases: purchases.map((purchase) => serializeNonFlowerPurchase(purchase, allocationsByPurchase.get(purchase.id) ?? [])),
    imports: importsByCycle.get(cycle) ?? [],
  };
}

function serializeNonFlowerBankImport(
  imported: typeof nonFlowerBankImportsTable.$inferSelect,
  lines: Array<typeof nonFlowerBankImportLinesTable.$inferSelect>,
  detailsByLine: Map<number, Array<typeof nonFlowerBankImportDetailsTable.$inferSelect>>,
) {
  return {
    id: imported.id,
    marketCycle: imported.marketCycle,
    fileName: imported.fileName,
    fileFormat: imported.fileFormat,
    importedAt: imported.importedAt.toISOString(),
    lines: lines
      .filter((line) => line.importId === imported.id)
      .map((line) => {
        const details = detailsByLine.get(line.id) ?? [];
        const detailsTotal = details.reduce((sum, detail) => sum + detail.totalPrice, 0);
        return {
          id: line.id,
          sourceLineNumber: line.sourceLineNumber,
          transactionDate: line.transactionDate,
          merchant: line.merchant,
          description: line.description,
          amount: line.amount,
          reference: line.reference,
          details: details.map((detail) => ({
            id: detail.id,
            lineId: detail.lineId,
            category: detail.category,
            description: detail.description,
            totalPrice: detail.totalPrice,
            quantity: detail.quantity,
            unitPrice: detail.quantity > 0 ? detail.totalPrice / detail.quantity : 0,
          })),
          detailsTotal,
          reconciliationDifference: line.amount - detailsTotal,
          isReconciled: Math.abs(line.amount - detailsTotal) <= 0.005,
        };
      }),
  };
}

async function readFormattedNonFlowerBankImports(cycles: number[]) {
  if (cycles.length === 0) return new Map<number, Array<ReturnType<typeof serializeNonFlowerBankImport>>>();
  const imports = await db
    .select()
    .from(nonFlowerBankImportsTable)
    .where(inArray(nonFlowerBankImportsTable.marketCycle, cycles))
    .orderBy(asc(nonFlowerBankImportsTable.marketCycle), asc(nonFlowerBankImportsTable.id));
  const importIds = imports.map((imported) => imported.id);
  const lines = importIds.length
    ? await db
      .select()
      .from(nonFlowerBankImportLinesTable)
      .where(inArray(nonFlowerBankImportLinesTable.importId, importIds))
      .orderBy(asc(nonFlowerBankImportLinesTable.id))
    : [];
  const lineIds = lines.map((line) => line.id);
  const details = lineIds.length
    ? await db
      .select()
      .from(nonFlowerBankImportDetailsTable)
      .where(inArray(nonFlowerBankImportDetailsTable.lineId, lineIds))
      .orderBy(asc(nonFlowerBankImportDetailsTable.id))
    : [];
  const detailsByLine = new Map<number, Array<typeof nonFlowerBankImportDetailsTable.$inferSelect>>();
  for (const detail of details) {
    const current = detailsByLine.get(detail.lineId) ?? [];
    current.push(detail);
    detailsByLine.set(detail.lineId, current);
  }
  const importsByCycle = new Map<number, Array<ReturnType<typeof serializeNonFlowerBankImport>>>();
  for (const imported of imports) {
    const current = importsByCycle.get(imported.marketCycle) ?? [];
    current.push(serializeNonFlowerBankImport(imported, lines, detailsByLine));
    importsByCycle.set(imported.marketCycle, current);
  }
  return importsByCycle;
}

async function readFormattedNonFlowerBankImport(importId: number) {
  const imported = (await db.select().from(nonFlowerBankImportsTable).where(eq(nonFlowerBankImportsTable.id, importId)))[0];
  if (!imported) return null;
  const lines = await db
    .select()
    .from(nonFlowerBankImportLinesTable)
    .where(eq(nonFlowerBankImportLinesTable.importId, importId))
    .orderBy(asc(nonFlowerBankImportLinesTable.id));
  const lineIds = lines.map((line) => line.id);
  const details = lineIds.length
    ? await db
      .select()
      .from(nonFlowerBankImportDetailsTable)
      .where(inArray(nonFlowerBankImportDetailsTable.lineId, lineIds))
      .orderBy(asc(nonFlowerBankImportDetailsTable.id))
    : [];
  const detailsByLine = new Map<number, Array<typeof nonFlowerBankImportDetailsTable.$inferSelect>>();
  for (const detail of details) {
    const current = detailsByLine.get(detail.lineId) ?? [];
    current.push(detail);
    detailsByLine.set(detail.lineId, current);
  }
  return serializeNonFlowerBankImport(imported, lines, detailsByLine);
}

async function readBuyListState(cycle: number) {
  const [buyList] = await db.select().from(marketBuyListStatesTable).where(eq(marketBuyListStatesTable.marketCycle, cycle));
  const editLog = await db
    .select()
    .from(marketBuyListEditLogsTable)
    .where(eq(marketBuyListEditLogsTable.marketCycle, cycle))
    .orderBy(marketBuyListEditLogsTable.createdAt, marketBuyListEditLogsTable.id);
  return {
    ...buyList,
    editLog: editLog.map((entry) => ({
      id: entry.id,
      marketCycle: entry.marketCycle,
      action: entry.action,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

router.get("/markets/flower-care", async (_req, res): Promise<void> => {
  res.json(ListFlowerCareResponse.parse(await readFlowerCareEntries()));
});

router.put("/markets/flower-care/:flower", async (req, res): Promise<void> => {
  const params = UpdateFlowerCareParams.safeParse(req.params);
  const body = UpdateFlowerCareBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid flower care entry." });
    return;
  }
  const flower = params.data.flower.trim();
  const instructions = body.data.instructions.trim();
  if (!flower || !instructions || instructions.length > 5000) {
    res.status(400).json({ error: "Flower care instructions must be between 1 and 5000 characters." });
    return;
  }
  const [updated] = await db
    .update(flowerCareEntriesTable)
    .set({ instructions, sourceStatus: "manually-edited", updatedAt: new Date() })
    .where(eq(flowerCareEntriesTable.flower, flower))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Flower care entry not found in purchase history." });
    return;
  }
  const entries = await readFlowerCareEntries();
  const saved = entries.find((entry) => entry.flower === flower);
  res.json(UpdateFlowerCareResponse.parse(saved));
});

const flowerKnowledgeKeys = new Set([
  "vase-and-dried-life",
  "pairing-compatibility",
  "fragrance",
  "opens-indoors",
  "symbolic-meaning",
  "dries-well",
  "sun-sensitivity",
  "water-consumption",
  "pet-safety",
]);

function isValidKnowledgeSections(value: unknown): value is FlowerKnowledgeSection[] {
  if (!Array.isArray(value) || value.length !== 9) return false;
  const keys = new Set<string>();
  return value.every((section) => {
    if (!section || typeof section !== "object") return false;
    const candidate = section as Record<string, unknown>;
    if (typeof candidate.key !== "string" || !flowerKnowledgeKeys.has(candidate.key) || keys.has(candidate.key)) return false;
    if (typeof candidate.value !== "string" || !candidate.value.trim() || candidate.value.length > 2000) return false;
    if (!Array.isArray(candidate.subvalues) || candidate.subvalues.some((subvalue) => {
      if (!subvalue || typeof subvalue !== "object") return true;
      const subvalueRecord = subvalue as Record<string, unknown>;
      return typeof subvalueRecord.label !== "string"
        || typeof subvalueRecord.value !== "string"
        || !subvalueRecord.value.trim()
        || subvalueRecord.value.length > 2000;
    })) return false;
    keys.add(candidate.key);
    return true;
  }) && keys.size === 9;
}

router.get("/markets/flower-knowledge", async (_req, res): Promise<void> => {
  res.json(ListFlowerKnowledgeResponse.parse(await readFlowerKnowledgeEntries()));
});

router.put("/markets/flower-knowledge/:flower", async (req, res): Promise<void> => {
  const params = UpdateFlowerKnowledgeParams.safeParse(req.params);
  const body = UpdateFlowerKnowledgeBody.safeParse(req.body);
  if (!params.success || !body.success || !isValidKnowledgeSections(body.data.sections)) {
    res.status(400).json({ error: "Flower knowledge must contain nine non-empty sections." });
    return;
  }
  const flower = params.data.flower.trim();
  await readFlowerKnowledgeEntries();
  const [existing] = await db
    .select()
    .from(flowerKnowledgeEntriesTable)
    .where(eq(flowerKnowledgeEntriesTable.flower, flower));
  if (!existing) {
    res.status(404).json({ error: "Flower knowledge entry not found in purchase history." });
    return;
  }
  const submittedByKey = new Map(body.data.sections.map((section) => [section.key, section]));
  const sections = existing.sections.map((section) => {
    const submitted = submittedByKey.get(section.key);
    return {
      ...section,
      value: submitted?.value.trim() ?? section.value,
      subvalues: submitted?.subvalues?.map((subvalue) => ({ label: subvalue.label, value: subvalue.value.trim() })),
      sourceStatus: "manually-edited" as const,
    };
  });
  const [updated] = await db
    .update(flowerKnowledgeEntriesTable)
    .set({ sections, sourceStatus: "manually-edited", updatedAt: new Date() })
    .where(eq(flowerKnowledgeEntriesTable.flower, flower))
    .returning();
  const entries = await readFlowerKnowledgeEntries();
  const saved = entries.find((entry) => entry.flower === flower) ?? updated;
  res.json(UpdateFlowerKnowledgeResponse.parse(saved));
});

router.get("/markets/non-flower-purchases", async (_req, res): Promise<void> => {
  const overrides = await readScheduleOverrides();
  const markets = await db
    .select({ cycle: marketsTable.cycle })
    .from(marketsTable)
    .orderBy(asc(marketsTable.cycle));
  const cycles = markets.map((market) => market.cycle);
  const purchases = cycles.length
    ? await db
      .select()
      .from(nonFlowerPurchasesTable)
      .where(inArray(nonFlowerPurchasesTable.marketCycle, cycles))
      .orderBy(asc(nonFlowerPurchasesTable.marketCycle), asc(nonFlowerPurchasesTable.id))
    : [];
  const purchasesByCycle = new Map<number, Array<typeof nonFlowerPurchasesTable.$inferSelect>>();
  for (const purchase of purchases) {
    const current = purchasesByCycle.get(purchase.marketCycle) ?? [];
    current.push(purchase);
    purchasesByCycle.set(purchase.marketCycle, current);
  }
  const purchaseIds = purchases.map((purchase) => purchase.id);
  const allocations = purchaseIds.length
    ? await db
      .select()
      .from(nonFlowerPurchaseAllocationsTable)
      .where(inArray(nonFlowerPurchaseAllocationsTable.purchaseId, purchaseIds))
      .orderBy(asc(nonFlowerPurchaseAllocationsTable.id))
    : [];
  const allocationsByPurchase = new Map<number, Array<typeof nonFlowerPurchaseAllocationsTable.$inferSelect>>();
  for (const allocation of allocations) {
    const current = allocationsByPurchase.get(allocation.purchaseId) ?? [];
    current.push(allocation);
    allocationsByPurchase.set(allocation.purchaseId, current);
  }
  const importsByCycle = await readFormattedNonFlowerBankImports(cycles);
  res.json(ListNonFlowerPurchasesResponse.parse(
    cycles.map((cycle) => formatNonFlowerPeriod(cycle, purchasesByCycle.get(cycle) ?? [], allocationsByPurchase, importsByCycle, overrides)),
  ));
});

router.put("/markets/non-flower-purchases/:cycle", async (req, res): Promise<void> => {
  const params = ReplaceNonFlowerPurchasesParams.safeParse(req.params);
  const body = ReplaceNonFlowerPurchasesBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or non-flower purchase data." });
    return;
  }
  const normalizedPurchases = body.data.purchases.map((purchase) => {
    const allocations = purchase.allocations ?? (purchase.productType?.trim()
      ? [{ productType: purchase.productType.trim(), allocationQuantity: purchase.quantity, allocationPercentage: null }]
      : []);
    return {
      ...purchase,
      category: purchase.category.trim(),
      description: purchase.description.trim(),
      allocations: allocations.map((allocation) => ({
        productType: allocation.productType.trim(),
        allocationQuantity: allocation.allocationQuantity,
        allocationPercentage: allocation.allocationPercentage,
      })),
    };
  });
  if (normalizedPurchases.some((purchase) =>
    !purchase.category
    || !purchase.description
    || !Number.isFinite(purchase.totalPrice)
    || purchase.totalPrice < 0
    || !Number.isInteger(purchase.quantity)
    || purchase.quantity <= 0
    || purchase.allocations.some((allocation) =>
      !allocation.productType
      || (allocation.allocationQuantity !== null && allocation.allocationPercentage !== null)
      || (allocation.allocationQuantity === null && allocation.allocationPercentage === null)
      || (allocation.allocationQuantity !== null && (!Number.isInteger(allocation.allocationQuantity) || allocation.allocationQuantity <= 0 || allocation.allocationQuantity > purchase.quantity))
      || (allocation.allocationPercentage !== null && (!Number.isFinite(allocation.allocationPercentage) || allocation.allocationPercentage <= 0 || allocation.allocationPercentage > 100))
    )
    || purchase.allocations.reduce((sum, allocation) =>
      sum + (allocation.allocationQuantity !== null
        ? (allocation.allocationQuantity / purchase.quantity) * 100
        : allocation.allocationPercentage ?? 0), 0) > 100.000001
  )) {
    res.status(400).json({ error: "Each purchase needs a category, description, non-negative total price, and positive item quantity." });
    return;
  }

  const overrides = await readScheduleOverrides();
  await ensureMarketContext(params.data.cycle);
  const saved = await db.transaction(async (tx) => {
    await tx.delete(nonFlowerPurchasesTable).where(eq(nonFlowerPurchasesTable.marketCycle, params.data.cycle));
    for (const purchase of normalizedPurchases) {
      const [created] = await tx.insert(nonFlowerPurchasesTable).values({
        marketCycle: params.data.cycle,
        category: purchase.category,
        description: purchase.description,
        totalPrice: purchase.totalPrice,
        quantity: purchase.quantity,
        productType: purchase.allocations.length === 1
          && purchase.allocations[0].allocationQuantity === purchase.quantity
          && purchase.allocations[0].allocationPercentage === null
          ? purchase.allocations[0].productType
          : null,
      }).returning();
      if (purchase.allocations.length > 0) {
        await tx.insert(nonFlowerPurchaseAllocationsTable).values(purchase.allocations.map((allocation) => ({
          purchaseId: created.id,
          productType: allocation.productType,
          allocationQuantity: allocation.allocationQuantity,
          allocationPercentage: allocation.allocationPercentage,
        })));
      }
    }
    const purchases = await tx
      .select()
      .from(nonFlowerPurchasesTable)
      .where(eq(nonFlowerPurchasesTable.marketCycle, params.data.cycle))
      .orderBy(asc(nonFlowerPurchasesTable.id));
    const purchaseIds = purchases.map((purchase) => purchase.id);
    const allocations = purchaseIds.length
      ? await tx
        .select()
        .from(nonFlowerPurchaseAllocationsTable)
        .where(inArray(nonFlowerPurchaseAllocationsTable.purchaseId, purchaseIds))
        .orderBy(asc(nonFlowerPurchaseAllocationsTable.id))
      : [];
    const allocationsByPurchase = new Map<number, Array<typeof nonFlowerPurchaseAllocationsTable.$inferSelect>>();
    for (const allocation of allocations) {
      const current = allocationsByPurchase.get(allocation.purchaseId) ?? [];
      current.push(allocation);
      allocationsByPurchase.set(allocation.purchaseId, current);
    }
    return formatNonFlowerPeriod(params.data.cycle, purchases, allocationsByPurchase, new Map(), overrides);
  });
  const importsByCycle = await readFormattedNonFlowerBankImports([params.data.cycle]);
  res.json(ReplaceNonFlowerPurchasesResponse.parse({
    ...saved,
    imports: importsByCycle.get(params.data.cycle) ?? [],
  }));
});

router.post("/markets/non-flower-purchases/:cycle/imports", async (req, res): Promise<void> => {
  const params = ImportNonFlowerBankFileParams.safeParse(req.params);
  const body = ImportNonFlowerBankFileBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or bank import data." });
    return;
  }
  const fileName = body.data.fileName.trim();
  const fileFingerprint = body.data.fileFingerprint.trim().toLowerCase();
  const lines = body.data.lines.map((line) => ({
    ...line,
    transactionDate: line.transactionDate?.trim() || null,
    merchant: line.merchant.trim(),
    description: line.description.trim(),
    reference: line.reference?.trim() || null,
  }));
  if (
    !fileName
    || !/^[a-f0-9]{64}$/.test(fileFingerprint)
    || lines.some((line) =>
      line.sourceLineNumber <= 0
      || !Number.isInteger(line.sourceLineNumber)
      || !line.merchant
      || !line.description
      || !Number.isFinite(line.amount)
      || line.amount < 0)
  ) {
    res.status(400).json({ error: "Each bank line needs a merchant, description, non-negative amount, and positive source line number." });
    return;
  }

  await ensureMarketContext(params.data.cycle);
  const existing = (await db
    .select()
    .from(nonFlowerBankImportsTable)
    .where(and(
      eq(nonFlowerBankImportsTable.marketCycle, params.data.cycle),
      eq(nonFlowerBankImportsTable.fileFingerprint, fileFingerprint),
    )))[0];
  if (existing) {
    const existingImport = await readFormattedNonFlowerBankImport(existing.id);
    if (existingImport) {
      res.json(ImportNonFlowerBankFileResponse.parse({ status: "duplicate", import: existingImport }));
      return;
    }
  }

  const importedId = await db.transaction(async (tx) => {
    const [imported] = await tx.insert(nonFlowerBankImportsTable).values({
      marketCycle: params.data.cycle,
      fileName,
      fileFormat: body.data.fileFormat,
      fileFingerprint,
    }).returning({ id: nonFlowerBankImportsTable.id });
    await tx.insert(nonFlowerBankImportLinesTable).values(lines.map((line) => ({
      importId: imported.id,
      sourceLineNumber: line.sourceLineNumber,
      transactionDate: line.transactionDate,
      merchant: line.merchant,
      description: line.description,
      amount: line.amount,
      reference: line.reference,
    })));
    return imported.id;
  });
  const saved = await readFormattedNonFlowerBankImport(importedId);
  if (!saved) {
    res.status(500).json({ error: "The bank import could not be read after saving." });
    return;
  }
  res.json(ImportNonFlowerBankFileResponse.parse({ status: "imported", import: saved }));
});

router.put("/markets/non-flower-imports/:importId", async (req, res): Promise<void> => {
  const params = ReplaceNonFlowerBankImportDetailsParams.safeParse(req.params);
  const body = ReplaceNonFlowerBankImportDetailsBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.importId)) {
    res.status(400).json({ error: "Invalid bank import detail data." });
    return;
  }
  const imported = (await db
    .select()
    .from(nonFlowerBankImportsTable)
    .where(eq(nonFlowerBankImportsTable.id, params.data.importId)))[0];
  if (!imported) {
    res.status(404).json({ error: "Bank import not found." });
    return;
  }
  const importLines = await db
    .select()
    .from(nonFlowerBankImportLinesTable)
    .where(eq(nonFlowerBankImportLinesTable.importId, imported.id));
  const lineIds = new Set(importLines.map((line) => line.id));
  if (body.data.lines.some((line) =>
    !lineIds.has(line.lineId)
    || line.details.some((detail) =>
      !detail.category.trim()
      || !detail.description.trim()
      || !Number.isFinite(detail.totalPrice)
      || detail.totalPrice < 0
      || !Number.isInteger(detail.quantity)
      || detail.quantity <= 0)
  )) {
    res.status(400).json({ error: "Each detail needs a category, description, non-negative total price, and positive whole-number quantity." });
    return;
  }

  await db.transaction(async (tx) => {
    const requestedLineIds = body.data.lines.map((line) => line.lineId);
    if (requestedLineIds.length > 0) {
      await tx.delete(nonFlowerBankImportDetailsTable).where(inArray(nonFlowerBankImportDetailsTable.lineId, requestedLineIds));
      const details = body.data.lines.flatMap((line) => line.details.map((detail) => ({
        lineId: line.lineId,
        category: detail.category.trim(),
        description: detail.description.trim(),
        totalPrice: detail.totalPrice,
        quantity: detail.quantity,
      })));
      if (details.length > 0) {
        await tx.insert(nonFlowerBankImportDetailsTable).values(details);
      }
    }
  });
  const saved = await readFormattedNonFlowerBankImport(imported.id);
  if (!saved) {
    res.status(500).json({ error: "The bank import could not be read after saving." });
    return;
  }
  res.json(ReplaceNonFlowerBankImportDetailsResponse.parse(saved));
});

router.get("/markets/schedule/overrides", async (_req, res): Promise<void> => {
  res.json(ListMarketScheduleOverridesResponse.parse(await readScheduleOverrides()));
});

router.put("/markets/schedule/overrides/:cycle", async (req, res): Promise<void> => {
  const params = UpsertMarketScheduleOverrideParams.safeParse(req.params);
  const body = UpsertMarketScheduleOverrideBody.safeParse(req.body);
  const rescheduledDate = body.success && body.data.status === "rescheduled"
    ? body.data.rescheduledDate
    : null;
  if (
    !params.success ||
    !Number.isInteger(params.data.cycle) ||
    !body.success ||
    (body.data.status === "rescheduled" && (!rescheduledDate || !isValidIsoDate(rescheduledDate)))
  ) {
    res.status(400).json({ error: "Provide a valid market cycle and rescheduled date." });
    return;
  }

  const [override] = await db
    .insert(marketScheduleOverridesTable)
    .values({
      marketCycle: params.data.cycle,
      status: body.data.status,
      rescheduledDate,
    })
    .onConflictDoUpdate({
      target: marketScheduleOverridesTable.marketCycle,
      set: { status: body.data.status, rescheduledDate },
    })
    .returning();
  res.json(UpsertMarketScheduleOverrideResponse.parse(override));
});

router.delete("/markets/schedule/overrides/:cycle", async (req, res): Promise<void> => {
  const params = DeleteMarketScheduleOverrideParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Market cycle must be an integer." });
    return;
  }
  await db.delete(marketScheduleOverridesTable).where(eq(marketScheduleOverridesTable.marketCycle, params.data.cycle));
  res.status(204).send();
});

router.get("/markets/flower-prices", async (_req, res): Promise<void> => {
  const overrides = await readScheduleOverrides();
  const reportedPurchases = await db
    .select({
      marketCycle: marketActualPurchasesTable.marketCycle,
      flower: marketActualPurchasesTable.flower,
      category: marketActualPurchasesTable.category,
      pricePerBunch: marketActualPurchasesTable.pricePerBunch,
      costPerStem: marketActualPurchasesTable.costPerStem,
    })
    .from(marketActualPurchasesTable)
    .innerJoin(
      marketBuyListStatesTable,
      eq(marketBuyListStatesTable.marketCycle, marketActualPurchasesTable.marketCycle),
    )
    .where(eq(marketBuyListStatesTable.reported, true));

  const byFlower = new Map<string, {
    flower: string;
    category: string;
    history: Array<{ marketCycle: number; date: string; pricePerBunch: number; costPerStem: number; unitCost: number }>;
  }>();
  for (const purchase of reportedPurchases.filter((purchase) => !isSkippedMarketCycle(purchase.marketCycle, overrides))) {
    const existing = byFlower.get(purchase.flower) ?? {
      flower: purchase.flower,
      category: purchase.category,
      history: [],
    };
    existing.history.push({
      marketCycle: purchase.marketCycle,
      date: formatScheduledMarketDate(purchase.marketCycle, overrides),
      pricePerBunch: purchase.pricePerBunch,
      costPerStem: purchase.costPerStem ?? 0,
      unitCost: purchase.pricePerBunch,
    });
    byFlower.set(purchase.flower, existing);
  }

  const history = Array.from(byFlower.values()).map((entry) => {
    entry.history.sort((a, b) => b.marketCycle - a.marketCycle);
    const [latest, previous] = entry.history;
    const change = previous ? latest.pricePerBunch - previous.pricePerBunch : null;
    const changePercent = previous && previous.pricePerBunch !== 0
      ? (change! / previous.pricePerBunch) * 100
      : null;
    return {
      ...entry,
      latest,
      previous: previous ?? null,
      change,
      changePercent,
    };
  }).sort((a, b) => a.flower.localeCompare(b.flower));

  res.json(ListFlowerPricesResponse.parse(history));
});

router.get("/markets/flower-price-tracker", async (_req, res): Promise<void> => {
  const overrides = await readScheduleOverrides();
  const [rows, closeRecords] = await Promise.all([
    db
      .select({
        id: marketActualPurchasesTable.id,
        marketCycle: marketActualPurchasesTable.marketCycle,
        flower: marketActualPurchasesTable.flower,
        supplier: marketActualPurchasesTable.supplier,
        bunchSize: marketActualPurchasesTable.bunchSize,
        bunchesPurchased: marketActualPurchasesTable.bunchesPurchased,
        pricePerBunch: marketActualPurchasesTable.pricePerBunch,
        totalStemQty: marketActualPurchasesTable.totalStemQty,
        costPerStem: marketActualPurchasesTable.costPerStem,
        venue: marketsTable.venue,
      })
      .from(marketActualPurchasesTable)
      .innerJoin(
        marketBuyListStatesTable,
        eq(marketBuyListStatesTable.marketCycle, marketActualPurchasesTable.marketCycle),
      )
      .innerJoin(marketsTable, eq(marketsTable.cycle, marketActualPurchasesTable.marketCycle))
      .where(eq(marketBuyListStatesTable.reported, true))
      .orderBy(marketActualPurchasesTable.marketCycle, marketActualPurchasesTable.id),
    db.select().from(closeMarketsTable),
  ]);
  const closeByCycle = new Map(
    closeRecords.filter((record) => record.closed).map((record) => [record.marketCycle, record]),
  );

  const grouped = new Map<number, {
    marketCycle: number;
    date: string;
    venue: string;
    notes: string | null;
    lineItems: Array<{
      id: number;
      marketCycle: number;
      flower: string;
      supplier: string | null;
      bunchSize: number;
      bunchesPurchased: number;
      pricePerBunch: number;
      totalStemQty: number;
      costPerStem: number;
      sellThrough: SellThroughRecord | null;
    }>;
  }>();

  for (const row of rows) {
    if (isSkippedMarketCycle(row.marketCycle, overrides)) continue;
    const report = grouped.get(row.marketCycle) ?? {
      marketCycle: row.marketCycle,
      date: formatScheduledMarketDate(row.marketCycle, overrides),
      venue: row.venue,
      notes: closeByCycle.get(row.marketCycle)?.notes ?? null,
      lineItems: [],
    };
    report.lineItems.push({
      id: row.id,
      marketCycle: row.marketCycle,
      flower: row.flower,
      supplier: row.supplier,
      bunchSize: row.bunchSize,
      bunchesPurchased: row.bunchesPurchased,
      pricePerBunch: row.pricePerBunch,
      totalStemQty: row.totalStemQty ?? row.bunchSize * row.bunchesPurchased,
      costPerStem: row.costPerStem ?? row.pricePerBunch / row.bunchSize,
      sellThrough: closeByCycle.get(row.marketCycle)?.sellThrough.find((record) => record.flower === row.flower) ?? null,
    });
    grouped.set(row.marketCycle, report);
  }

  res.json(ListFlowerPriceTrackerResponse.parse(
    [...grouped.values()].sort((a, b) => b.marketCycle - a.marketCycle),
  ));
});

router.get("/markets/flower-price-dashboard", async (_req, res): Promise<void> => {
  const overrides = await readScheduleOverrides();
  const [reportedRows, backfillRows, closeRecords] = await Promise.all([
    db
      .select({
        id: marketActualPurchasesTable.id,
        marketCycle: marketActualPurchasesTable.marketCycle,
        flower: marketActualPurchasesTable.flower,
        category: marketActualPurchasesTable.category,
        supplier: marketActualPurchasesTable.supplier,
        bunchSize: marketActualPurchasesTable.bunchSize,
        bunchesPurchased: marketActualPurchasesTable.bunchesPurchased,
        pricePerBunch: marketActualPurchasesTable.pricePerBunch,
        totalStemQty: marketActualPurchasesTable.totalStemQty,
        costPerStem: marketActualPurchasesTable.costPerStem,
      })
      .from(marketActualPurchasesTable)
      .innerJoin(
        marketBuyListStatesTable,
        eq(marketBuyListStatesTable.marketCycle, marketActualPurchasesTable.marketCycle),
      )
      .where(eq(marketBuyListStatesTable.reported, true))
      .orderBy(asc(marketActualPurchasesTable.marketCycle), asc(marketActualPurchasesTable.id)),
    db
      .select({
        id: flowerPriceBackfillsTable.id,
        purchaseDate: flowerPriceBackfillsTable.purchaseDate,
        flower: flowerPriceBackfillsTable.flower,
        category: flowerPriceBackfillsTable.category,
        supplier: flowerPriceBackfillsTable.supplier,
        bunchSize: flowerPriceBackfillsTable.bunchSize,
        bunchesPurchased: flowerPriceBackfillsTable.bunchesPurchased,
        pricePerBunch: flowerPriceBackfillsTable.pricePerBunch,
        totalStemQty: flowerPriceBackfillsTable.totalStemQty,
        costPerStem: flowerPriceBackfillsTable.costPerStem,
      })
      .from(flowerPriceBackfillsTable)
      .orderBy(asc(flowerPriceBackfillsTable.purchaseDate), asc(flowerPriceBackfillsTable.id)),
    db.select().from(closeMarketsTable),
  ]);
  const closeByCycle = new Map(
    closeRecords.filter((record) => record.closed).map((record) => [record.marketCycle, record]),
  );

  const observations = [
    ...reportedRows
      .filter((row) => !isSkippedMarketCycle(row.marketCycle, overrides))
      .map((row) => {
        const closeRecord = closeByCycle.get(row.marketCycle);
        return {
          id: row.id,
          purchaseDate: getScheduledMarketDate(row.marketCycle, overrides),
          flower: row.flower,
          category: row.category,
          supplier: row.supplier,
          bunchSize: row.bunchSize,
          bunchesPurchased: row.bunchesPurchased,
          pricePerBunch: row.pricePerBunch,
          totalStemQty: row.totalStemQty ?? row.bunchSize * row.bunchesPurchased,
          costPerStem: row.costPerStem ?? row.pricePerBunch / row.bunchSize,
          source: "reported" as const,
          marketCycle: row.marketCycle,
          sellThrough: closeRecord?.sellThrough.find((record) => record.flower === row.flower) ?? null,
          marketNotes: closeRecord?.notes ?? null,
        };
      }),
    ...backfillRows.map((row) => ({
      id: row.id,
      purchaseDate: row.purchaseDate,
      flower: row.flower,
      category: row.category,
      supplier: row.supplier,
      bunchSize: row.bunchSize,
      bunchesPurchased: row.bunchesPurchased,
      pricePerBunch: row.pricePerBunch,
      totalStemQty: row.totalStemQty ?? row.bunchSize * row.bunchesPurchased,
      costPerStem: row.costPerStem ?? row.pricePerBunch / row.bunchSize,
      source: "backfill" as const,
      marketCycle: null,
      sellThrough: null,
      marketNotes: null,
    })),
  ].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate) || a.id - b.id);

  const guidanceByFlower = new Map<string, { totalPercent: number; markets: Set<number> }>();
  for (const observation of observations) {
    if (!observation.sellThrough || observation.marketCycle === null) continue;
    const current = guidanceByFlower.get(observation.flower) ?? { totalPercent: 0, markets: new Set<number>() };
    current.totalPercent += observation.sellThrough.sellThroughPercent;
    current.markets.add(observation.marketCycle);
    guidanceByFlower.set(observation.flower, current);
  }
  const sellThroughGuidance = [...guidanceByFlower.entries()]
    .map(([flower, value]) => {
      const averageSellThroughPercent = Math.round((value.totalPercent / value.markets.size) * 10) / 10;
      return {
        flower,
        averageSellThroughPercent,
        marketsTracked: value.markets.size,
        guidance: averageSellThroughPercent >= 70
          ? "sells well" as const
          : averageSellThroughPercent <= 40
            ? "doesn't sell well" as const
            : "mixed" as const,
      };
    })
    .sort((a, b) => a.flower.localeCompare(b.flower));

  res.json(ListFlowerPriceDashboardResponse.parse({ observations, sellThroughGuidance }));
});

router.post("/markets/flower-price-backfills", async (req, res): Promise<void> => {
  const body = CreateFlowerPriceBackfillBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid historical purchase data." });
    return;
  }
  const purchaseDate = body.data.purchaseDate;
  const parsedDate = new Date(`${purchaseDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== purchaseDate
    || !body.data.flower.trim()
    || !Number.isInteger(body.data.bunchSize)
    || body.data.bunchSize <= 0
    || !Number.isInteger(body.data.bunchesPurchased)
    || body.data.bunchesPurchased <= 0
    || !Number.isFinite(body.data.pricePerBunch)
    || body.data.pricePerBunch < 0
  ) {
    res.status(400).json({ error: "Enter a valid date, flower, positive bunch size/count, and non-negative cost." });
    return;
  }

  const [created] = await db
    .insert(flowerPriceBackfillsTable)
    .values({
      purchaseDate,
      flower: body.data.flower.trim(),
      category: body.data.category,
      supplier: typeof body.data.supplier === "string" && body.data.supplier.trim() ? body.data.supplier.trim() : null,
      bunchSize: body.data.bunchSize,
      bunchesPurchased: body.data.bunchesPurchased,
      pricePerBunch: body.data.pricePerBunch,
    })
    .returning();

  res.status(201).json(CreateFlowerPriceBackfillResponse.parse({
    id: created.id,
    purchaseDate: created.purchaseDate,
    flower: created.flower,
    category: created.category,
    supplier: created.supplier,
    bunchSize: created.bunchSize,
    bunchesPurchased: created.bunchesPurchased,
    pricePerBunch: created.pricePerBunch,
    totalStemQty: created.totalStemQty ?? created.bunchSize * created.bunchesPurchased,
    costPerStem: created.costPerStem ?? created.pricePerBunch / created.bunchSize,
    source: "backfill",
    marketCycle: null,
    sellThrough: null,
    marketNotes: null,
  }));
});

router.get("/markets", async (_req, res): Promise<void> => {
  for (const market of seededMarkets) {
    await db.insert(marketsTable).values(market).onConflictDoNothing({ target: marketsTable.cycle });
  }
  const markets = await db.select().from(marketsTable).orderBy(marketsTable.cycle);
  const overrides = await readScheduleOverrides();
  const marketCycles = markets.map((market) => market.cycle);
  const [closeRecords, costRecords, purchaseRecords] = marketCycles.length
    ? await Promise.all([
      db
        .select({ marketCycle: closeMarketsTable.marketCycle, closed: closeMarketsTable.closed })
        .from(closeMarketsTable)
        .where(inArray(closeMarketsTable.marketCycle, marketCycles)),
      db
        .select()
        .from(marketCostsTable)
        .where(inArray(marketCostsTable.marketCycle, marketCycles))
        .orderBy(marketCostsTable.id),
      db
        .select({
          marketCycle: marketActualPurchasesTable.marketCycle,
          totalStemQty: marketActualPurchasesTable.totalStemQty,
          costPerStem: marketActualPurchasesTable.costPerStem,
        })
        .from(marketActualPurchasesTable)
        .where(inArray(marketActualPurchasesTable.marketCycle, marketCycles)),
    ])
    : [[], [], []];
  const closedByCycle = new Map(closeRecords.map((record) => [record.marketCycle, record.closed]));
  const costsByCycle = new Map<number, typeof costRecords>();
  for (const cost of costRecords) {
    const current = costsByCycle.get(cost.marketCycle) ?? [];
    current.push(cost);
    costsByCycle.set(cost.marketCycle, current);
  }
  const flowerSpendByCycle = new Map<number, number>();
  for (const purchase of purchaseRecords) {
    flowerSpendByCycle.set(
      purchase.marketCycle,
      (flowerSpendByCycle.get(purchase.marketCycle) ?? 0) + (purchase.totalStemQty ?? 0) * (purchase.costPerStem ?? 0),
    );
  }
  res.json(ListMarketsResponse.parse(markets.map((market) => ({
    ...market,
    date: formatScheduledMarketDate(market.cycle, overrides),
    closed: closedByCycle.get(market.cycle) ?? false,
    flowerSpend: purchaseRecords.some((purchase) => purchase.marketCycle === market.cycle)
      ? flowerSpendByCycle.get(market.cycle) ?? 0
      : Math.max(0, market.spend - (costsByCycle.get(market.cycle) ?? []).reduce((sum, cost) => sum + cost.amount, 0)),
    costs: costsByCycle.get(market.cycle) ?? [],
  }))));
});

router.get("/markets/sell-through", async (req, res): Promise<void> => {
  const cycles = parseCycles(req.query.cycles);
  if (!cycles) {
    res.status(400).json({ error: "Select at least one completed market cycle." });
    return;
  }

  const overrides = await readScheduleOverrides();
  if (cycles.some((cycle) => isSkippedMarketCycle(cycle, overrides))) {
    res.status(400).json({ error: "Skipped market cycles are not available for sell-through comparisons." });
    return;
  }

  const [markets, closeRecords] = await Promise.all([
    db.select().from(marketsTable).where(inArray(marketsTable.cycle, cycles)),
    db.select().from(closeMarketsTable).where(inArray(closeMarketsTable.marketCycle, cycles)),
  ]);
  const closeByCycle = new Map(closeRecords.map((record) => [record.marketCycle, record]));
  if (markets.length !== cycles.length || cycles.some((cycle) => !closeByCycle.get(cycle)?.closed)) {
    res.status(400).json({ error: "Sell-through comparisons are available only for completed market cycles." });
    return;
  }

  const purchases = await db
    .select({
      marketCycle: marketActualPurchasesTable.marketCycle,
      flower: marketActualPurchasesTable.flower,
      totalStemQty: marketActualPurchasesTable.totalStemQty,
    })
    .from(marketActualPurchasesTable)
    .where(inArray(marketActualPurchasesTable.marketCycle, cycles));
  const purchasesByCycle = new Map<number, Array<{ flower: string; stems: number }>>();
  for (const purchase of purchases) {
    const cyclePurchases = purchasesByCycle.get(purchase.marketCycle) ?? [];
    cyclePurchases.push({ flower: purchase.flower, stems: purchase.totalStemQty ?? 0 });
    purchasesByCycle.set(purchase.marketCycle, cyclePurchases);
  }

  const sellThroughByCycle = new Map(
    cycles.map((cycle) => {
      const closeRecord = closeByCycle.get(cycle);
      return [cycle, calculateSellThrough(purchasesByCycle.get(cycle) ?? [], closeRecord?.counts ?? {})];
    }),
  );
  const flowers = [...new Set(cycles.flatMap((cycle) => sellThroughByCycle.get(cycle)?.map((record) => record.flower) ?? []))]
    .sort((a, b) => a.localeCompare(b));
  const marketByCycle = new Map(markets.map((market) => [market.cycle, market]));

  res.json(GetSellThroughComparisonResponse.parse({
    cycles: cycles.map((cycle) => {
      const market = marketByCycle.get(cycle)!;
      return {
        cycle,
        date: formatScheduledMarketDate(cycle, overrides),
        venue: market.venue,
      };
    }),
    flowers: flowers.map((flower) => ({
      flower,
      results: cycles.map((cycle) => {
        const record = sellThroughByCycle.get(cycle)?.find((candidate) => candidate.flower === flower);
        return record
          ? { marketCycle: cycle, purchasedStems: record.purchasedStems, leftoverStems: record.leftoverStems, soldStems: record.soldStems, sellThroughPercent: record.sellThroughPercent }
          : { marketCycle: cycle, purchasedStems: 0, leftoverStems: 0, soldStems: 0, sellThroughPercent: 0 };
      }),
    })),
  }));
});

router.get("/markets/context/:cycle", async (req, res): Promise<void> => {
  const params = GetMarketContextParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Market cycle must be an integer." });
    return;
  }
  res.json(GetMarketContextResponse.parse(await readMarketContext(params.data.cycle)));
});

router.patch("/markets/context/:cycle/buy-list", async (req, res): Promise<void> => {
  const params = UpdateMarketBuyListParams.safeParse(req.params);
  const body = UpdateMarketBuyListBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or lock state." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [existing] = await db
    .select()
    .from(marketBuyListStatesTable)
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle));
  if (existing.locked && !body.data.locked) {
    await db.insert(marketBuyListEditLogsTable).values({
      marketCycle: params.data.cycle,
      action: "unlocked",
      summary: "Proposed list unlocked for editing.",
    });
  } else if (!existing.locked && body.data.locked) {
    const [previousEdit] = await db
      .select({ id: marketBuyListEditLogsTable.id })
      .from(marketBuyListEditLogsTable)
      .where(eq(marketBuyListEditLogsTable.marketCycle, params.data.cycle))
      .limit(1);
    if (previousEdit) {
      await db.insert(marketBuyListEditLogsTable).values({
        marketCycle: params.data.cycle,
        action: "relocked",
        summary: "Proposed list re-locked after edits.",
      });
    }
  }
  const [buyList] = await db
    .update(marketBuyListStatesTable)
    .set({ locked: body.data.locked, reported: body.data.locked ? false : undefined })
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle))
    .returning();
  res.json(UpdateMarketBuyListResponse.parse(await readBuyListState(buyList.marketCycle)));
});

router.put("/markets/context/:cycle/actual-purchases", async (req, res): Promise<void> => {
  const params = ReplaceMarketActualPurchasesParams.safeParse(req.params);
  const body = ReplaceMarketActualPurchasesBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or actual-purchase data." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [buyList] = await db
    .select()
    .from(marketBuyListStatesTable)
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle));
  if (!buyList.locked) {
    res.status(409).json({ error: "Lock the proposed buy list before entering actual purchases." });
    return;
  }
  const normalizedPurchases = body.data.purchases.map((purchase) =>
    normalizePurchaseInput(purchase as unknown as Record<string, unknown>),
  );
  if (normalizedPurchases.some((purchase) =>
    !purchase.flower.trim()
    || !Number.isInteger(purchase.bunchSize)
    || purchase.bunchSize <= 0
    || !Number.isInteger(purchase.bunchesPurchased)
    || purchase.bunchesPurchased <= 0
    || !Number.isFinite(purchase.pricePerBunch)
    || purchase.pricePerBunch < 0
  )) {
    res.status(400).json({ error: "Each actual purchase needs a flower name, positive bunch size/count, and non-negative price per bunch." });
    return;
  }

  const saved = await db.transaction(async (tx) => {
    await tx.delete(marketActualPurchasesTable).where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle));
    if (normalizedPurchases.length > 0) {
      await tx.insert(marketActualPurchasesTable).values(normalizedPurchases.map((purchase) => ({
        marketCycle: params.data.cycle,
        ...purchase,
      })));
    }
    const [updatedBuyList] = await tx
      .update(marketBuyListStatesTable)
      .set({
        reported: false,
        ...(Object.prototype.hasOwnProperty.call(body.data, "receiptFileName") ? { receiptFileName: body.data.receiptFileName } : {}),
        ...(Object.prototype.hasOwnProperty.call(body.data, "receiptText") ? { receiptText: body.data.receiptText } : {}),
        ...(Object.prototype.hasOwnProperty.call(body.data, "receiptCandidates") ? { receiptCandidates: body.data.receiptCandidates } : {}),
      })
      .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle))
      .returning();
    const purchases = await tx
      .select()
      .from(marketActualPurchasesTable)
      .where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle))
      .orderBy(marketActualPurchasesTable.id);
    await recalculateMarketTotals(params.data.cycle, tx);
    return { buyList: updatedBuyList, purchases: purchases.map(serializePurchase) };
  });
  res.json(ReplaceMarketActualPurchasesResponse.parse({
    ...saved,
    buyList: await readBuyListState(params.data.cycle),
  }));
});

router.put("/markets/context/:cycle/costs", async (req, res): Promise<void> => {
  const params = ReplaceMarketCostsParams.safeParse(req.params);
  const body = ReplaceMarketCostsBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or cost data." });
    return;
  }
  if (body.data.costs.some((cost) => !cost.description.trim() || cost.amount < 0)) {
    res.status(400).json({ error: "Each market cost needs a description and a non-negative amount." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const saved = await db.transaction(async (tx) => {
    const previousCosts = await tx
      .select({ amount: marketCostsTable.amount })
      .from(marketCostsTable)
      .where(eq(marketCostsTable.marketCycle, params.data.cycle));
    const previousCostTotal = previousCosts.reduce((sum: number, cost: { amount: number }) => sum + cost.amount, 0);
    await tx.delete(marketCostsTable).where(eq(marketCostsTable.marketCycle, params.data.cycle));
    if (body.data.costs.length > 0) {
      await tx.insert(marketCostsTable).values(body.data.costs.map((cost) => ({
        marketCycle: params.data.cycle,
        description: cost.description.trim(),
        amount: cost.amount,
      })));
    }
    const market = await recalculateMarketTotals(params.data.cycle, tx, previousCostTotal);
    const costs = await tx
      .select()
      .from(marketCostsTable)
      .where(eq(marketCostsTable.marketCycle, params.data.cycle))
      .orderBy(marketCostsTable.id);
    return { costs, spend: market?.spend ?? 0, margin: market?.margin ?? 0 };
  });
  res.json(ReplaceMarketCostsResponse.parse(saved));
});

router.post("/markets/context/:cycle/report-purchases", async (req, res): Promise<void> => {
  const params = ReportMarketPurchasesParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [buyList] = await db
    .select()
    .from(marketBuyListStatesTable)
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle));
  const purchases = await db
    .select({ id: marketActualPurchasesTable.id })
    .from(marketActualPurchasesTable)
    .where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle));
  if (!buyList.locked) {
    res.status(409).json({ error: "Lock the proposed buy list before reporting actual purchases." });
    return;
  }
  if (purchases.length === 0) {
    res.status(400).json({ error: "Save at least one actual purchase before reporting." });
    return;
  }
  const [updatedBuyList] = await db
    .update(marketBuyListStatesTable)
    .set({ reported: true })
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle))
    .returning();
  res.json(ReportMarketPurchasesResponse.parse(await readBuyListState(updatedBuyList.marketCycle)));
});

router.patch("/markets/context/:cycle/buy-items/:id", async (req, res): Promise<void> => {
  const params = UpdateMarketBuyItemParams.safeParse(req.params);
  const body = UpdateMarketBuyItemBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle) || !Number.isInteger(params.data.id)) {
    res.status(400).json({ error: "Invalid market cycle, item ID, or checked value." });
    return;
  }
  const [buyList] = await db
    .select()
    .from(marketBuyListStatesTable)
    .where(eq(marketBuyListStatesTable.marketCycle, params.data.cycle));
  if (buyList?.locked) {
    res.status(409).json({ error: "Unlock the proposed buy list before editing it." });
    return;
  }
  const [previousItem] = await db
    .select()
    .from(buyItemsTable)
    .where(and(eq(buyItemsTable.id, params.data.id), eq(buyItemsTable.marketCycle, params.data.cycle)));
  const [item] = await db
    .update(buyItemsTable)
    .set({ checked: body.data.checked })
    .where(and(eq(buyItemsTable.id, params.data.id), eq(buyItemsTable.marketCycle, params.data.cycle)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Buy-list item not found." });
    return;
  }
  const [previousEdit] = await db
    .select({ id: marketBuyListEditLogsTable.id })
    .from(marketBuyListEditLogsTable)
    .where(eq(marketBuyListEditLogsTable.marketCycle, params.data.cycle))
    .limit(1);
  if (previousEdit && previousItem && previousItem.checked !== item.checked) {
    await db.insert(marketBuyListEditLogsTable).values({
      marketCycle: params.data.cycle,
      action: "item_updated",
      summary: `${item.flower}: ${previousItem.checked ? "ready" : "not ready"} → ${item.checked ? "ready" : "not ready"}.`,
    });
  }
  const updatedContext = await readMarketContext(params.data.cycle);
  const updatedItem = updatedContext.buyItems.find((buyItem) => buyItem.id === item.id);
  res.json(UpdateMarketBuyItemResponse.parse(updatedItem));
});

router.patch("/markets/context/:cycle/bouquet-plan", async (req, res): Promise<void> => {
  const params = UpdateMarketBouquetPlanParams.safeParse(req.params);
  const body = UpdateMarketBouquetPlanBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle) || !Number.isInteger(body.data.count)) {
    res.status(400).json({ error: "Invalid market cycle or bouquet plan." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [plan] = await db
    .update(bouquetPlansTable)
    .set({ selectedBand: body.data.selectedBand, count: body.data.count })
    .where(eq(bouquetPlansTable.marketCycle, params.data.cycle))
    .returning();
  res.json(UpdateMarketBouquetPlanResponse.parse(plan));
});

router.get("/markets/day-todos", async (_req, res): Promise<void> => {
  const [markets, overrides, items, snapshots, closeMarkets] = await Promise.all([
    db.select({ cycle: marketsTable.cycle }).from(marketsTable).orderBy(asc(marketsTable.cycle)),
    readScheduleOverrides(),
    db.select().from(marketDayTodoItemsTable).orderBy(asc(marketDayTodoItemsTable.marketCycle), asc(marketDayTodoItemsTable.position), asc(marketDayTodoItemsTable.id)),
    db.select().from(marketDayTodoSnapshotsTable),
    db.select({ marketCycle: closeMarketsTable.marketCycle, closed: closeMarketsTable.closed }).from(closeMarketsTable),
  ]);
  const itemsByCycle = new Map<number, Array<typeof marketDayTodoItemsTable.$inferSelect>>();
  for (const item of items) {
    const cycleItems = itemsByCycle.get(item.marketCycle) ?? [];
    cycleItems.push(item);
    itemsByCycle.set(item.marketCycle, cycleItems);
  }
  const snapshotsByCycle = new Map(snapshots.map((snapshot) => [snapshot.marketCycle, snapshot]));
  const closesByCycle = new Map(closeMarkets.map((closeMarket) => [closeMarket.marketCycle, closeMarket.closed]));
  res.json(ListMarketDayTodosResponse.parse(markets.map(({ cycle }) => formatMarketDayTodoPeriod(
    cycle,
    closesByCycle.get(cycle) ?? false,
    itemsByCycle.get(cycle) ?? [],
    snapshotsByCycle.get(cycle),
    overrides,
  ))));
});

router.put("/markets/day-todos/:cycle", async (req, res): Promise<void> => {
  const params = ReplaceMarketDayTodosParams.safeParse(req.params);
  const body = ReplaceMarketDayTodosBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or Market Day To Do items." });
    return;
  }
  const items = body.data.items
    .map((item, index) => ({
      description: item.description.trim(),
      completed: item.completed,
      position: index,
    }))
    .filter((item) => item.description.length > 0);
  if (items.some((item) => item.description.length > 240)) {
    res.status(400).json({ error: "Market Day To Do items must be 240 characters or fewer." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  await db.transaction(async (tx) => {
    await tx.delete(marketDayTodoItemsTable).where(eq(marketDayTodoItemsTable.marketCycle, params.data.cycle));
    if (items.length > 0) {
      await tx.insert(marketDayTodoItemsTable).values(items.map((item) => ({ ...item, marketCycle: params.data.cycle })));
    }
  });
  const overrides = await readScheduleOverrides();
  res.json(ReplaceMarketDayTodosResponse.parse(await readMarketDayTodoPeriod(params.data.cycle, overrides)));
});

router.patch("/markets/context/:cycle/close", async (req, res): Promise<void> => {
  const params = UpdateMarketCloseParams.safeParse(req.params);
  const body = UpdateMarketCloseBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isInteger(params.data.cycle)) {
    res.status(400).json({ error: "Invalid market cycle or close-market data." });
    return;
  }
  await ensureMarketContext(params.data.cycle);
  const [existingCloseMarket] = await db
    .select()
    .from(closeMarketsTable)
    .where(eq(closeMarketsTable.marketCycle, params.data.cycle));
  if (existingCloseMarket?.closed && !body.data.reopen) {
    res.status(409).json({ error: "This close-out is finalized. Reopen it before editing." });
    return;
  }
  if (body.data.reopen && body.data.closed) {
    res.status(400).json({ error: "Reopening a finalized close-out must leave it open for editing." });
    return;
  }
  const purchases = await db
    .select({ flower: marketActualPurchasesTable.flower, totalStemQty: marketActualPurchasesTable.totalStemQty })
    .from(marketActualPurchasesTable)
    .where(eq(marketActualPurchasesTable.marketCycle, params.data.cycle));
  const sellThrough = calculateSellThrough(
    purchases.map((purchase) => ({ flower: purchase.flower, stems: purchase.totalStemQty ?? 0 })),
    body.data.counts,
  );
  const notes = Object.prototype.hasOwnProperty.call(body.data, "notes")
    ? (typeof body.data.notes === "string" && body.data.notes.trim() ? body.data.notes.trim() : null)
    : existingCloseMarket?.notes ?? null;
  const scheduleOverrides = body.data.closed && !existingCloseMarket?.closed
    ? await readScheduleOverrides()
    : [];
  const nextTodoCycle = body.data.closed && !existingCloseMarket?.closed
    ? getNextTodoMarketCycle(params.data.cycle, scheduleOverrides)
    : null;
  if (nextTodoCycle !== null) {
    await ensureMarketContext(nextTodoCycle);
  }
  const [closeMarket] = await db.transaction(async (tx) => {
    const [updatedCloseMarket] = await tx
      .update(closeMarketsTable)
      .set({ counts: body.data.counts, sellThrough, notes, closed: body.data.closed })
      .where(eq(closeMarketsTable.marketCycle, params.data.cycle))
      .returning();
    if (body.data.closed && !existingCloseMarket?.closed) {
      await captureClosedMarketTodoAndGenerateNext(params.data.cycle, nextTodoCycle!, tx);
    }
    return [updatedCloseMarket];
  });
  res.json(UpdateMarketCloseResponse.parse(closeMarket));
});

export default router;