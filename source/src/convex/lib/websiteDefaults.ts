import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeWebsiteUrl } from "./websites";

export type WebsiteCategorySeed = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tone: string;
};

export type WebsiteSeed = {
  name: string;
  url: string;
  description: string;
  categorySlug: string;
  sourceName: string;
  sourceUrl?: string;
  featured?: boolean;
};

export const WEBSITE_CATEGORY_SEEDS: WebsiteCategorySeed[] = [
  {
    slug: "government",
    name: "خدمات دولتی",
    description: "درگاه‌ها و خدمات یکپارچه دستگاه‌های اجرایی",
    icon: "landmark",
    tone: "navy",
  },
  {
    slug: "judiciary",
    name: "خدمات قضایی و حقوقی",
    description: "خدمات الکترونیک قضایی، ثنا و ثبت اسناد",
    icon: "scale",
    tone: "mint",
  },
  {
    slug: "banking",
    name: "خدمات بانکی و مالی",
    description: "بانکداری اینترنتی، پرداخت و اطلاعات بانکی",
    icon: "banknote",
    tone: "peach",
  },
  {
    slug: "exams",
    name: "ثبت‌نام آزمون‌ها",
    description: "آزمون‌های سراسری، تحصیلات تکمیلی و مدارس",
    icon: "clipboard",
    tone: "navy",
  },
  {
    slug: "education",
    name: "دانشگاه و آموزش",
    description: "خدمات دانشجویی، مدارس و دانشگاه‌ها",
    icon: "graduation",
    tone: "mint",
  },
  {
    slug: "jobs",
    name: "استخدام و کاریابی",
    description: "جستجوی شغل و خدمات وزارت کار",
    icon: "briefcase",
    tone: "lilac",
  },
  {
    slug: "vehicle",
    name: "خودرو و حمل‌ونقل",
    description: "خلافی، پلاک، گواهینامه و حمل‌ونقل جاده‌ای",
    icon: "car",
    tone: "peach",
  },
  {
    slug: "insurance",
    name: "بیمه و تأمین اجتماعی",
    description: "بیمه درمان، سوابق بیمه و خدمات رفاهی",
    icon: "shield",
    tone: "navy",
  },
  {
    slug: "tax",
    name: "مالیات و امور اقتصادی",
    description: "اظهارنامه، مؤدیان، گمرک و مجوزهای اقتصادی",
    icon: "receipt",
    tone: "mint",
  },
  {
    slug: "telecom",
    name: "خدمات اینترنتی و مخابرات",
    description: "اینترنت، تلفن، رجیستری و اپراتورها",
    icon: "wifi",
    tone: "lilac",
  },
  {
    slug: "housing",
    name: "خدمات مسکن و املاک",
    description: "املاک و اسکان، اجاره‌نامه و خدمات شهری",
    icon: "home",
    tone: "peach",
  },
  {
    slug: "other",
    name: "سایر سامانه‌ها",
    description: "هواشناسی، پست، استاندارد و خدمات عمومی",
    icon: "grid",
    tone: "navy",
  },
];

export const WEBSITE_SEEDS: WebsiteSeed[] = [
  {
    name: "پنجره ملی خدمات دولت هوشمند",
    url: "https://my.gov.ir",
    description:
      "دسترسی یکپارچه به خدمات دستگاه‌های اجرایی با یک‌بار احراز هویت.",
    categorySlug: "government",
    sourceName: "سازمان فناوری اطلاعات ایران",
    featured: true,
  },
  {
    name: "درگاه خدمات الکترونیکی ثبت احوال",
    url: "https://ncr.ir",
    description:
      "خدمات کارت هوشمند ملی، تغییر نشانی و استعلام‌های هویتی.",
    categorySlug: "government",
    sourceName: "سازمان ثبت احوال کشور",
    featured: true,
  },
  {
    name: "درگاه ملی مجوزهای کشور",
    url: "https://mojavez.ir",
    description:
      "ثبت و پیگیری درخواست صدور یا تمدید مجوز کسب‌وکار.",
    categorySlug: "government",
    sourceName: "مرکز ملی بهبود فضای کسب‌وکار",
  },
  {
    name: "سامانه سخا",
    url: "https://sakha.epolice.ir",
    description:
      "خدمات غیرحضوری انتظامی، گذرنامه، گواهینامه و وضعیت نظام وظیفه.",
    categorySlug: "government",
    sourceName: "فرماندهی انتظامی جمهوری اسلامی ایران",
  },
  {
    name: "سامانه رفاه ایرانیان",
    url: "https://refahdb.mcls.gov.ir",
    description:
      "اطلاعات رفاه خانوار، دهک‌بندی و خدمات حمایتی وزارت کار.",
    categorySlug: "government",
    sourceName: "وزارت تعاون، کار و رفاه اجتماعی",
  },

  {
    name: "عدل ایران",
    url: "https://adliran.ir",
    description:
      "درگاه خدمات الکترونیک قضایی، پیگیری پرونده و خدمات حقوقی.",
    categorySlug: "judiciary",
    sourceName: "قوه قضائیه جمهوری اسلامی ایران",
    featured: true,
  },
  {
    name: "ثنا",
    url: "https://sana.adliran.ir",
    description:
      "ثبت‌نام و احراز هویت الکترونیکی برای استفاده از خدمات قضایی.",
    categorySlug: "judiciary",
    sourceName: "قوه قضائیه جمهوری اسلامی ایران",
  },
  {
    name: "ابلاغ الکترونیک قضایی",
    url: "https://eblagh.adliran.ir",
    description: "مشاهده و دریافت ابلاغیه‌ها و اطلاعیه‌های قضایی.",
    categorySlug: "judiciary",
    sourceName: "قوه قضائیه جمهوری اسلامی ایران",
  },
  {
    name: "ثبت من",
    url: "https://my.ssaa.ir",
    description:
      "خدمات الکترونیک ثبت اسناد و املاک، استعلام سند و پیگیری پرونده.",
    categorySlug: "judiciary",
    sourceName: "سازمان ثبت اسناد و املاک کشور",
  },

  {
    name: "بانک مرکزی جمهوری اسلامی ایران",
    url: "https://www.cbi.ir",
    description:
      "مقررات، آمار، اطلاعیه‌ها و خدمات الکترونیک نظام بانکی.",
    categorySlug: "banking",
    sourceName: "بانک مرکزی جمهوری اسلامی ایران",
    featured: true,
  },
  {
    name: "بانک ملت",
    url: "https://www.bankmellat.ir",
    description: "خدمات بانکداری اینترنتی و اطلاعات شعب بانک ملت.",
    categorySlug: "banking",
    sourceName: "بانک ملت",
  },
  {
    name: "بانک سپه",
    url: "https://www.banksepah.ir",
    description: "خدمات بانکداری الکترونیک و اطلاعیه‌های بانک سپه.",
    categorySlug: "banking",
    sourceName: "بانک سپه",
  },
  {
    name: "بانک ملی ایران",
    url: "https://www.bmi.ir",
    description: "خدمات بانکداری اینترنتی و اطلاعات بانک ملی ایران.",
    categorySlug: "banking",
    sourceName: "بانک ملی ایران",
  },
  {
    name: "بانک مسکن",
    url: "https://www.bankmaskan.ir",
    description: "خدمات بانکی و تسهیلات مسکن.",
    categorySlug: "banking",
    sourceName: "بانک مسکن",
  },
  {
    name: "آسان پرداخت",
    url: "https://www.asanpardakht.ir",
    description: "خدمات پرداخت الکترونیک و درگاه‌های پرداخت.",
    categorySlug: "banking",
    sourceName: "شرکت آسان پرداخت پرشین",
  },
  {
    name: "شاپرک",
    url: "https://www.shaparak.ir",
    description:
      "شبکه الکترونیکی پرداخت کارت و اطلاعات پذیرندگان و تراکنش‌ها.",
    categorySlug: "banking",
    sourceName: "شرکت شاپرک",
  },

  {
    name: "سازمان سنجش آموزش کشور",
    url: "https://www.sanjesh.org",
    description:
      "اطلاعیه‌ها و ثبت‌نام آزمون سراسری و آزمون‌های تحصیلات تکمیلی.",
    categorySlug: "exams",
    sourceName: "سازمان سنجش آموزش کشور",
    featured: true,
  },
  {
    name: "پروفایل داوطلب سنجش",
    url: "https://my.sanjesh.org",
    description:
      "مشاهده کارت ورود به جلسه، نتایج و انتخاب رشته داوطلبان.",
    categorySlug: "exams",
    sourceName: "سازمان سنجش آموزش کشور",
  },
  {
    name: "سازمان سنجش آموزش پزشکی",
    url: "https://www.sanjeshp.ir",
    description: "اطلاعیه و ثبت‌نام آزمون‌های علوم پزشکی.",
    categorySlug: "exams",
    sourceName: "وزارت بهداشت، درمان و آموزش پزشکی",
  },
  {
    name: "سامانه سمپاد",
    url: "https://sampad.medu.ir",
    description:
      "اطلاعیه‌ها و خدمات سازمان ملی پرورش استعدادهای درخشان.",
    categorySlug: "exams",
    sourceName: "سازمان ملی پرورش استعدادهای درخشان",
  },

  {
    name: "پنجره واحد خدمات آموزش و پرورش",
    url: "https://my.medu.ir",
    description:
      "کارنامه، هدایت تحصیلی، پیش‌ثبت‌نام مدارس و خدمات فرهنگیان.",
    categorySlug: "education",
    sourceName: "وزارت آموزش و پرورش",
    featured: true,
  },
  {
    name: "سازمان امور دانشجویان",
    url: "https://www.saorg.ir",
    description:
      "خدمات رفاهی و آموزشی دانشجویان، وام، تغذیه و خوابگاه.",
    categorySlug: "education",
    sourceName: "وزارت علوم، تحقیقات و فناوری",
  },
  {
    name: "دانشگاه تهران",
    url: "https://www.ut.ac.ir",
    description: "پورتال رسمی دانشگاه تهران و خدمات آموزشی.",
    categorySlug: "education",
    sourceName: "دانشگاه تهران",
  },
  {
    name: "دانشگاه صنعتی شریف",
    url: "https://www.sharif.edu",
    description: "پورتال رسمی دانشگاه صنعتی شریف.",
    categorySlug: "education",
    sourceName: "دانشگاه صنعتی شریف",
  },
  {
    name: "دانشگاه تربیت مدرس",
    url: "https://www.modares.ac.ir",
    description: "پورتال رسمی دانشگاه تربیت مدرس.",
    categorySlug: "education",
    sourceName: "دانشگاه تربیت مدرس",
  },

  {
    name: "سامانه جستجوی شغل",
    url: "https://shoghl.mcls.gov.ir",
    description:
      "جستجوی آگهی‌های شغلی، ثبت رزومه و درخواست آنلاین.",
    categorySlug: "jobs",
    sourceName: "وزارت تعاون، کار و رفاه اجتماعی",
    featured: true,
  },
  {
    name: "وزارت تعاون، کار و رفاه اجتماعی",
    url: "https://www.mcls.gov.ir",
    description:
      "پورتال رسمی وزارت کار و دسترسی به سامانه‌های زیرمجموعه.",
    categorySlug: "jobs",
    sourceName: "وزارت تعاون، کار و رفاه اجتماعی",
  },

  {
    name: "راهور ۱۲۰",
    url: "https://rahvar120.ir",
    description:
      "استعلام و پرداخت خلافی، نمره منفی گواهینامه و خدمات راهور.",
    categorySlug: "vehicle",
    sourceName: "پلیس راهور فراجا",
    featured: true,
  },
  {
    name: "درگاه پلیس",
    url: "https://police.ir",
    description:
      "پورتال رسمی فراجا و راهنمای خدمات الکترونیک انتظامی.",
    categorySlug: "vehicle",
    sourceName: "فرماندهی انتظامی جمهوری اسلامی ایران",
  },
  {
    name: "کارت هوشمند رانندگان",
    url: "https://smartcard.rmto.ir",
    description:
      "خدمات کارت هوشمند راننده، کارت سلامت و ناوگان جاده‌ای.",
    categorySlug: "vehicle",
    sourceName: "سازمان راهداری و حمل‌ونقل جاده‌ای",
  },
  {
    name: "سامانه یکپارچه فروش خودرو",
    url: "https://sale.iranecar.com",
    description:
      "ثبت‌نام و انتخاب خودرو در سامانه یکپارچه عرضه خودرو.",
    categorySlug: "vehicle",
    sourceName: "وزارت صنعت، معدن و تجارت",
  },

  {
    name: "سازمان تأمین اجتماعی",
    url: "https://tamin.ir",
    description:
      "پورتال رسمی تأمین اجتماعی و راهنمای خدمات بیمه‌شدگان.",
    categorySlug: "insurance",
    sourceName: "سازمان تأمین اجتماعی",
    featured: true,
  },
  {
    name: "خدمات غیرحضوری تأمین اجتماعی",
    url: "https://es.tamin.ir",
    description:
      "سوابق بیمه، فیش حقوقی، پرداخت حق بیمه و خدمات کارفرمایان.",
    categorySlug: "insurance",
    sourceName: "سازمان تأمین اجتماعی",
  },
  {
    name: "سازمان بیمه سلامت ایران",
    url: "https://www.ihio.gov.ir",
    description:
      "خدمات بیمه سلامت، نسخ الکترونیک و اطلاعات بیمه‌شدگان.",
    categorySlug: "insurance",
    sourceName: "سازمان بیمه سلامت ایران",
  },
  {
    name: "سامانه حمایت",
    url: "https://hemayat.mcls.gov.ir",
    description:
      "مشاهده دهک خانوار و ثبت درخواست بررسی یارانه و خدمات حمایتی.",
    categorySlug: "insurance",
    sourceName: "وزارت تعاون، کار و رفاه اجتماعی",
  },

  {
    name: "درگاه ملی خدمات مالیات",
    url: "https://my.tax.gov.ir",
    description:
      "اظهارنامه، پرداخت مالیات، مشاهده بدهی و پرونده مالیاتی.",
    categorySlug: "tax",
    sourceName: "سازمان امور مالیاتی کشور",
    featured: true,
  },
  {
    name: "سامانه مؤدیان",
    url: "https://tp.tax.gov.ir",
    description:
      "ثبت و ارسال صورتحساب الکترونیکی و دریافت کد رهگیری.",
    categorySlug: "tax",
    sourceName: "سازمان امور مالیاتی کشور",
  },
  {
    name: "سامانه جامع امور گمرکی",
    url: "https://epl.irica.gov.ir",
    description:
      "اظهارنامه گمرکی، پیگیری کوتاژ و خدمات واردات و صادرات.",
    categorySlug: "tax",
    sourceName: "گمرک جمهوری اسلامی ایران",
  },
  {
    name: "گمرک جمهوری اسلامی ایران",
    url: "https://www.irica.ir",
    description: "پورتال رسمی گمرک و اطلاعیه‌های تجاری.",
    categorySlug: "tax",
    sourceName: "گمرک جمهوری اسلامی ایران",
  },

  {
    name: "مخابرات من",
    url: "https://my.tci.ir",
    description:
      "مشاهده و پرداخت قبض تلفن ثابت، ریزکارکرد و مدیریت خط.",
    categorySlug: "telecom",
    sourceName: "شرکت مخابرات ایران",
    featured: true,
  },
  {
    name: "پورتال شرکت مخابرات ایران",
    url: "https://www.tci.ir",
    description:
      "پورتال رسمی مخابرات و دسترسی به سامانه‌های اینترنت و تلفن.",
    categorySlug: "telecom",
    sourceName: "شرکت مخابرات ایران",
  },
  {
    name: "سامانه همتا",
    url: "https://hamta.ntsw.ir",
    description:
      "رجیستری موبایل، استعلام IMEI و انتقال مالکیت گوشی.",
    categorySlug: "telecom",
    sourceName: "سازمان تنظیم مقررات و ارتباطات رادیویی",
  },
  {
    name: "همراه من",
    url: "https://my.mci.ir",
    description:
      "مدیریت اشتراک، قبض و خدمات مشترکان همراه اول.",
    categorySlug: "telecom",
    sourceName: "شرکت ارتباطات سیار ایران",
  },
  {
    name: "ایرانسل",
    url: "https://www.irancell.ir",
    description: "پورتال رسمی ایرانسل و خدمات مشترکان.",
    categorySlug: "telecom",
    sourceName: "شرکت خدمات ارتباطی ایرانسل",
  },
  {
    name: "رایتل",
    url: "https://www.rightel.ir",
    description: "پورتال رسمی رایتل و خدمات مشترکان.",
    categorySlug: "telecom",
    sourceName: "شرکت خدمات ارتباطی رایتل",
  },
  {
    name: "مای شاتل",
    url: "https://my.shatel.ir",
    description:
      "پنل کاربری شاتل برای مدیریت سرویس و پشتیبانی اینترنت.",
    categorySlug: "telecom",
    sourceName: "شرکت شاتل",
  },

  {
    name: "سامانه ملی املاک و اسکان",
    url: "https://amlak.mrud.ir",
    description:
      "ثبت اطلاعات مالکیت و محل سکونت خانوار و خدمات مرتبط.",
    categorySlug: "housing",
    sourceName: "وزارت راه و شهرسازی",
    featured: true,
  },
  {
    name: "سامانه خودنویس",
    url: "https://khodnevis.mrud.ir",
    description:
      "ثبت رایگان قرارداد اجاره و دریافت کد رهگیری.",
    categorySlug: "housing",
    sourceName: "وزارت راه و شهرسازی",
  },

  {
    name: "سازمان هواشناسی کشور",
    url: "https://www.irimo.ir",
    description:
      "پیش‌بینی هوا، هشدارهای هواشناسی و اطلاعات اقلیمی.",
    categorySlug: "other",
    sourceName: "سازمان هواشناسی کشور",
  },
  {
    name: "شرکت ملی پست",
    url: "https://post.ir",
    description:
      "رهگیری مرسولات، خدمات پستی و اطلاعات دفاتر پست.",
    categorySlug: "other",
    sourceName: "شرکت ملی پست جمهوری اسلامی ایران",
  },
  {
    name: "سازمان ملی استاندارد",
    url: "https://www.isiri.gov.ir",
    description:
      "استانداردها، اطلاعیه‌ها و خدمات سازمان ملی استاندارد.",
    categorySlug: "other",
    sourceName: "سازمان ملی استاندارد ایران",
  },
];

export async function ensureWebsiteCatalog(
  ctx: MutationCtx,
  options: { actorId: Id<"users">; onlyIfEmpty?: boolean },
) {
  const existingSites = await ctx.db.query("websites").take(1);
  if (options.onlyIfEmpty !== false && existingSites.length > 0) {
    return { categoriesCreated: 0, websitesCreated: 0 };
  }

  const existingCategories = await ctx.db
    .query("website_categories")
    .withIndex("by_sort_order")
    .collect();
  const categoryBySlug = new Map(
    existingCategories.map((category) => [category.slug, category]),
  );
  const now = Date.now();
  let categoriesCreated = 0;

  for (const [index, seed] of WEBSITE_CATEGORY_SEEDS.entries()) {
    if (categoryBySlug.has(seed.slug)) continue;
    const id = await ctx.db.insert("website_categories", {
      ...seed,
      sortOrder: index,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const inserted = await ctx.db.get(id);
    if (inserted) categoryBySlug.set(seed.slug, inserted);
    categoriesCreated += 1;
  }

  const existingUrls = new Set(
    (await ctx.db.query("websites").collect()).map((site) => site.url),
  );
  let websitesCreated = 0;
  let sortOrder = existingUrls.size;

  for (const seed of WEBSITE_SEEDS) {
    const category = categoryBySlug.get(seed.categorySlug);
    if (!category) continue;
    const url = normalizeWebsiteUrl(seed.url, "آدرس سامانه");
    if (existingUrls.has(url)) continue;
    const sourceUrl = seed.sourceUrl
      ? normalizeWebsiteUrl(seed.sourceUrl, "لینک منبع")
      : url;
    await ctx.db.insert("websites", {
      name: seed.name,
      description: seed.description,
      url,
      categoryId: category._id,
      sourceName: seed.sourceName,
      sourceUrl,
      verificationStatus: "verified",
      lastCheckStatus: "unchecked",
      isActive: true,
      isFeatured: seed.featured === true,
      sortOrder,
      visitCount: 0,
      createdBy: options.actorId,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    existingUrls.add(url);
    websitesCreated += 1;
    sortOrder += 1;
  }

  return { categoriesCreated, websitesCreated };
}
