const STRINGS: Record<string, Record<string, string | string[]>> = {
  en: {
    "office.gpuError": "The office lost its GPU context. Reload the page to bring it back.",
    "office.errand.water": ["watering the plants", "giving the plants a drink"],
    "office.errand.window": ["letting some air in", "a bit of fresh air"],
    "office.errand.dispenser": ["getting some water", "hydration break"],
    "office.errand.fridge": ["anything good in the fridge?", "just looking"],
    "office.errand.shelf": ["checking the shelf", "reading the docs"],
    "office.errand.bin": ["desk cleanup", "tidying up"],
    "office.errand.smoke": ["stepping out for a minute", "thinking big thoughts"],
    "office.suckUp": ["{{done}} issues closed this week", "plan looks solid", "on it now", "roadmap makes sense", "ready for the next one", "reviewed and merged", "queue is clear"],
    "office.gossip": ["that run took forever", "another quick sync", "who reassigned my issue?", "the review queue is long today", "backlog keeps growing", "is CI green yet?", "need another approval"],
    "office.cheer": ["done", "shipped", "merged", "that's a wrap", "closed it", "in review now", "next issue"],
    "office.mugs.empty": "no clean mugs left",
    "office.mugs.brewing": "brewing a fresh one",
    "office.mugs.washing": "washing the mug",
    "office.activity.waiting": "waiting",
    "office.activity.needsYou": "needs approval",
    "office.activity.compacting": "compacting context",
    "office.activity.looping": "looping",
    "office.activity.runningFloor": "running the company",
    "office.activity.idle": "idle",
  },
  ar: {
    "office.gpuError": "فقد المكتب سياق كرت الشاشة. أعد تحميل الصفحة لإعادته.",
    "office.errand.water": ["يسقي النباتات", "يعطي النباتات شربة ماء"],
    "office.errand.window": ["يدخل بعض الهواء", "نفس هواء نقي"],
    "office.errand.dispenser": ["يأخذ كوب ماء", "استراحة ماء"],
    "office.errand.fridge": ["يوجد شيء جيد بالثلاجة؟", "مجرد نظرة"],
    "office.errand.shelf": ["يتفقد الرف", "يقرأ الوثائق"],
    "office.errand.bin": ["تنظيف المكتب", "ترتيب الأغراض"],
    "office.errand.smoke": ["يخرج لدقيقة", "يفكر بأمور كبيرة"],
    "office.suckUp": ["{{done}} مهام أُنجزت هذا الأسبوع", "الخطة جيدة", "أعمل عليها الآن", "خارطة الطريق منطقية", "جاهز للمهمة التالية", "تمت المراجعة والدمج", "قائمة الانتظار فارغة"],
    "office.gossip": ["تلك المهمة استغرقت وقتاً طويلاً", "مزامنة سريعة أخرى", "من أعاد تعيين مهمتي؟", "قائمة المراجعة طويلة اليوم", "المهام المتراكمة تزداد", "هل نجح الفحص الآلي؟", "بحاجة لموافقة أخرى"],
    "office.cheer": ["تم", "تم الشحن", "تم الدمج", "انتهينا", "أُغلقت", "قيد المراجعة الآن", "المهمة التالية"],
    "office.mugs.empty": "لا توجد أكواب نظيفة",
    "office.mugs.brewing": "يحضّر كوباً جديداً",
    "office.mugs.washing": "يغسل الكوب",
    "office.activity.waiting": "بالانتظار",
    "office.activity.needsYou": "بحاجة لموافقة",
    "office.activity.compacting": "يضغط السياق",
    "office.activity.looping": "متعثر",
    "office.activity.runningFloor": "يدير الشركة",
    "office.activity.idle": "خامل",
  },
  "zh-CN": {
    "office.gpuError": "办公室的 GPU 上下文丢失了,刷新页面即可恢复。",
    "office.errand.water": ["给植物浇水", "给植物喝点水"],
    "office.errand.window": ["透透气", "呼吸点新鲜空气"],
    "office.errand.dispenser": ["接点水喝", "喝水休息一下"],
    "office.errand.fridge": ["冰箱里有什么好东西吗", "随便看看"],
    "office.errand.shelf": ["看看书架", "翻翻文档"],
    "office.errand.bin": ["整理桌面", "收拾一下"],
    "office.errand.smoke": ["出去待一会儿", "想点大事"],
    "office.suckUp": ["本周关闭了 {{done}} 个任务", "计划很合理", "正在处理", "路线图说得通", "可以接下一个了", "已审核并合并", "队列已清空"],
    "office.gossip": ["那次运行花了好久", "又同步了一下", "谁重新分配了我的任务", "今天的审核队列很长", "待办越堆越多", "CI 通过了吗", "还需要一次批准"],
    "office.cheer": ["搞定", "已发布", "已合并", "收工", "已关闭", "审核中", "下一个任务"],
    "office.mugs.empty": "没有干净的杯子了",
    "office.mugs.brewing": "正在煮新的一杯",
    "office.mugs.washing": "正在洗杯子",
    "office.activity.waiting": "等待中",
    "office.activity.needsYou": "需要批准",
    "office.activity.compacting": "压缩上下文中",
    "office.activity.looping": "卡住了",
    "office.activity.runningFloor": "管理公司",
    "office.activity.idle": "空闲",
  },
};

let currentLanguage = "en";
let chatterEnabled = true;

export function setLanguage(lang: string): void {
  currentLanguage = lang in STRINGS ? lang : "en";
}

export function setChatter(enabled: boolean): void {
  chatterEnabled = enabled;
}

const CHATTER_PREFIXES = ["office.gossip", "office.suckUp", "office.cheer", "office.errand", "office.mugs"];

function lookup(key: string): string | string[] | undefined {
  if (!chatterEnabled && CHATTER_PREFIXES.some((p) => key.startsWith(p))) return "";
  const table = STRINGS[currentLanguage] ?? STRINGS.en;
  if (key in table) return table[key];
  const m = /^(.*)\.(\d+)$/.exec(key);
  const list = m ? table[m[1]] : undefined;
  return Array.isArray(list) ? list[Number(m![2]) % list.length] : undefined;
}

export function t(key: string, vars?: Record<string, unknown> & { returnObjects?: boolean }): any {
  const value = lookup(key) ?? key;
  if (Array.isArray(value)) return vars?.returnObjects ? value : value[0];
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars?.[name] ?? ""));
}

const i18n = {
  get language() {
    return currentLanguage;
  },
  dir: () => (currentLanguage === "ar" ? "rtl" : "ltr"),
};

export function useTranslation() {
  return { t, i18n };
}
