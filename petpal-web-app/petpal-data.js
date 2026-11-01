/* PetPal Diary — shared data, i18n and form schema. Exposes window.PetPalData */
(function(){
const VERSION=3, TODAY="2026/10/24", YESTERDAY="2026/10/23";
const LANGS=[{k:"zh-TW",name:"繁體中文",short:"繁中"},{k:"zh-CN",name:"简体中文",short:"简中"},{k:"en",name:"English",short:"EN"},{k:"ja",name:"日本語",short:"日本語"},{k:"es",name:"Español",short:"ES"}];
const IDX={"zh-TW":0,"zh-CN":1,en:2,ja:3,es:4};
// key: [繁中, 简中, English, 日本語, Español]
const U={
dateLabel:["10月24日 星期六","10月24日 星期六","Saturday, Oct 24","10月24日（土）","sábado, 24 de oct."],
greet:["早安，今天也好好照顧{name}吧","早上好，今天也要好好照顾{name}","Good morning! Let's take good care of {name} today","おはよう！今日も{name}のお世話をがんばろう","¡Buenos días! Cuidemos bien a {name} hoy"],
caregivers:["{n} 人共同照顧","{n} 人共同照顾","{n} caregivers","{n}人でお世話中","{n} cuidadores"],
addPet:["＋ 新增","＋ 新增","+ Add","＋ 追加","+ Añadir"],
addPetSoon:["新增寵物流程尚未開放","新增宠物流程尚未开放","Adding pets is coming soon","ペット追加は準備中です","Añadir mascotas, próximamente"],
viewProfile:["查看檔案 ›","查看档案 ›","View profile ›","プロフィール ›","Ver perfil ›"],
todayCare:["今日照護","今日照护","Today's care","今日のお世話","Cuidados de hoy"],
quickLog:["＋ 記錄","＋ 记录","+ Log","＋ 記録","+ Registrar"],
doneBy:["{who}已完成","{who}已完成","Done by {who}","{who}が完了","Hecho por {who}"],
turnOf:["{time} · 輪到{who}","{time} · 轮到{who}","{time} · {who}'s turn","{time} · {who}の番","{time} · turno de {who}"],
dueSoon:["即將到期","即将到期","Coming up","もうすぐ","Próximamente"],
daysLater:["天後","天后","days","日後","días"],
bookVet:["記得先預約醫院","记得提前预约医院","Remember to book the vet","病院の予約を忘れずに","Recuerda pedir cita"],
noUpcoming:["目前沒有待辦","目前没有待办","Nothing upcoming","予定はありません","Nada pendiente"],
newbieTip:["新手小知識","新手小知识","Tip for new owners","はじめての飼い主さんへ","Consejo para principiantes"],
readMore:["閱讀全文 ›","阅读全文 ›","Read more ›","続きを読む ›","Leer más ›"],
recentLogs:["最近紀錄","最近记录","Recent logs","最近の記録","Registros recientes"],
tabToday:["今天","今天","Today","今日","Hoy"],tabHealth:["健康","健康","Health","健康","Salud"],tabAct:["活動","活动","Activity","運動","Actividad"],tabLearn:["知識","知识","Learn","知識","Aprender"],tabNear:["附近","附近","Nearby","近く","Cerca"],
weight:["體重","体重","Weight","体重","Peso"],
vsLastTime:["較上次","较上次","vs last time","前回比","vs. la última vez"],
logGrowth:["記錄成長數據","记录成长数据","Log growth","成長を記録","Registrar crecimiento"],
remindersTitle:["疫苗與提醒","疫苗与提醒","Vaccines & reminders","ワクチン・リマインダー","Vacunas y recordatorios"],
addReminder:["＋ 提醒","＋ 提醒","+ Reminder","＋ 追加","+ Añadir"],
completed:["已完成","已完成","Done","完了","Hecho"],
inDays:["{n} 天後","{n} 天后","in {n} days","{n}日後","en {n} días"],
todayDue:["今天","今天","Today","今日","Hoy"],
healthRecords:["健康與看診紀錄","健康与看诊记录","Health & vet records","健康・通院記録","Salud y visitas"],
addHealth:["＋ 紀錄","＋ 记录","+ Log","＋ 記録","+ Registrar"],
showNotes:["查看備註","查看备注","View notes","メモを見る","Ver notas"],
collapse:["收合","收起","Hide","閉じる","Ocultar"],
actWalk:["散步","散步","Walk","お散歩","Paseo"],actPlay:["遊戲時間","游戏时间","Playtime","遊び時間","Juego"],actRoam:["放風時間","放风时间","Free roam","部屋んぽ","Tiempo libre"],
startWalk:["出門散步","出门散步","Start walk","散歩に出発","Empezar paseo"],startPlay:["開始逗貓","开始逗猫","Start playing","遊び開始","Empezar a jugar"],startRoam:["開始放風","开始放风","Start roaming","部屋んぽ開始","Empezar"],
running:["進行中","进行中","In progress","実施中","En curso"],paused:["已暫停","已暂停","Paused","一時停止中","En pausa"],readyQ:["準備好了嗎？","准备好了吗？","Ready?","準備OK？","¿Listos?"],
goal:["目標 {n} 分鐘","目标 {n} 分钟","Goal {n} min","目標 {n}分","Meta {n} min"],
pause:["暫停","暂停","Pause","一時停止","Pausar"],resume:["繼續","继续","Resume","再開","Reanudar"],finish:["完成並記錄","完成并记录","Finish & save","終了して記録","Terminar y guardar"],
thisWeek:["這週","这周","This week","今週","Esta semana"],totalMin:["共 {n} 分鐘","共 {n} 分钟","{n} min total","合計 {n}分","{n} min en total"],
history:["紀錄","记录","History","履歴","Historial"],min:["分鐘","分钟","min","分","min"],
weekdays:["日,一,二,三,四,五,今","日,一,二,三,四,五,今","Su,Mo,Tu,We,Th,Fr,Sa","日,月,火,水,木,金,今日","Do,Lu,Ma,Mi,Ju,Vi,Hoy"],
actSaved:["已記錄 {n} 分鐘{x}","已记录 {n} 分钟{x}","Saved {n} min of {x}","{x}を{n}分記録しました","Guardados {n} min de {x}"],
learnTitle:["新手知識庫","新手知识库","Starter guides","はじめてガイド","Guías básicas"],
searchPh:["搜尋：餵食、疫苗、環境…","搜索：喂食、疫苗、环境…","Search: food, litter, heat…","検索：ごはん、トイレ…","Buscar: comida, arenero…"],
noResults:["找不到相關文章，換個關鍵字試試","找不到相关文章，换个关键词试试","No guides found. Try another word.","見つかりませんでした。別の言葉で検索してください","Sin resultados. Prueba otra palabra."],
minRead:["{n} 分鐘閱讀","{n} 分钟阅读","{n} min read","{n}分で読める","{n} min de lectura"],
back:["‹ 返回","‹ 返回","‹ Back","‹ 戻る","‹ Atrás"],
disclaimer:["內容為一般照護建議，實際狀況請依獸醫師評估。","内容为一般护理建议，具体情况请遵从兽医评估。","General guidance only. Always follow your vet's advice.","一般的なアドバイスです。実際は獣医師の判断に従ってください。","Información general. Sigue siempre el consejo de tu veterinario."],
saveArticle:["收藏這篇","收藏这篇","Save guide","保存する","Guardar"],savedArticle:["已收藏 ✓","已收藏 ✓","Saved ✓","保存済み ✓","Guardado ✓"],savedToast:["已加入收藏","已加入收藏","Saved to your guides","保存しました","Guardado"],
nearTitle:["附近與社群","附近与社区","Nearby & community","近くとコミュニティ","Cerca y comunidad"],
segNear:["附近","附近","Nearby","近く","Cerca"],segFeed:["社群","社区","Community","コミュニティ","Comunidad"],
all:["全部","全部","All","すべて","Todo"],hospital:["醫院","医院","Vets","病院","Clínicas"],shop:["用品店","用品店","Shops","ショップ","Tiendas"],exotic:["異寵","异宠","Exotics","エキゾチック","Exóticos"],
navigate:["導航","导航","Directions","ルート","Cómo llegar"],call:["致電","致电","Call","電話","Llamar"],
navTo:["開始導航到{x}","开始导航到{x}","Directions to {x}","{x}へのルート","Ruta a {x}"],callTo:["撥打給{x}","拨打给{x}","Calling {x}","{x}に発信","Llamando a {x}"],
open24:["24 小時營業","24 小时营业","Open 24 h","24時間営業","Abierto 24 h"],openUntil:["營業中 · 至 {t}","营业中 · 至 {t}","Open until {t}","{t}まで営業","Abierto hasta las {t}"],closedToday:["今日公休","今日休息","Closed today","本日定休","Cerrado hoy"],
comments:["{n} 則留言","{n} 条评论","{n} comments","コメント{n}件","{n} comentarios"],
hoursAgo:["{n} 小時前","{n} 小时前","{n}h ago","{n}時間前","hace {n} h"],justNow:["剛剛","刚刚","Just now","たった今","Ahora"],yesterday:["昨天","昨天","Yesterday","昨日","Ayer"],
language:["語言","语言","Language","言語","Idioma"],
meName:["我","我","Me","わたし","Yo"],momName:["媽媽","妈妈","Mom","ママ","Mamá"],jieName:["小傑","小杰","Jie","ジエ","Jie"],
loggedNotify:["已記錄，{names}會收到通知","已记录，{names}会收到通知","Saved. {names} will be notified","記録しました。{names}に通知します","Guardado. Avisaremos a {names}"],
and:["和","和"," & ","と"," y "],listSep:["、","、",", ","、",", "],
growthSaved:["成長數據已更新","成长数据已更新","Growth updated","成長記録を更新しました","Crecimiento actualizado"],
reminderSaved:["提醒已建立","提醒已创建","Reminder added","リマインダーを追加しました","Recordatorio creado"],
diarySaved:["日記已儲存","日记已保存","Diary saved","日記を保存しました","Diario guardado"],
contactSaved:["聯絡人已新增","联系人已添加","Contact added","連絡先を追加しました","Contacto añadido"],
chooseForm:["要記錄什麼？","要记录什么？","What would you like to log?","何を記録しますか？","¿Qué quieres registrar?"],
logFor:["幫{name}記錄","为{name}记录","Log for {name}","{name}の記録","Registro de {name}"],
fFeed:["餵食","喂食","Feeding","ごはん","Comida"],fHealth:["健康","健康","Health","健康","Salud"],fReminder:["提醒","提醒","Reminder","リマインダー","Recordatorio"],fGrowth:["成長","成长","Growth","成長","Crecimiento"],fDiary:["日記","日记","Diary","日記","Diario"],fContact:["緊急聯絡人","紧急联系人","Emergency contact","緊急連絡先","Contacto de emergencia"],
fFeedD:["食物與飲水","食物与饮水","Food & water","フード・水","Comida y agua"],fHealthD:["症狀、用藥、看診","症状、用药、看诊","Symptoms, meds, visits","症状・投薬・通院","Síntomas, medicinas, visitas"],fReminderD:["疫苗、驅蟲、回診","疫苗、驱虫、复诊","Vaccines, check-ups","ワクチン・再診","Vacunas, revisiones"],fGrowthD:["體重與體態","体重与体态","Weight & shape","体重・体型","Peso y complexión"],fDiaryD:["留住今天的小事","记下今天的小事","Today's little moments","今日の思い出","Momentos de hoy"],fContactD:["醫院、家人、保母","医院、家人、保姆","Vet, family, sitter","病院・家族・シッター","Clínica, familia, cuidador"],
foodType:["種類","种类","Type","種類","Tipo"],dry:["乾糧","干粮","Dry food","ドライフード","Pienso"],wet:["濕食","湿粮","Wet food","ウェット","Comida húmeda"],hay:["牧草","牧草","Hay","牧草","Heno"],veg:["蔬菜","蔬菜","Veggies","野菜","Verduras"],water:["飲水","饮水","Water","水","Agua"],treat:["零食","零食","Treat","おやつ","Premio"],
amount:["份量","份量","Amount","量","Cantidad"],uServing:["份","份","serving","食分","ración"],
appetite:["食慾","食欲","Appetite","食欲","Apetito"],good:["很好","很好","Good","良い","Bueno"],normal:["普通","一般","Normal","普通","Normal"],poor:["不太吃","不太吃","Poor","食べない","Poco"],
note:["備註","备注","Note","メモ","Nota"],notePh:["例如：剩下一半","例如：剩下一半","e.g. left half of it","例：半分残した","p. ej. dejó la mitad"],
hType:["類型","类型","Type","種類","Tipo"],symptom:["症狀","症状","Symptom","症状","Síntoma"],med:["用藥","用药","Medication","投薬","Medicación"],visit:["看診","看诊","Vet visit","通院","Visita"],poop:["排便","排便","Stool","排便","Heces"],
signs:["觀察到的狀況","观察到的状况","What you noticed","気になる様子","Lo que notaste"],vomit:["嘔吐","呕吐","Vomiting","嘔吐","Vómito"],diarrhea:["腹瀉","腹泻","Diarrhea","下痢","Diarrea"],itch:["搔癢","瘙痒","Itching","かゆみ","Picor"],lethargy:["沒精神","没精神","Lethargic","元気がない","Decaído"],cough:["咳嗽","咳嗽","Coughing","咳","Tos"],
severity:["嚴重程度","严重程度","Severity","重症度","Gravedad"],mild:["輕微","轻微","Mild","軽い","Leve"],moderate:["中等","中等","Moderate","中程度","Moderada"],severe:["嚴重","严重","Severe","重い","Grave"],
severeHint:["症狀嚴重時請直接聯絡醫院，不要只做紀錄。","症状严重时请直接联系医院，不要只做记录。","If it's severe, call your vet now rather than only logging it.","重い場合は記録だけでなく、すぐ病院に連絡してください。","Si es grave, llama al veterinario ahora."],
medName:["藥品名稱","药品名称","Medicine","薬の名前","Medicamento"],medPh:["例如：外用藥膏","例如：外用药膏","e.g. skin ointment","例：塗り薬","p. ej. pomada"],
clinic:["醫院","医院","Clinic","病院","Clínica"],clinicPh:["例如：安心動物醫院","例如：安心动物医院","e.g. Anxin Animal Hospital","例：安心動物病院","p. ej. Hospital Anxin"],
stool:["狀態","状态","Condition","状態","Estado"],sNormal:["正常","正常","Normal","普通","Normal"],sSoft:["偏軟","偏软","Soft","やわらかい","Blandas"],sHard:["偏硬","偏硬","Hard","かたい","Duras"],
rTitle:["提醒事項","提醒事项","What","内容","Qué"],rTitlePh:["例如：狂犬病疫苗","例如：狂犬病疫苗","e.g. Rabies vaccine","例：狂犬病ワクチン","p. ej. vacuna antirrábica"],rDate:["日期","日期","Date","日付","Fecha"],
rRepeat:["重複","重复","Repeat","繰り返し","Repetir"],once:["不重複","不重复","Once","なし","Una vez"],monthly:["每月","每月","Monthly","毎月","Mensual"],yearly:["每年","每年","Yearly","毎年","Anual"],rNotify:["提前一天通知家人","提前一天通知家人","Notify family a day before","前日に家族へ通知","Avisar a la familia un día antes"],
gWeight:["體重","体重","Weight","体重","Peso"],gLength:["身長","身长","Body length","体長","Longitud"],gBody:["體態","体态","Body shape","体型","Complexión"],thin:["偏瘦","偏瘦","Thin","やせ気味","Delgado"],ideal:["理想","理想","Ideal","理想","Ideal"],chubby:["偏胖","偏胖","Chubby","ぽっちゃり","Rellenito"],
gTip:["小技巧：先抱著{name}一起量，再減去自己的體重。每月固定同一天測量最準。","小技巧：先抱着{name}一起称，再减去自己的体重。每月固定同一天测量最准。","Tip: weigh yourself holding {name}, then subtract your own weight. Same day each month is most accurate.","コツ：{name}を抱いて量り、自分の体重を引く。毎月同じ日に量ると正確です。","Truco: pésate con {name} en brazos y resta tu peso. Mismo día cada mes."],
dMood:["今天的心情","今天的心情","Mood today","今日の気分","Ánimo de hoy"],happy:["開心","开心","Happy","ごきげん","Feliz"],calm:["平靜","平静","Calm","おだやか","Tranquilo"],clingy:["黏人","粘人","Clingy","甘えん坊","Mimoso"],grumpy:["鬧脾氣","闹脾气","Grumpy","ご機嫌ななめ","Gruñón"],
dTitle:["標題","标题","Title","タイトル","Título"],dTitlePh:["例如：第一次去海邊","例如：第一次去海边","e.g. First trip to the beach","例：はじめての海","p. ej. Primera vez en la playa"],
dBody:["今天發生了什麼？","今天发生了什么？","What happened today?","今日の出来事","¿Qué pasó hoy?"],dBodyPh:["記下想留住的小事…","记下想留住的小事…","Write down the little moments…","残しておきたい小さなこと…","Anota los pequeños momentos…"],dShare:["同時分享到社群","同时分享到社区","Also share to community","コミュニティにも共有","Compartir también en la comunidad"],
cName:["姓名／名稱","姓名／名称","Name","名前","Nombre"],cNamePh:["例如：王醫師","例如：王医生","e.g. Dr. Wang","例：王先生","p. ej. Dra. Wang"],cRel:["關係","关系","Relationship","関係","Relación"],vet:["主治醫院","主治医院","Primary vet","かかりつけ","Veterinario"],family:["家人","家人","Family","家族","Familia"],sitter:["保母","保姆","Pet sitter","シッター","Cuidador"],neighbor:["鄰居","邻居","Neighbor","ご近所","Vecino"],
cPhone:["電話","电话","Phone","電話番号","Teléfono"],cPhonePh:["例如：0912-345-678","例如：138-0000-0000","e.g. 0912-345-678","例：090-1234-5678","p. ej. 612 345 678"],cPrimary:["設為第一聯絡人","设为第一联系人","Set as primary contact","優先連絡先にする","Contacto principal"],
required:["必填","必填","Required","必須","Obligatorio"],errRequired:["請填寫{field}","请填写{field}","Please fill in {field}","{field}を入力してください","Completa: {field}"],errPick:["請至少選一項","请至少选一项","Pick at least one","1つ以上選んでください","Elige al menos uno"],errPhone:["電話格式不正確","电话格式不正确","That phone number doesn't look right","電話番号の形式が正しくありません","El teléfono no es válido"],errDate:["請選擇日期","请选择日期","Please pick a date","日付を選んでください","Elige una fecha"],
saveNotify:["儲存 · 通知家人","保存 · 通知家人","Save & notify family","保存して家族に通知","Guardar y avisar"],saveBtn:["儲存","保存","Save","保存","Guardar"],
profile:["寵物檔案","宠物档案","Pet profile","プロフィール","Perfil"],basicInfo:["基本資料","基本资料","Basics","基本情報","Datos básicos"],birthday:["生日","生日","Birthday","誕生日","Cumpleaños"],chip:["晶片號碼","芯片号码","Microchip","マイクロチップ","Microchip"],allergy:["過敏","过敏","Allergies","アレルギー","Alergias"],none:["無","无","None","なし","Ninguna"],
male:["公","公","Male","オス","Macho"],female:["母","母","Female","メス","Hembra"],neutered:["已結紮","已绝育","Neutered","避妊・去勢済み","Esterilizado"],
contacts:["緊急聯絡人","紧急联系人","Emergency contacts","緊急連絡先","Contactos de emergencia"],primary:["第一聯絡人","第一联系人","Primary","優先","Principal"],
diary:["成長日記","成长日记","Diary","成長日記","Diario"],writeDiary:["＋ 寫日記","＋ 写日记","+ Write","＋ 書く","+ Escribir"],
currentWeight:["目前體重","当前体重","Weight","現在の体重","Peso actual"],daysTogether:["相處天數","相处天数","Days together","一緒に過ごした日","Días juntos"],logsToday:["今日紀錄","今日记录","Logs today","今日の記録","Registros hoy"],
alChicken:["雞肉","鸡肉","Chicken","鶏肉","Pollo"],
bDou:["柴犬","柴犬","Shiba Inu","柴犬","Shiba inu"],bMochi:["米克斯","中华田园猫","Mixed breed","ミックス","Mestizo"],bBai:["荷蘭侏儒兔","荷兰侏儒兔","Netherland Dwarf","ネザーランドドワーフ","Enano holandés"],
aDou:["2 歲","2 岁","2 yrs","2歳","2 años"],aMochi:["1 歲","1 岁","1 yr","1歳","1 año"],aBai:["8 個月","8 个月","8 mo","8ヶ月","8 meses"],
bCorgi:["柯基","柯基","Corgi","コーギー","Corgi"],bConure:["小太陽鸚鵡","小太阳鹦鹉","Sun conure","コガネメキシコインコ","Cotorra sol"],bHamster:["倉鼠","仓鼠","Hamster","ハムスター","Hámster"],
tWalkAM:["晨間散步","晨间散步","Morning walk","朝の散歩","Paseo matutino"],tBreakfastDry:["早餐 · 乾糧 1 份","早餐 · 干粮 1 份","Breakfast · 1 serving dry","朝ごはん · ドライ1食分","Desayuno · 1 ración"],tWater:["換新鮮的水","换新鲜的水","Fresh water","お水を交換","Agua fresca"],tDinnerDry:["晚餐 · 乾糧 1 份","晚餐 · 干粮 1 份","Dinner · 1 serving dry","夜ごはん · ドライ1食分","Cena · 1 ración"],tWalkPM:["晚間散步","晚间散步","Evening walk","夜の散歩","Paseo nocturno"],
tBreakfastWet:["早餐 · 濕食 1 罐","早餐 · 湿粮 1 罐","Breakfast · 1 can wet food","朝ごはん · ウェット1缶","Desayuno · 1 lata"],tLitter:["鏟貓砂","铲猫砂","Scoop the litter","トイレ掃除","Limpiar arenero"],tPlay:["逗貓 15 分鐘","逗猫 15 分钟","Play for 15 min","15分遊ぶ","Jugar 15 min"],
tHay:["補滿牧草","补满牧草","Refill hay","牧草を補充","Rellenar heno"],tVeg:["新鮮葉菜","新鲜叶菜","Fresh greens","葉野菜","Verduras frescas"],tRoam:["放風 1 小時","放风 1 小时","Free roam 1 h","部屋んぽ1時間","Tiempo libre 1 h"],tToilet:["清理便盆","清理便盆","Clean the toilet","トイレ掃除","Limpiar bandeja"],
v8in1:["八合一疫苗","八联疫苗","8-in-1 vaccine","8種混合ワクチン","Vacuna óctuple"],vRabies:["狂犬病疫苗","狂犬病疫苗","Rabies vaccine","狂犬病ワクチン","Vacuna antirrábica"],vHeartworm:["心絲蟲預防藥","心丝虫预防药","Heartworm prevention","フィラリア予防薬","Prevención de dirofilaria"],v3in1:["三合一疫苗","猫三联疫苗","3-in-1 vaccine","3種混合ワクチン","Vacuna triple felina"],vDeworm:["體內外驅蟲","体内外驱虫","Deworming","ノミ・ダニ・虫下し","Desparasitación"],vCheckup:["年度健康檢查","年度健康检查","Annual checkup","年次健康診断","Revisión anual"],vNails:["剪趾甲","剪指甲","Nail trim","爪切り","Corte de uñas"],vTeeth:["牙齒檢查","牙齿检查","Dental check","歯のチェック","Revisión dental"],
vnDou:["診斷為輕微過敏性皮膚炎，外用藥膏一天兩次，連續 7 天。","诊断为轻微过敏性皮炎，外用药膏一天两次，连续 7 天。","Mild allergic dermatitis. Apply ointment twice a day for 7 days.","軽いアレルギー性皮膚炎。塗り薬を1日2回、7日間。","Dermatitis alérgica leve. Pomada dos veces al día durante 7 días."],
vnMochi:["結紮術後回診，傷口癒合良好，可拆除頭套。","绝育术后复诊，伤口愈合良好，可以摘掉头套。","Post-spay check: healing well, the cone can come off.","避妊手術後の再診。傷はきれいに治り、カラーを外してOK。","Revisión tras la esterilización: buena cicatrización, ya sin cono."],
vnBai:["牙齒咬合正常，建議增加牧草量，水果每週不超過 2 次。","牙齿咬合正常，建议增加牧草量，水果每周不超过 2 次。","Teeth look good. Offer more hay; fruit no more than twice a week.","歯の噛み合わせは正常。牧草を増やし、果物は週2回までに。","Dientes bien. Más heno; fruta como máximo dos veces por semana."],
plAnxin:["安心動物醫院","安心动物医院","Anxin Animal Hospital","安心動物病院","Hospital Veterinario Anxin"],plForest:["森林異寵專科","森林异宠专科","Forest Exotic Vet","森のエキゾチック動物病院","Clínica de Exóticos Bosque"],plDaily:["毛孩日常用品店","毛孩日常用品店","Furry Daily Pet Shop","毛孩デイリー","Tienda Furry Daily"],plBlue:["藍海水族館","蓝海水族馆","Blue Sea Aquatics","ブルーシー水族館","Acuarios Mar Azul"],
tgDogCat:["犬貓","犬猫","Dogs & cats","犬・猫","Perros y gatos"],tgER:["急診","急诊","Emergency","救急","Urgencias"],tgFood:["飼料","饲料","Food","フード","Comida"],tgGroom:["美容","美容","Grooming","トリミング","Peluquería"],
catDog:["狗","狗","Dogs","犬","Perros"],catCat:["貓","猫","Cats","猫","Gatos"],catRabbit:["兔子","兔子","Rabbits","うさぎ","Conejos"],catBird:["鳥","鸟","Birds","鳥","Aves"],catReptile:["爬蟲","爬虫","Reptiles","爬虫類","Reptiles"],catFish:["水族","水族","Aquatics","アクア","Acuarios"],catSmall:["小型哺乳類","小型哺乳类","Small pets","小動物","Pequeños"],
dTDou:["第一次去河堤","第一次去河堤","First trip to the riverside","はじめての河川敷","Primera vez en el río"],dBDou:["一路追著蝴蝶跑，回家後秒睡。","一路追着蝴蝶跑，回家后秒睡。","Chased butterflies the whole way and fell asleep the moment we got home.","ずっと蝶を追いかけて、帰ったらすぐ寝ちゃった。","Persiguió mariposas todo el camino y se durmió nada más llegar."],
dTMochi:["今天一直跟著我","今天一直跟着我","Followed me around all day","一日中ついてきた","Me siguió todo el día"],dBMochi:["在家工作的時候，麻糬整天趴在鍵盤旁邊。","在家工作的时候，麻糬整天趴在键盘旁边。","Mochi spent my whole work-from-home day lying next to the keyboard.","在宅勤務中、麻糬はずっとキーボードの横にいた。","Mochi pasó todo mi día de teletrabajo junto al teclado."],
dTBai:["學會用便盆了","学会用便盆了","Learned to use the litter box","トイレを覚えた","Ya usa la bandeja"],dBBai:["連續三天都在便盆裡上廁所，獎勵一片蘋果。","连续三天都在便盆里上厕所，奖励一片苹果。","Three days in a row in the litter box. Rewarded with a slice of apple.","3日連続でトイレ成功。ごほうびにリンゴを一切れ。","Tres días seguidos usando la bandeja. Premio: una rodaja de manzana."],
po1:["今天第一次挑戰河堤 5 公里，回家後秒睡。","今天第一次挑战河堤 5 公里，回家后秒睡。","First 5 km along the river today. Asleep the second we got home.","今日は初めて河川敷を5km。帰宅後すぐ爆睡。","Hoy, primeros 5 km junto al río. Se durmió al llegar."],
po2:["球球學會說「早安」了！每天練習 10 分鐘，大概花了兩週。","球球学会说“早安”了！每天练习 10 分钟，大概花了两周。","Qiuqiu learned to say \"good morning\"! 10 minutes of practice a day for about two weeks.","球球が「おはよう」を覚えた！毎日10分、約2週間。","¡Qiuqiu aprendió a decir \"buenos días\"! 10 minutos al día durante dos semanas."],
po3:["照著知識庫把墊材加到 15 公分，布丁馬上挖了一條隧道。","照着知识库把垫材加到 15 厘米，布丁马上挖了一条隧道。","Followed the guide and added bedding up to 15 cm. Pudding dug a tunnel right away.","ガイド通り床材を15cmにしたら、プリンがすぐトンネルを掘った。","Seguí la guía y subí el sustrato a 15 cm. Pudín cavó un túnel enseguida."]
};
const ARTICLES=[
 {id:"a1",cat:"catDog",color:"#F8E7BF",mins:4,
  t:["帶狗狗回家的第一週","带狗狗回家的第一周","Your dog's first week at home","犬を迎えて最初の1週間","La primera semana de tu perro"],
  l:["第一週的重點是建立安全感與固定作息。","第一周的重点是建立安全感和固定作息。","The first week is about safety and a steady routine.","最初の1週間は安心感と決まった生活リズムづくりが大切。","La primera semana se trata de seguridad y rutina."],
  s:[["準備安靜的角落，放睡墊和有你氣味的舊衣服。","准备一个安静的角落，放上睡垫和有你气味的旧衣服。","Set up a quiet corner with a bed and an old shirt that smells like you.","静かな場所にベッドと飼い主のにおいのする古着を。","Prepara un rincón tranquilo con cama y una prenda con tu olor."],
     ["餵食、散步、睡覺時間盡量固定，前三天減少訪客。","喂食、散步、睡觉时间尽量固定，前三天减少访客。","Keep meals, walks and sleep at fixed times; limit visitors for three days.","ごはん・散歩・睡眠の時間を固定し、最初の3日は来客を控える。","Horarios fijos de comida, paseo y sueño; pocas visitas los tres primeros días."],
     ["一週內預約健康檢查，完成寵物登記與晶片。","一周内预约健康检查，完成宠物登记与芯片。","Book a checkup within a week and register the microchip.","1週間以内に健康診断を予約し、マイクロチップ登録を。","Pide una revisión esa semana y registra el microchip."]]},
 {id:"a2",cat:"catCat",color:"#F6DCCF",mins:3,
  t:["新手貓砂盆這樣放","新手猫砂盆这样放","Setting up the litter box","はじめての猫トイレ","Cómo colocar el arenero"],
  l:["貓砂盆的位置與清潔，直接影響貓咪會不會亂尿。","猫砂盆的位置和清洁，直接影响猫咪会不会乱尿。","Location and cleanliness decide whether your cat uses it.","置き場所と清潔さが粗相を防ぐカギ。","La ubicación y la limpieza deciden si tu gato lo usa."],
  s:[["數量建議為「貓的數量 + 1」。","数量建议为“猫的数量 + 1”。","Have one box per cat, plus one.","トイレの数は「猫の数＋1」が目安。","Un arenero por gato, más uno."],
     ["放在安靜好進出的地方，遠離食碗與水碗。","放在安静、方便进出的地方，远离食碗和水碗。","Place it somewhere quiet, away from food and water.","静かで出入りしやすく、食器から離れた場所に。","En un lugar tranquilo, lejos de la comida y el agua."],
     ["每天鏟砂；若頻繁進出卻尿不出來，請盡快就醫。","每天铲砂；如果频繁进出却尿不出来，请尽快就医。","Scoop daily. If your cat strains without peeing, see a vet quickly.","毎日掃除を。何度も入るのに尿が出ない時はすぐ病院へ。","Limpia a diario. Si entra a menudo sin orinar, ve al veterinario."]]},
 {id:"a3",cat:"catRabbit",color:"#E3EBDD",mins:3,
  t:["兔子的飲食金字塔","兔子的饮食金字塔","The rabbit food pyramid","うさぎの食事ピラミッド","La pirámide alimentaria del conejo"],
  l:["兔子的牙齒會持續生長，正確飲食同時照顧腸胃與牙齒。","兔子的牙齿会持续生长，正确饮食同时照顾肠胃和牙齿。","Rabbit teeth never stop growing; the right diet protects teeth and gut.","うさぎの歯は伸び続けるので、食事が歯とお腹を守ります。","Sus dientes crecen siempre; la dieta correcta cuida dientes e intestino."],
  s:[["牧草佔每日飲食 80% 以上，無限量供應。","牧草占每日饮食 80% 以上，无限量供应。","Hay should be 80%+ of the diet, available at all times.","牧草は食事の8割以上、常に食べ放題に。","El heno debe ser más del 80 % de la dieta, siempre disponible."],
     ["新鮮葉菜每天適量，新品項一次只加一種。","新鲜叶菜每天适量，新品种一次只加一种。","Offer fresh greens daily; introduce one new type at a time.","葉野菜は毎日適量。新しい野菜は1種類ずつ。","Verduras frescas a diario; introduce una nueva cada vez."],
     ["兔飼料限量，水果只當偶爾的獎勵。","兔粮限量，水果只当偶尔的奖励。","Limit pellets; fruit is an occasional treat only.","ペレットは控えめに、果物はたまのごほうびに。","Limita el pienso; la fruta, solo como premio ocasional."]]},
 {id:"a4",cat:"catBird",color:"#DDE6EE",mins:4,
  t:["鳥寵的居住環境","鸟宠的居住环境","A healthy home for pet birds","小鳥のすみか作り","Un hogar sano para tu ave"],
  l:["鳥類呼吸系統敏感，空氣品質特別重要。","鸟类呼吸系统敏感，空气质量特别重要。","Birds have sensitive lungs, so air quality matters most.","鳥は呼吸器が敏感なので空気の質が重要。","Las aves tienen pulmones sensibles; el aire es clave."],
  s:[["籠子寬度至少為翅膀展開的兩倍。","笼子宽度至少为翅膀展开的两倍。","The cage should be at least twice the bird's wingspan wide.","ケージの幅は翼を広げた長さの2倍以上。","La jaula debe medir al menos el doble de su envergadura."],
     ["遠離廚房油煙，避免高溫空燒不沾鍋。","远离厨房油烟，避免高温空烧不粘锅。","Keep away from kitchen fumes and overheated non-stick pans.","台所の煙や空焚きしたフッ素加工鍋から遠ざける。","Lejos del humo de cocina y sartenes antiadherentes muy calientes."],
     ["準備不同粗細的棲木，每天安排籠外活動。","准备不同粗细的栖木，每天安排笼外活动。","Offer perches of different widths and daily time outside the cage.","太さの違う止まり木を用意し、毎日放鳥タイムを。","Pon perchas de distintos grosores y déjala salir a diario."]]},
 {id:"a5",cat:"catReptile",color:"#E6E2C8",mins:5,
  t:["爬蟲的溫度與 UVB 燈","爬虫的温度与 UVB 灯","Heat and UVB for reptiles","爬虫類の温度とUVBライト","Calor y UVB para reptiles"],
  l:["爬蟲無法自行調節體溫，飼養箱需要模擬自然的溫差。","爬虫无法自行调节体温，饲养箱需要模拟自然的温差。","Reptiles can't regulate body heat, so the enclosure has to.","爬虫類は体温を自分で調整できないため、ケージで温度差を作ります。","Los reptiles no regulan su temperatura; el terrario debe hacerlo."],
  s:[["設置溫度梯度：一側熱點，另一側較涼。","设置温度梯度：一侧热点，另一侧较凉。","Create a gradient: a basking spot on one side, cooler on the other.","片側にホットスポット、反対側は涼しく温度勾配を作る。","Crea un gradiente: zona caliente en un lado, fresca en el otro."],
     ["依物種選擇 UVB 燈，並定期更換燈管。","根据物种选择 UVB 灯，并定期更换灯管。","Choose UVB for the species and replace bulbs on schedule.","種類に合ったUVBライトを選び、定期的に交換。","Elige UVB según la especie y cambia el tubo a tiempo."],
     ["放置溫度計與濕度計，每天確認。","放置温度计和湿度计，每天确认。","Use a thermometer and hygrometer and check them daily.","温度計と湿度計を置いて毎日確認。","Usa termómetro e higrómetro y revísalos a diario."]]},
 {id:"a6",cat:"catFish",color:"#D7E7E4",mins:4,
  t:["開缸前的養水與硝化","开缸前的养水与硝化","Cycling a new aquarium","水槽の立ち上げと水づくり","Ciclar un acuario nuevo"],
  l:["新魚缸最常見的問題，是水質還沒穩定就放魚。","新鱼缸最常见的问题，是水质还没稳定就放鱼。","The most common mistake is adding fish before the water is ready.","よくある失敗は、水が安定する前に魚を入れること。","El error más común es añadir peces antes de tiempo."],
  s:[["先養水 2–4 週，建立硝化菌。","先养水 2–4 周，建立硝化菌。","Cycle the tank for 2–4 weeks to grow beneficial bacteria.","2〜4週間かけてろ過バクテリアを育てる。","Cicla el acuario 2–4 semanas para crear bacterias."],
     ["魚隻少量分批放入，觀察幾天再增加。","鱼只少量分批放入，观察几天再增加。","Add a few fish at a time and wait a few days before adding more.","魚は少しずつ入れ、数日様子を見てから追加。","Añade pocos peces y espera unos días antes de más."],
     ["每週換水約 10–20%，定期檢測氨與亞硝酸鹽。","每周换水约 10–20%，定期检测氨和亚硝酸盐。","Change 10–20% of the water weekly and test ammonia and nitrite.","毎週10〜20%換水し、アンモニアと亜硝酸を測定。","Cambia 10–20 % del agua cada semana y mide amoníaco y nitritos."]]},
 {id:"a7",cat:"catSmall",color:"#EEE0F0",mins:3,
  t:["倉鼠的墊材與跑輪","仓鼠的垫材与跑轮","Hamster bedding and wheels","ハムスターの床材と回し車","Sustrato y rueda para hámster"],
  l:["倉鼠喜歡挖洞，足夠的墊材能降低壓力。","仓鼠喜欢挖洞，足够的垫材能降低压力。","Hamsters love to burrow; deep bedding lowers stress.","ハムスターは穴掘りが大好き。床材を厚くしてストレス軽減。","Les encanta excavar; un sustrato profundo reduce el estrés."],
  s:[["墊材厚度建議 15 公分以上。","垫材厚度建议 15 厘米以上。","Aim for at least 15 cm of bedding.","床材は15cm以上が目安。","Al menos 15 cm de sustrato."],
     ["跑輪要大到奔跑時背部不彎曲。","跑轮要大到奔跑时背部不弯曲。","The wheel should be big enough that the back stays straight.","回し車は走っても背中が反らない大きさに。","La rueda debe ser grande para no curvar la espalda."],
     ["避免有香味或針葉類的木屑。","避免有香味或针叶类的木屑。","Avoid scented or pine/cedar shavings.","香り付きや針葉樹のウッドチップは避ける。","Evita virutas perfumadas o de pino/cedro."]]}];
Object.assign(U,{
customize:["個人化","个性化","Personalize","カスタマイズ","Personalizar"],
customizeSub:["背景顏色與首頁排版","背景颜色与首页布局","Background & home layout","背景色とホームの並び","Fondo y diseño de inicio"],
bgColor:["背景顏色","背景颜色","Background","背景色","Fondo"],
homeLayout:["首頁排版","首页布局","Home layout","ホームの並び","Diseño de inicio"],
layoutHint:["用箭頭調整順序，用開關顯示或隱藏區塊。","用箭头调整顺序，用开关显示或隐藏区块。","Use the arrows to reorder and the switches to show or hide.","矢印で並べ替え、スイッチで表示・非表示を切り替えます。","Usa las flechas para ordenar y los interruptores para mostrar u ocultar."],
secHero:["寵物卡片","宠物卡片","Pet card","ペットカード","Tarjeta de mascota"],secCare:["今日照護","今日照护","Today's care","今日のお世話","Cuidados de hoy"],secReminder:["到期提醒","到期提醒","Upcoming reminder","リマインダー","Recordatorio"],secTip:["新手小知識","新手小知识","Tip for new owners","初心者向けヒント","Consejo"],secRecent:["最近紀錄","最近记录","Recent logs","最近の記録","Registros recientes"],
resetLayout:["恢復預設","恢复默认","Reset to default","元に戻す","Restablecer"],
thCream:["奶油","奶油","Cream","クリーム","Crema"],thSage:["鼠尾草","鼠尾草","Sage","セージ","Salvia"],thBlush:["蜜桃","蜜桃","Peach","ピーチ","Melocotón"],thSky:["霧藍","雾蓝","Mist","ミスト","Niebla"],thSand:["沙丘","沙丘","Sand","サンド","Arena"]
});
Object.assign(U,{
tabDiary:["日記","日记","Diary","日記","Diario"],
sharedDiary:["共享日記","共享日记","Shared diary","みんなの日記","Diario compartido"],
membersText:["{n} 位成員一起記錄 · 管理成員","{n} 位成员一起记录 · 管理成员","{n} members · Manage","{n}人で記録中 · メンバー管理","{n} miembros · Gestionar"],
invite:["邀請","邀请","Invite","招待","Invitar"],
fMine:["我的寵物","我的宠物","My pets","うちの子","Mis mascotas"],fFriends:["朋友的寵物","朋友的宠物","Friends' pets","友だちの子","De amigos"],
noEntries:["這天還沒有日記","这天还没有日记","No entries for this day","この日の日記はまだありません","Sin entradas este día"],showAllDays:["顯示全部","显示全部","Show all days","すべて表示","Ver todos"],
share:["分享","分享","Share","シェア","Compartir"],edit:["編輯","编辑","Edit","編集","Editar"],delete:["刪除","删除","Delete","削除","Eliminar"],deleted:["已刪除","已删除","Deleted","削除しました","Eliminado"],
editedBy:["{who} 編輯過","{who} 编辑过","Edited by {who}","{who}が編集","Editado por {who}"],
shareTitle:["分享這篇日記","分享这篇日记","Share this entry","この日記をシェア","Compartir entrada"],shareSub:["傳給親朋好友","发给亲朋好友","Send to friends & family","家族や友だちに送る","Envía a amigos y familia"],
copyLink:["複製連結","复制链接","Copy link","リンクをコピー","Copiar enlace"],more:["更多","更多","More","その他","Más"],linkCopied:["連結已複製","链接已复制","Link copied","リンクをコピーしました","Enlace copiado"],
igHint:["已複製連結，請到 Instagram 貼到限時動態或貼文","已复制链接，请到 Instagram 粘贴到快拍或帖子","Link copied. Paste it into an Instagram story or post.","リンクをコピーしました。Instagramのストーリーズや投稿に貼り付けてください","Enlace copiado. Pégalo en una historia o publicación de Instagram."],
openedOn:["正在開啟 {x} 分享…","正在打开 {x} 分享…","Opening {x}…","{x}を開いています…","Abriendo {x}…"],
shareText:["{title}｜{pet}的寵物日記 · PetPal Diary","{title}｜{pet}的宠物日记 · PetPal Diary","{title} | {pet}'s diary · PetPal Diary","{title}｜{pet}の日記 · PetPal Diary","{title} | Diario de {pet} · PetPal Diary"],
inviteText:["邀請你加入 PetPal 共享日記，一起記錄毛孩的每一天","邀请你加入 PetPal 共享日记，一起记录毛孩的每一天","Join my shared PetPal Diary and post your pets' days too","PetPalの共有日記に参加して、ペットの毎日をいっしょに記録しよう","Únete a mi diario compartido de PetPal y comparte el día a día de tus mascotas"],
inviteTitle:["邀請親友加入日記","邀请亲友加入日记","Invite to your diary","日記に招待","Invitar a tu diario"],inviteSub:["他們也能分享自己寵物的日常","他们也能分享自己宠物的日常","They can post their own pets' days too","友だちも自分のペットの日記を書けます","También pueden publicar sobre sus mascotas"],
role:["權限","权限","Permission","権限","Permiso"],roleEditor:["可編輯","可编辑","Can edit","編集できる","Puede editar"],roleViewer:["僅檢視","仅查看","View only","閲覧のみ","Solo ver"],roleOwner:["擁有者","拥有者","Owner","オーナー","Propietario"],
roleEditorD:["可寫日記、上傳照片、編輯內容，也能新增自己的寵物","可写日记、上传照片、编辑内容，也能添加自己的宠物","Can write, upload photos, edit entries and add their own pets","日記・写真の投稿、編集、自分のペットの追加ができます","Puede escribir, subir fotos, editar y añadir sus mascotas"],
roleViewerD:["可以看日記、按讚，但不能新增或編輯","可以看日记、点赞，但不能新增或编辑","Can read and like, but not post or edit","閲覧といいねのみ。投稿・編集はできません","Puede leer y dar me gusta, pero no publicar ni editar"],
inviteLink:["邀請連結","邀请链接","Invite link","招待リンク","Enlace de invitación"],sendVia:["傳送邀請","发送邀请","Send via","送信方法","Enviar por"],inviteSent:["邀請已送出","邀请已发送","Invite sent","招待を送りました","Invitación enviada"],
joined:["{x} 已加入你的日記","{x} 已加入你的日记","{x} joined your diary","{x}さんが日記に参加しました","{x} se unió a tu diario"],
members:["成員","成员","Members","メンバー","Miembros"],membersSub:["點選「預覽」可用該成員的身分瀏覽","点选“预览”可用该成员的身份浏览","Tap Preview to see the diary as that member","「表示」でそのメンバーとして閲覧できます","Toca Ver como para ver el diario como ese miembro"],
previewBtn:["預覽","预览","Preview","表示","Ver como"],previewAs:["以 {x} 的身分瀏覽中","以 {x} 的身份浏览中","Viewing as {x}","{x}として表示中","Viendo como {x}"],backToMe:["切回自己","切回自己","Back to me","自分に戻る","Volver a mí"],
viewerNoPost:["僅檢視成員無法新增或編輯日記","仅查看成员无法新增或编辑日记","View-only members can't post or edit","閲覧のみのメンバーは投稿・編集できません","Los miembros de solo lectura no pueden publicar"],
tapToChange:["點權限可切換","点权限可切换","Tap a permission to change it","権限をタップで切替","Toca el permiso para cambiarlo"],
dPet:["寵物","宠物","Pet","ペット","Mascota"],dPhotos:["照片","照片","Photos","写真","Fotos"],addPhoto:["拍照／上傳","拍照／上传","Camera / upload","撮影・追加","Cámara / subir"],photoMax:["最多 {n} 張，會自動壓縮","最多 {n} 张，会自动压缩","Up to {n}, resized automatically","最大{n}枚・自動で圧縮","Hasta {n}, se redimensionan"],demoPhoto:["示範照片","示范照片","Sample photo","サンプル","Foto de muestra"],
dActs:["今天一起做了什麼","今天一起做了什么","What you did together","今日いっしょにしたこと","Qué hicieron juntos"],
iWalk:["散步","散步","Walk","散歩","Pasear"],iPlay:["玩耍","玩耍","Play","遊び","Jugar"],iCuddle:["抱抱","抱抱","Cuddles","だっこ","Mimos"],iBath:["洗澡","洗澡","Bath","お風呂","Baño"],iTrain:["訓練","训练","Training","トレーニング","Entrenar"],iTreat:["點心","点心","Treats","おやつ","Premios"],iGroom:["梳毛","梳毛","Brushing","ブラッシング","Cepillado"],iNap:["一起午睡","一起午睡","Nap together","いっしょにお昼寝","Siesta juntos"],
dVis:["誰可以看","谁可以看","Who can see","公開範囲","Quién puede ver"],visMembers:["日記成員","日记成员","Diary members","日記のメンバー","Miembros"],visPrivate:["只有我","只有我","Only me","自分のみ","Solo yo"],private:["私密","私密","Private","非公開","Privado"],
storageFull:["儲存空間不足，部分照片可能無法保留","存储空间不足，部分照片可能无法保留","Storage is full; some photos may not be kept","容量不足のため一部の写真が保存されない可能性があります","Almacenamiento lleno; algunas fotos podrían perderse"],
diaryUpdated:["日記已更新","日记已更新","Entry updated","日記を更新しました","Entrada actualizada"],
jT1:["早晨的公園","早晨的公园","Morning at the park","朝の公園","Mañana en el parque"],jB1:["今天比平常早起，豆豆在草地上滾了好幾圈，還交到一個柯基朋友。","今天比平常早起，豆豆在草地上滚了好几圈，还交到一个柯基朋友。","Up earlier than usual. Doudou rolled in the grass and made a corgi friend.","いつもより早起き。豆豆は芝生でごろごろして、コーギーの友だちもできた。","Madrugamos. Doudou rodó por el césped e hizo un amigo corgi."],
jT2:["河堤 5 公里達成","河堤 5 公里达成","5 km along the river","河川敷5km達成","5 km junto al río"],jT4:["會說早安了","会说早安了","She says good morning!","「おはよう」が言えた","¡Ya dice buenos días!"],jT7:["布丁的地下隧道","布丁的地下隧道","Pudding's tunnel","プリンのトンネル","El túnel de Pudín"]
});
Object.assign(U,{
outTitle:["分享到 {x}","分享到 {x}","Share to {x}","{x}でシェア","Compartir en {x}"],
outNote:["預覽環境會擋下外部網站。實際安裝在手機上時，會直接開啟 {x} App 並帶入下方內容。","预览环境会拦截外部网站。实际安装在手机上时，会直接打开 {x} App 并带入下方内容。","This preview blocks outside sites. On a phone, {x} opens directly with the text below.","プレビュー環境では外部サイトが開けません。スマホでは{x}アプリが直接開き、下の内容が入力されます。","La vista previa bloquea sitios externos. En el móvil, {x} se abre con este texto."],
message:["分享內容","分享内容","Message","シェア内容","Mensaje"],copyText:["複製文字","复制文字","Copy text","テキストをコピー","Copiar texto"],textCopied:["文字已複製","文字已复制","Text copied","コピーしました","Texto copiado"],
openIn:["開啟 {x}","打开 {x}","Open {x}","{x}を開く","Abrir {x}"],
igStep1:["儲存下方的分享圖卡","保存下方的分享图卡","Save the share card below","下のシェア画像を保存","Guarda la tarjeta de abajo"],igStep2:["開啟 Instagram，選擇限時動態或貼文","打开 Instagram，选择快拍或帖子","Open Instagram and start a story or post","Instagramでストーリーズか投稿を作成","Abre Instagram y crea una historia o publicación"],igStep3:["貼上已複製的文字","粘贴已复制的文字","Paste the copied caption","コピーしたテキストを貼り付け","Pega el texto copiado"],
saveCard:["儲存圖卡","保存图卡","Save card","画像を保存","Guardar tarjeta"],making:["圖卡製作中…","图卡制作中…","Making your card…","画像を作成中…","Creando tarjeta…"]
});
ARTICLES.forEach(a=>{U[a.id+"t"]=a.t;U[a.id+"l"]=a.l;a.s.forEach((s,i)=>U[a.id+"s"+i]=s);});
const CATS=["all","catDog","catCat","catRabbit","catBird","catReptile","catFish","catSmall"];

function pick(arr,lang){return Array.isArray(arr)?(arr[IDX[lang]]??arr[0]):arr;}
function tr(lang,key,vars){let s=U[key]?pick(U[key],lang):key;if(vars)for(const k in vars)s=s.split("{"+k+"}").join(vars[k]);return s;}
function val(lang,x){if(x&&typeof x==="object"&&!Array.isArray(x))return x.k?tr(lang,x.k):"";return x==null?"":String(x);}

const FAM={me:{key:"meName",c:"#C4602F"},mom:{key:"momName",c:"#6F8F69"},jie:{key:"jieName",c:"#B8862A"}};
const PEOPLE={me:{key:"meName",c:"#C4602F"},mom:{key:"momName",c:"#6F8F69"},jie:{key:"jieName",c:"#B8862A"},zhe:{name:"阿哲",c:"#6E8FB0"},yt:{name:"雅婷",c:"#A77AA3"},yun:{name:"小芸",c:"#5E9C8A"}};
const HOUSEHOLD=["me","mom","jie"];
const FRIEND_PETS=[{id:"coco",name:"可可",breed:"bCorgi",color:"#F2C66D",owner:"zhe"},{id:"qiuqiu",name:"球球",breed:"bConure",color:"#DDE6EE",owner:"yt"},{id:"pudding",name:"布丁",breed:"bHamster",color:"#EEE0F0",owner:"yun"}];
const PETS=[
 {id:"dou",name:"豆豆",kind:"dog",color:"#F2C66D",breed:"bDou",age:"aDou",sex:"male",neutered:true,birthday:"2024/06/15",adopted:"2024/08/20",chip:"900 123 000 456 789",allergy:"alChicken"},
 {id:"mochi",name:"麻糬",kind:"cat",color:"#EFB8A0",breed:"bMochi",age:"aMochi",sex:"female",neutered:true,birthday:"2025/09/02",adopted:"2025/11/10",chip:"900 123 000 812 334",allergy:"none"},
 {id:"bai",name:"小白",kind:"rabbit",color:"#CFDCC8",breed:"bBai",age:"aBai",sex:"female",neutered:false,birthday:"2026/02/14",adopted:"2026/04/18",chip:"—",allergy:"none"}];
const ACT={dog:{label:"actWalk",start:"startWalk",goal:40},cat:{label:"actPlay",start:"startPlay",goal:20},rabbit:{label:"actRoam",start:"startRoam",goal:60}};
const TIPS={dog:"a1",cat:"a2",rabbit:"a3"};
const PLACES=[
 {id:"pl1",name:"plAnxin",type:"hospital",dist:"350 m",hours:{k:"open24"},open:true,tags:["tgDogCat","tgER"],phone:"02-2700-1234"},
 {id:"pl2",name:"plForest",type:"hospital",exotic:true,dist:"1.2 km",hours:{k:"openUntil",t:"21:00"},open:true,tags:["catBird","catReptile","catRabbit"],phone:"02-2700-5678"},
 {id:"pl3",name:"plDaily",type:"shop",dist:"600 m",hours:{k:"openUntil",t:"22:00"},open:true,tags:["tgFood","tgGroom"],phone:"02-2700-2468"},
 {id:"pl4",name:"plBlue",type:"shop",exotic:true,dist:"2.1 km",hours:{k:"closedToday"},open:false,tags:["catFish"],phone:"02-2700-1357"}];

const req=(v)=>v==null||v===""||(Array.isArray(v)&&v.length===0);
const FORMS={
 feed:{id:"feed",title:"fFeed",desc:"fFeedD",color:"#F8E7BF",submit:"saveNotify",toast:"loggedNotify",fields:[
  {id:"food",kind:"segment",label:"foodType",options:["dry","wet","hay","veg","water","treat"],def:c=>c.pet.kind==="rabbit"?"hay":"dry"},
  {id:"amount",kind:"stepper",label:"amount",def:1,step:1,min:1,unit:"uServing",dyn:v=>v.food==="water"?{unit:"ml",step:50,min:50,def:200}:null},
  {id:"appetite",kind:"segment",label:"appetite",options:["good","normal","poor"],def:"normal",showIf:v=>v.food!=="water"},
  {id:"note",kind:"text",label:"note",ph:"notePh"}],
  summary:(v,t,x)=>[t(v.food),v.amount+" "+(v.food==="water"?"ml":t("uServing")),v.food!=="water"&&v.appetite&&v.appetite!=="normal"?t("appetite")+" "+t(v.appetite):null,x(v.note)||null].filter(Boolean).join(" · ")},
 health:{id:"health",title:"fHealth",desc:"fHealthD",color:"#F6DCCF",submit:"saveNotify",toast:"loggedNotify",fields:[
  {id:"hType",kind:"segment",label:"hType",options:["symptom","med","visit","poop"],def:"symptom"},
  {id:"signs",kind:"chips",label:"signs",options:["vomit","diarrhea","itch","lethargy","cough"],def:[],required:true,showIf:v=>v.hType==="symptom"},
  {id:"severity",kind:"segment",label:"severity",options:["mild","moderate","severe"],def:"mild",showIf:v=>v.hType==="symptom",hint:v=>v.severity==="severe"?"severeHint":null},
  {id:"medName",kind:"text",label:"medName",ph:"medPh",required:true,showIf:v=>v.hType==="med"},
  {id:"clinic",kind:"text",label:"clinic",ph:"clinicPh",required:true,showIf:v=>v.hType==="visit"},
  {id:"docs",kind:"photos",label:"visitDocs",max:4,free:true,def:[],showIf:v=>v.hType==="visit"},
  {id:"stool",kind:"segment",label:"stool",options:["sNormal","sSoft","sHard"],def:"sNormal",showIf:v=>v.hType==="poop"},
  {id:"note",kind:"textarea",label:"note",ph:"notePh"}],
  summary:(v,t,x)=>{const d=v.hType==="symptom"?(v.signs||[]).map(t).join(t("listSep"))+" · "+t(v.severity):v.hType==="med"?x(v.medName):v.hType==="visit"?x(v.clinic):t(v.stool);return t(v.hType)+" · "+d;}},
 reminder:{id:"reminder",title:"fReminder",desc:"fReminderD",color:"#DDE6EE",submit:"saveBtn",toast:"reminderSaved",fields:[
  {id:"title",kind:"text",label:"rTitle",ph:"rTitlePh",required:true},
  {id:"date",kind:"date",label:"rDate",def:"2026-11-01",required:true},
  {id:"repeat",kind:"segment",label:"rRepeat",options:["once","monthly","yearly"],def:"once"},
  {id:"notify",kind:"toggle",label:"rNotify",def:true}],
  summary:(v,t,x)=>x(v.title)},
 growth:{id:"growth",title:"fGrowth",desc:"fGrowthD",color:"#E3EBDD",submit:"saveBtn",toast:"growthSaved",tip:"gTip",fields:[
  {id:"weight",kind:"stepper",label:"gWeight",unit:"kg",decimals:2,min:0.05,step:c=>c.pet.kind==="dog"?0.1:0.05,def:c=>c.latest.weight},
  {id:"length",kind:"stepper",label:"gLength",unit:"cm",decimals:1,min:1,step:0.5,def:c=>c.latest.length},
  {id:"body",kind:"segment",label:"gBody",options:["thin","ideal","chubby"],def:"ideal"}],
  summary:(v,t)=>`${v.weight} kg · ${v.length} cm · ${t(v.body)}`},
 diary:{id:"diary",title:"fDiary",desc:"fDiaryD",color:"#EEE0F0",submit:"saveBtn",toast:"diarySaved",target:"journal",fields:[
  {id:"pet",kind:"segment",label:"dPet",options:c=>c.petOptions,def:c=>c.defaultPet},
  {id:"photos",kind:"photos",label:"dPhotos",max:4,def:[]},
  {id:"mood",kind:"segment",label:"dMood",options:["happy","calm","clingy","grumpy"],def:"happy"},
  {id:"acts",kind:"chips",label:"dActs",options:["iWalk","iPlay","iCuddle","iBath","iTrain","iTreat","iGroom","iNap"],def:[]},
  {id:"title",kind:"text",label:"dTitle",ph:"dTitlePh",required:true},
  {id:"body",kind:"textarea",label:"dBody",ph:"dBodyPh"},
  {id:"vis",kind:"segment",label:"dVis",options:["visMembers","visPrivate"],def:"visMembers"}],
  summary:(v,t,x)=>t("fDiary")+" · "+x(v.title)},
 contact:{id:"contact",title:"fContact",desc:"fContactD",color:"#E6E2C8",submit:"saveBtn",toast:"contactSaved",fields:[
  {id:"name",kind:"text",label:"cName",ph:"cNamePh",required:true},
  {id:"rel",kind:"segment",label:"cRel",options:["vet","family","sitter","neighbor"],def:"vet"},
  {id:"phone",kind:"text",label:"cPhone",ph:"cPhonePh",required:true,inputMode:"tel",validate:v=>/^[0-9+\-\s()]{6,}$/.test(v)?null:"errPhone"},
  {id:"primary",kind:"toggle",label:"cPrimary",def:false}],
  summary:(v,t,x)=>x(v.name)}};
const FORM_ORDER=["feed","health","growth","reminder","diary","contact"];

function fieldError(f,v,lang){
  const x=v[f.id];
  if(f.required&&req(x))return f.kind==="chips"?tr(lang,"errPick"):f.kind==="date"?tr(lang,"errDate"):tr(lang,"errRequired",{field:tr(lang,f.label)});
  if(f.validate&&!req(x)){const k=f.validate(x);if(k)return tr(lang,k);}
  return null;
}

function seed(){
  let n=1;const E=(form,at,who,v)=>({id:"s"+(n++),form,at,who,v});
  const growth=(ws,ls)=>ws.map((w,i)=>E("growth",["2026/05/24","2026/06/24","2026/07/24","2026/08/24","2026/09/24","2026/10/20"][i]+" 09:00","me",{weight:w,length:ls[i],body:"ideal"}));
  const rem=(list)=>list.map(([k,d,r])=>E("reminder",d+" 09:00","me",{title:{k},date:d,repeat:r,notify:true}));
  const task=(a)=>a.map(([key,time,who,done],i)=>({id:i,key,time,who,done:done?who:null}));
  return {v:VERSION,liked:{},saved:{},
   members:[{id:"me",role:"roleOwner"},{id:"mom",role:"roleEditor"},{id:"zhe",role:"roleEditor"},{id:"yt",role:"roleEditor"}],
   journal:[
    {id:"j1",author:"me",petId:"dou",at:TODAY+" 07:50",likedBy:["mom","zhe"],v:{mood:"happy",acts:["iWalk","iPlay"],title:{k:"jT1"},body:{k:"jB1"},photos:[{slot:"jp-j1-0"},{slot:"jp-j1-1"}],vis:"visMembers"}},
    {id:"j2",author:"zhe",petId:"coco",at:YESTERDAY+" 19:20",likedBy:["me"],v:{mood:"happy",acts:["iWalk"],title:{k:"jT2"},body:{k:"po1"},photos:[{slot:"jp-j2-0"}],vis:"visMembers"}},
    {id:"j3",author:"mom",petId:"mochi",at:"2026/10/22 21:00",likedBy:[],v:{mood:"clingy",acts:["iCuddle","iNap"],title:{k:"dTMochi"},body:{k:"dBMochi"},photos:[{slot:"jp-j3-0"}],vis:"visMembers"}},
    {id:"j4",author:"yt",petId:"qiuqiu",at:"2026/10/21 08:10",likedBy:["me","mom","zhe"],v:{mood:"happy",acts:["iTrain"],title:{k:"jT4"},body:{k:"po2"},photos:[{slot:"jp-j4-0"},{slot:"jp-j4-1"},{slot:"jp-j4-2"}],vis:"visMembers"}},
    {id:"j5",author:"me",petId:"bai",at:"2026/10/21 20:00",likedBy:[],v:{mood:"calm",acts:["iTreat"],title:{k:"dTBai"},body:{k:"dBBai"},photos:[],vis:"visMembers"}},
    {id:"j6",author:"me",petId:"dou",at:"2026/10/20 18:00",likedBy:[],v:{mood:"happy",acts:["iWalk"],title:{k:"dTDou"},body:{k:"dBDou"},photos:[{slot:"jp-j6-0"}],vis:"visPrivate"}}],
   posts:[{id:"p1",author:"阿哲",pet:"可可",breed:"bCorgi",color:"#F2C66D",ago:1,text:{k:"po1"},likes:58,comments:6},
          {id:"p2",author:"雅婷",pet:"球球",breed:"bConure",color:"#DDE6EE",ago:3,text:{k:"po2"},likes:102,comments:14},
          {id:"p3",author:"小芸",pet:"布丁",breed:"bHamster",color:"#EEE0F0",ago:24,text:{k:"po3"},likes:24,comments:3}],
   pets:{
    dou:{week6:[45,38,50,30,42,55],
     tasks:task([["tWalkAM","07:30","jie",1],["tBreakfastDry","08:00","me",1],["tWater","12:00","mom",0],["tDinnerDry","18:30","mom",0],["tWalkPM","20:00","me",0]]),
     entries:[E("feed",TODAY+" 08:02","me",{food:"dry",amount:1,appetite:"good"}),E("activity",TODAY+" 07:31","jie",{min:25}),E("health",TODAY+" 07:45","jie",{hType:"poop",stool:"sNormal"}),
      E("activity",YESTERDAY+" 20:10","me",{min:30}),E("health",YESTERDAY+" 21:10","mom",{hType:"symptom",signs:["itch"],severity:"mild"}),
      E("health","2026/09/18 10:30","me",{hType:"visit",clinic:{k:"plAnxin"},note:{k:"vnDou"}}),
      ...growth([9.8,10.1,10.3,10.2,10.6,10.8],[52,53,54,54.5,55,55.5]),
      ...rem([["v8in1","2026/03/12","yearly"],["vRabies","2026/10/29","yearly"],["vHeartworm","2026/11/01","monthly"]]),
      E("contact","2024/08/20 10:00","me",{name:{k:"plAnxin"},rel:"vet",phone:"02-2700-1234",primary:true}),
      E("contact","2024/08/20 10:01","me",{name:{k:"momName"},rel:"family",phone:"0912-345-678",primary:false})]},
    mochi:{week6:[15,20,10,25,18,12],
     tasks:task([["tBreakfastWet","08:00","me",1],["tLitter","09:00","jie",0],["tWater","12:00","mom",0],["tPlay","16:00","jie",0],["tDinnerDry","19:00","me",0]]),
     entries:[E("feed",TODAY+" 08:05","me",{food:"wet",amount:1,appetite:"good"}),E("feed",YESTERDAY+" 19:00","mom",{food:"water",amount:180}),E("activity",YESTERDAY+" 16:20","jie",{min:12}),
      E("health","2026/08/12 15:00","me",{hType:"visit",clinic:{k:"plAnxin"},note:{k:"vnMochi"}}),
      ...growth([3.1,3.4,3.6,3.8,3.9,4.1],[38,40,41,42,43,43.5]),
      ...rem([["v3in1","2026/05/02","yearly"],["vDeworm","2026/10/30","monthly"],["vRabies","2026/11/15","yearly"]]),
      E("contact","2025/11/10 10:00","me",{name:{k:"plAnxin"},rel:"vet",phone:"02-2700-1234",primary:true})]},
    bai:{week6:[60,45,70,50,65,40],
     tasks:task([["tHay","08:00","mom",1],["tVeg","12:00","me",0],["tWater","12:00","mom",1],["tRoam","17:00","jie",0],["tToilet","21:00","me",0]]),
     entries:[E("feed",TODAY+" 08:10","mom",{food:"hay",amount:1,appetite:"good"}),E("activity",TODAY+" 09:00","mom",{min:30}),
      E("health","2026/06/10 11:00","me",{hType:"visit",clinic:{k:"plForest"},note:{k:"vnBai"}}),
      ...growth([0.7,0.8,0.85,0.9,0.95,1.0],[20,22,23,24,25,25.5]),
      ...rem([["vCheckup","2026/06/10","yearly"],["vNails","2026/10/28","monthly"],["vTeeth","2026/12/05","once"]]),
      E("contact","2026/04/18 10:00","me",{name:{k:"plForest"},rel:"vet",phone:"02-2700-5678",primary:true})]}}};
}
const daysBetween=(a,b)=>{const p=s=>{const [y,m,d]=s.slice(0,10).replace(/-/g,"/").split("/").map(Number);return new Date(y,m-1,d);};return Math.round((p(b)-p(a))/864e5);};
function isValidStore(s){return !!(s&&s.v===VERSION&&s.pets&&Array.isArray(s.posts)&&Array.isArray(s.journal)&&Array.isArray(s.members)&&PETS.every(p=>s.pets[p.id]&&Array.isArray(s.pets[p.id].entries)&&Array.isArray(s.pets[p.id].tasks)));}

window.PetPalData={PEOPLE,HOUSEHOLD,FRIEND_PETS,VERSION,TODAY,YESTERDAY,LANGS,U,ARTICLES,CATS,FAM,PETS,ACT,TIPS,PLACES,FORMS,FORM_ORDER,tr,val,fieldError,seed,daysBetween,isValidStore};
})();
