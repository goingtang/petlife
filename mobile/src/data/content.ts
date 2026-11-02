// Extracted from the PetPal web prototype (petpal-data.js / petpal-tools.js), zh-TW only.
/* eslint-disable */
export const CONTENT = {
 "toxic": [
  {
   "id": "choc",
   "cat": "食物",
   "lv": [
    3,
    3,
    3,
    3
   ],
   "name": "巧克力",
   "note": "可可鹼會造成心律不整"
  },
  {
   "id": "grape",
   "cat": "食物",
   "lv": [
    3,
    2,
    1,
    2
   ],
   "name": "葡萄、葡萄乾",
   "note": "可能引起急性腎衰竭"
  },
  {
   "id": "onion",
   "cat": "食物",
   "lv": [
    3,
    3,
    2,
    2
   ],
   "name": "洋蔥、蔥、韭菜",
   "note": "破壞紅血球，煮熟也有毒"
  },
  {
   "id": "garlic",
   "cat": "食物",
   "lv": [
    2,
    3,
    2,
    2
   ],
   "name": "大蒜",
   "note": "和洋蔥同類，會破壞紅血球；同重量下毒性比洋蔥更強，煮熟也有毒"
  },
  {
   "id": "xylitol",
   "cat": "食物",
   "lv": [
    3,
    1,
    1,
    2
   ],
   "name": "木糖醇（口香糖）",
   "note": "狗吃少量就會低血糖"
  },
  {
   "id": "avocado",
   "cat": "食物",
   "lv": [
    2,
    2,
    3,
    3
   ],
   "name": "酪梨",
   "note": "鳥和兔子特別危險"
  },
  {
   "id": "caffeine",
   "cat": "食物",
   "lv": [
    3,
    3,
    3,
    3
   ],
   "name": "咖啡、茶",
   "note": "咖啡因刺激心臟與神經"
  },
  {
   "id": "alcohol",
   "cat": "食物",
   "lv": [
    3,
    3,
    3,
    3
   ],
   "name": "酒精",
   "note": "少量就可能中毒"
  },
  {
   "id": "macadamia",
   "cat": "食物",
   "lv": [
    2,
    1,
    1,
    1
   ],
   "name": "夏威夷豆",
   "note": "狗會無力、發抖"
  },
  {
   "id": "apple",
   "cat": "食物",
   "lv": [
    0,
    0,
    1,
    1
   ],
   "name": "蘋果（去籽）",
   "note": "果核和籽要去掉"
  },
  {
   "id": "carrot",
   "cat": "食物",
   "lv": [
    0,
    0,
    1,
    0
   ],
   "name": "紅蘿蔔",
   "note": "對兔子糖分偏高，當點心少量給"
  },
  {
   "id": "lily",
   "cat": "植物",
   "lv": [
    1,
    3,
    2,
    1
   ],
   "name": "百合",
   "note": "貓碰到花粉也可能腎衰竭"
  },
  {
   "id": "pothos",
   "cat": "植物",
   "lv": [
    2,
    2,
    2,
    2
   ],
   "name": "黃金葛",
   "note": "口腔灼熱、流口水"
  },
  {
   "id": "aloe",
   "cat": "植物",
   "lv": [
    2,
    2,
    2,
    1
   ],
   "name": "蘆薈",
   "note": "嘔吐、腹瀉"
  },
  {
   "id": "permethrin",
   "cat": "居家用品",
   "lv": [
    1,
    3,
    2,
    2
   ],
   "name": "犬用除蚤滴劑",
   "note": "絕對不能用在貓身上"
  },
  {
   "id": "oils",
   "cat": "居家用品",
   "lv": [2, 3, 2, 3],
   "name": "精油、薰香",
   "note": "貓和鳥無法代謝；狗舔食或高濃度擴香也可能中毒"
  },
  {
   "id": "ptfe",
   "cat": "居家用品",
   "lv": [
    1,
    1,
    2,
    3
   ],
   "name": "不沾鍋空燒的煙",
   "note": "鳥吸入幾分鐘內就可能致命"
  },
  {
   "id": "mothball",
   "cat": "居家用品",
   "lv": [
    3,
    3,
    3,
    3
   ],
   "name": "樟腦丸",
   "note": "傷肝與紅血球"
  },
  {
   "id": "ibuprofen",
   "cat": "藥物",
   "lv": [
    3,
    3,
    3,
    3
   ],
   "name": "布洛芬等止痛藥",
   "note": "胃出血、腎損傷"
  },
  {
   "id": "paracetamol",
   "cat": "藥物",
   "lv": [3, 3, 3, 3],
   "name": "普拿疼（乙醯胺酚）",
   "note": "狗也可能肝損傷；貓吃一顆就可能致命，極度危險"
  }
 ],
 "firstAid": [
  {
   "id": "fa_heat",
   "name": "中暑",
   "steps": [
    "移到陰涼處，用風扇吹。",
    "用常溫水（不要冰水）沾濕腳掌和腹部。",
    "即使好轉也要就醫檢查。"
   ]
  },
  {
   "id": "fa_poison",
   "name": "誤食毒物",
   "steps": [
    "移開剩餘物品，記下吃了什麼、多少、何時。",
    "不要自行催吐。",
    "帶著包裝立刻就醫。"
   ]
  },
  {
   "id": "fa_bleed",
   "name": "出血",
   "steps": [
    "用乾淨紗布直接按壓 5 分鐘。",
    "滲血時再疊一層，不要掀開。",
    "止不住或傷口深就立刻就醫。"
   ]
  },
  {
   "id": "fa_seizure",
   "name": "抽搐",
   "steps": [
    "移開周圍硬物，不要抱住或把手伸進嘴裡。",
    "計時並錄影給醫師看。",
    "超過 5 分鐘或連續發作，立刻就醫。"
   ]
  }
 ],
 "articles": [
  {
   "id": "a1",
   "cat": "狗",
   "color": "#F8E7BF",
   "mins": 4,
   "title": "帶狗狗回家的第一週",
   "lead": "第一週的重點是建立安全感與固定作息。",
   "steps": [
    "準備安靜的角落，放睡墊和有你氣味的舊衣服。",
    "餵食、散步、睡覺時間盡量固定，前三天減少訪客。",
    "一週內預約健康檢查，完成寵物登記與晶片。"
   ]
  },
  {
   "id": "a2",
   "cat": "貓",
   "color": "#F6DCCF",
   "mins": 3,
   "title": "新手貓砂盆這樣放",
   "lead": "貓砂盆的位置與清潔，直接影響貓咪會不會亂尿。",
   "steps": [
    "數量建議為「貓的數量 + 1」。",
    "放在安靜好進出的地方，遠離食碗與水碗。",
    "每天鏟砂；若頻繁進出卻尿不出來，請盡快就醫。"
   ]
  },
  {
   "id": "a3",
   "cat": "兔子",
   "color": "#E3EBDD",
   "mins": 3,
   "title": "兔子的飲食金字塔",
   "lead": "兔子的牙齒會持續生長，正確飲食同時照顧腸胃與牙齒。",
   "steps": [
    "牧草佔每日飲食 80% 以上，無限量供應。",
    "新鮮葉菜每天適量，新品項一次只加一種。",
    "兔飼料限量，水果只當偶爾的獎勵。"
   ]
  },
  {
   "id": "a4",
   "cat": "鳥",
   "color": "#DDE6EE",
   "mins": 4,
   "title": "鳥寵的居住環境",
   "lead": "鳥類呼吸系統敏感，空氣品質特別重要。",
   "steps": [
    "籠子寬度至少為翅膀展開的兩倍。",
    "遠離廚房油煙，避免高溫空燒不沾鍋。",
    "準備不同粗細的棲木，每天安排籠外活動。"
   ]
  },
  {
   "id": "a5",
   "cat": "爬蟲",
   "color": "#E6E2C8",
   "mins": 5,
   "title": "爬蟲的溫度與 UVB 燈",
   "lead": "爬蟲無法自行調節體溫，飼養箱需要模擬自然的溫差。",
   "steps": [
    "設置溫度梯度：一側熱點，另一側較涼。",
    "依物種選擇 UVB 燈，並定期更換燈管。",
    "放置溫度計與濕度計，每天確認。"
   ]
  },
  {
   "id": "a6",
   "cat": "水族",
   "color": "#D7E7E4",
   "mins": 4,
   "title": "開缸前的養水與硝化",
   "lead": "新魚缸最常見的問題，是水質還沒穩定就放魚。",
   "steps": [
    "先養水 2–4 週，建立硝化菌。",
    "魚隻少量分批放入，觀察幾天再增加。",
    "每週換水約 10–20%，定期檢測氨與亞硝酸鹽。"
   ]
  },
  {
   "id": "a7",
   "cat": "小型哺乳類",
   "color": "#EEE0F0",
   "mins": 3,
   "title": "倉鼠的墊材與跑輪",
   "lead": "倉鼠喜歡挖洞，足夠的墊材能降低壓力。",
   "steps": [
    "墊材厚度建議 15 公分以上。",
    "跑輪要大到奔跑時背部不彎曲。",
    "避免有香味或針葉類的木屑。"
   ]
  }
 ],
 "scanRules": [
  {
   "label": "含蔥蒜類，對犬貓有毒",
   "good": false,
   "sev": 3,
   "kw": [
    "洋蔥",
    "洋葱",
    "大蒜",
    "onion",
    "garlic",
    "玉ねぎ",
    "にんにく",
    "ガーリック",
    "cebolla",
    "ajo"
   ]
  },
  {
   "label": "含木糖醇",
   "good": false,
   "sev": 3,
   "kw": [
    "木糖醇",
    "xylitol",
    "キシリトール",
    "xilitol"
   ]
  },
  {
   "label": "人工防腐劑 BHA／BHT／乙氧基喹",
   "good": false,
   "sev": 2,
   "kw": [
    "bha",
    "bht",
    "乙氧基喹",
    "ethoxyquin",
    "エトキシキン",
    "etoxiquina"
   ]
  },
  {
   "label": "人工色素",
   "good": false,
   "sev": 1,
   "kw": [
    "色素",
    "artificial color",
    "red 40",
    "yellow 5",
    "着色料",
    "colorante"
   ]
  },
  {
   "label": "來源不明的副產品",
   "good": false,
   "sev": 1,
   "kw": [
    "副產品",
    "副产品",
    "by-product",
    "byproduct",
    "副産物",
    "subproducto",
    "動物性油脂",
    "动物性油脂",
    "animal fat",
    "grasa animal"
   ]
  },
  {
   "label": "添加糖",
   "good": false,
   "sev": 1,
   "kw": [
    "蔗糖",
    "砂糖",
    "糖漿",
    "糖浆",
    "sugar",
    "syrup",
    "azúcar"
   ]
  },
  {
   "label": "含牛磺酸",
   "good": true,
   "sev": 0,
   "kw": [
    "牛磺酸",
    "taurine",
    "タウリン",
    "taurina"
   ]
  },
  {
   "label": "含魚油或 Omega-3",
   "good": true,
   "sev": 0,
   "kw": [
    "魚油",
    "鱼油",
    "omega",
    "オメガ",
    "亜麻仁",
    "亞麻仁",
    "亚麻籽",
    "fish oil",
    "salmon oil",
    "サーモンオイル",
    "aceite de salmón",
    "aceite de pescado",
    "flaxseed",
    "linaza"
   ]
  }
 ],
 "meat": [
  "雞",
  "鸡",
  "牛肉",
  "羊",
  "鴨",
  "鸭",
  "魚",
  "鱼",
  "鮭",
  "鲑",
  "火雞",
  "chicken",
  "beef",
  "lamb",
  "duck",
  "salmon",
  "fish",
  "turkey",
  "鶏",
  "チキン",
  "サーモン",
  "pollo",
  "cordero",
  "pato",
  "salmón",
  "pescado",
  "pavo"
 ],
 "filler": [
  "玉米",
  "小麥",
  "小麦",
  "corn",
  "wheat",
  "トウモロコシ",
  "maíz",
  "trigo"
 ],
 "sampleGood": "去骨雞肉、糙米、豌豆、鮭魚油、牛磺酸、維生素E、亞麻仁",
 "sampleBad": "玉米、肉類副產品、小麥、動物性油脂、BHA、人工色素、洋蔥粉、蔗糖",
 "meatFirst": "第一項是肉類",
 "fillerLabel": "前三項有玉米或小麥"
} as const;
