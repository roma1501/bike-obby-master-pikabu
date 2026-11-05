// GameHud.js — интерфейс заезда и меню: велокомпьютер (скорость), полоса прогресса трассы с флажками
// чекпоинтов, таймер и падения, монеты, кнопки «за рекламу» (пропуск этапа, ракета), всплывающие
// надписи, главное меню с выбором мира, пауза, экран финиша. Раскладка заезда — HudLayout (без наложений
// на любом экране), тексты — HUD_TEXT в LANG_STRINGS (ru/en). Решения принимает Game; Hud только рисует
// и передаёт нажатия (Hud.on.<имя>).

const HUD_ICON = {
    coin: 'assets/ui/icons/coin.webp', timer: 'assets/ui/icons/timer.webp', skull: 'assets/ui/icons/skull.webp',
    pause: 'assets/ui/icons/pause.webp', play: 'assets/ui/icons/play.webp', skip: 'assets/ui/icons/skip.webp',
    rocket: 'assets/ui/icons/lightning.webp', ad: 'assets/ui/icons/ad-video.webp', lock: 'assets/ui/icons/lock.webp',
    shop: 'assets/ui/icons/shop.webp', gift: 'assets/ui/icons/gift.webp', wheel: 'assets/ui/icons/prize-wheel.webp',
    trophy: 'assets/ui/icons/trophy.webp', settings: 'assets/ui/icons/settings.webp', home: 'assets/ui/icons/home.webp',
    restart: 'assets/ui/icons/restart.webp', star: 'assets/ui/icons/star.webp', check: 'assets/ui/icons/check.webp',
    question: 'assets/ui/icons/question.webp', arrow: 'assets/ui/icons/arrow-right.webp', crown: 'assets/ui/icons/crown.webp',
};

// Обложки миров для карточки выбора (иллюстрации с собственной рамкой и клетчатой лентой).
const HUD_WORLD_ART = ['assets/ui/worlds/world-1.webp', 'assets/ui/worlds/world-2.webp', 'assets/ui/worlds/world-3.webp'];

const HUD_TEXT = {
    ru: {
        'game.title1': 'Bike Obby', 'game.title2': 'Master',
        'world.1': 'Небесный парк', 'world.2': 'Конфетные облака', 'world.3': 'Закатный вулкан',
        'world.n': 'Мир {n}', 'world.locked': 'Пройди мир {n}', 'world.best': 'Рекорд {t}', 'world.noBest': 'Ещё не пройден',
        'world.cp': 'Чекпоинт {a}/{b}',
        'menu.play': 'Поехали!', 'menu.continue': 'Продолжить', 'menu.garage': 'Гараж', 'menu.daily': 'Подарок',
        'menu.wheel': 'Колесо', 'menu.records': 'Рекорды', 'menu.settings': 'Настройки', 'menu.howto': 'Как играть',
        'hud.progress': 'Трасса {p}%', 'hud.kmh': 'км/ч', 'hud.skip': 'Этап', 'hud.rocket': 'Ракета', 'hud.ad': 'За рекламу',
        'hud.wait': '{n} с', 'hud.rocketOn': 'Ракета {n} с',
        'toast.cp': 'Чекпоинт {n}!', 'toast.coins': '+{n}', 'toast.fall': 'Упс!', 'toast.boost': 'Ускорение!',
        'toast.knock': 'Сбил: {name}!', 'toast.rocket': 'Ракета на {n} с!', 'toast.skip': 'Этап пропущен', 'toast.adFail': 'Реклама сейчас недоступна',
        'pause.title': 'Пауза', 'pause.resume': 'Продолжить', 'pause.restart': 'Мир заново', 'pause.menu': 'В меню',
        'finish.title': 'Пройдено!', 'finish.time': 'Время', 'finish.best': 'Рекорд', 'finish.coins': 'Монеты',
        'finish.deaths': 'Падения', 'finish.record': 'Новый рекорд!', 'finish.next': 'Дальше', 'finish.again': 'Ещё раз',
        'finish.menu': 'В меню', 'finish.all': 'Все миры пройдены!',
        'offer.title': 'Упал? Поедь стильно!', 'offer.watch': 'За рекламу {a}/{b}', 'offer.wait': 'Реклама через {n} с',
        'offer.buy': 'Купить за {n}', 'offer.no': 'Нет, спасибо', 'offer.got': 'Новая вещь надета!',
        'offer.r.common': 'Обычная', 'offer.r.rare': 'Редкая', 'offer.r.epic': 'Эпическая', 'offer.r.legendary': 'Легендарная',
        'tut.ride.t': 'Крути педали', 'tut.ride.keyboard': 'Держи {keys}, чтобы ехать вперёд', 'tut.ride.touch': 'Двигай джойстик вверх — велосипед поедет',
        'tut.steer.t': 'Рули', 'tut.steer.keyboard': '{keys} — поворот руля', 'tut.steer.touch': 'Джойстик влево и вправо — поворот',
        'tut.hop.t': 'Прыжок', 'tut.hop.keyboard': 'Нажми {keys}, чтобы подпрыгнуть', 'tut.hop.touch': 'Нажми кнопку прыжка справа',
        'tut.cp.t': 'Доедь до флажка', 'tut.cp.h': 'Флажок — чекпоинт: если упадёшь, вернёшься к нему. Цель — финиш мира!',
    },
    en: {
        'game.title1': 'Bike Obby', 'game.title2': 'Master',
        'world.1': 'Sky Park', 'world.2': 'Candy Clouds', 'world.3': 'Sunset Volcano',
        'world.n': 'World {n}', 'world.locked': 'Finish world {n}', 'world.best': 'Best {t}', 'world.noBest': 'Not finished yet',
        'world.cp': 'Checkpoint {a}/{b}',
        'menu.play': 'Ride!', 'menu.continue': 'Continue', 'menu.garage': 'Garage', 'menu.daily': 'Gift',
        'menu.wheel': 'Wheel', 'menu.records': 'Records', 'menu.settings': 'Settings', 'menu.howto': 'How to play',
        'hud.progress': 'Track {p}%', 'hud.kmh': 'km/h', 'hud.skip': 'Stage', 'hud.rocket': 'Rocket', 'hud.ad': 'Watch ad',
        'hud.wait': '{n} s', 'hud.rocketOn': 'Rocket {n} s',
        'toast.cp': 'Checkpoint {n}!', 'toast.coins': '+{n}', 'toast.fall': 'Oops!', 'toast.boost': 'Boost!',
        'toast.knock': 'Knocked {name}!', 'toast.rocket': 'Rocket for {n} s!', 'toast.skip': 'Stage skipped', 'toast.adFail': 'Ad is not available now',
        'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.restart': 'Restart world', 'pause.menu': 'Menu',
        'finish.title': 'Finished!', 'finish.time': 'Time', 'finish.best': 'Best', 'finish.coins': 'Coins',
        'finish.deaths': 'Falls', 'finish.record': 'New record!', 'finish.next': 'Next', 'finish.again': 'Again',
        'finish.menu': 'Menu', 'finish.all': 'All worlds completed!',
        'offer.title': 'Fell? Ride in style!', 'offer.watch': 'Watch ad {a}/{b}', 'offer.wait': 'Ad in {n} s',
        'offer.buy': 'Buy for {n}', 'offer.no': 'No, thanks', 'offer.got': 'New item equipped!',
        'offer.r.common': 'Common', 'offer.r.rare': 'Rare', 'offer.r.epic': 'Epic', 'offer.r.legendary': 'Legendary',
        'tut.ride.t': 'Pedal', 'tut.ride.keyboard': 'Hold {keys} to ride forward', 'tut.ride.touch': 'Push the joystick up to ride',
        'tut.steer.t': 'Steer', 'tut.steer.keyboard': '{keys} — steer', 'tut.steer.touch': 'Joystick left and right to steer',
        'tut.hop.t': 'Jump', 'tut.hop.keyboard': 'Press {keys} to hop', 'tut.hop.touch': 'Tap the jump button on the right',
        'tut.cp.t': 'Reach the flag', 'tut.cp.h': 'A flag is a checkpoint: fall and you return to it. Reach the finish of the world!',
    },
};
(() => {
    if (typeof LANG_STRINGS === 'undefined') return;
    for (const lang of Object.keys(HUD_TEXT)) {
        const dst = LANG_STRINGS[lang] || (LANG_STRINGS[lang] = {});
        for (const [k, v] of Object.entries(HUD_TEXT[lang])) if (!(k in dst)) dst[k] = v;
    }
})();

const HUD_CSS = `
#bo-hud, #bo-menu, #bo-over { position: fixed; inset: 0; pointer-events: none; font-family: var(--bo-font); color: #fff; user-select: none; }
#bo-hud { z-index: 20; } #bo-menu { z-index: 30; } #bo-over { z-index: 40; }
#bo-hud [data-hl], #bo-hud .hud-blk { pointer-events: auto; }
#bo-hud.off, #bo-menu.off, .bo-hide { display: none !important; }
body.meta-open #bo-menu, body.meta-open #bo-hud { display: none !important; }
.hud-k { font-size: calc(16px * var(--hl-k, 1)); }
.hud-plate { display: flex; align-items: center; gap: .45em; padding: .3em .7em .3em .35em; background: rgba(27,18,64,.78); border: .16em solid var(--bo-dark);
  border-radius: .9em; box-shadow: 0 .22em 0 rgba(27,18,64,.65); text-shadow: var(--bo-outline-thin); white-space: nowrap; box-sizing: border-box; }
.hud-plate img { width: 1.9em; height: 1.9em; object-fit: contain; flex: none; }
#hud-time { flex-direction: column; align-items: stretch; gap: .2em; padding: .35em .6em; }
#hud-time .row { display: flex; align-items: center; gap: .4em; }
#hud-time .t { font-size: 1.45em; letter-spacing: .03em; font-variant-numeric: tabular-nums; }
#hud-time .s { font-size: .9em; opacity: .9; } #hud-time img { width: 1.5em; height: 1.5em; }
#hud-coins .n { font-size: 1.5em; min-width: 2.2em; text-align: right; font-variant-numeric: tabular-nums; }
#hud-pause { width: 3.2em; height: 3.2em; padding: 0; border-radius: 50%; display: grid; place-items: center; background: var(--bo-purple); border: .18em solid var(--bo-dark);
  box-shadow: 0 .25em 0 var(--bo-dark); cursor: pointer; }
#hud-pause img { width: 2em; height: 2em; }
#hud-progress { display: flex; flex-direction: column; gap: .25em; align-items: stretch; }
#hud-progress .lbl { display: flex; justify-content: space-between; font-size: .95em; text-shadow: var(--bo-outline-thin); padding: 0 .3em; }
#hud-progress .bar { position: relative; height: 1.15em; background: rgba(255,255,255,.92); border: .16em solid var(--bo-dark); border-radius: .7em; overflow: hidden; box-shadow: 0 .2em 0 rgba(27,18,64,.6); }
#hud-progress .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: repeating-linear-gradient(-45deg, #56c93a 0 .6em, #7fe05a .6em 1.2em); transition: width .35s; }
#hud-progress .tick { position: absolute; top: 15%; bottom: 15%; width: .14em; background: rgba(27,18,64,.35); }
#hud-progress .tick.on { background: rgba(27,18,64,.75); }
#hud-progress .me { position: absolute; top: 50%; width: 1.5em; height: 1.5em; margin: -.75em 0 0 -.75em; border-radius: 50%; background: var(--bo-yellow); border: .16em solid var(--bo-dark); transition: left .35s; }
#hud-speed { display: flex; align-items: flex-end; justify-content: center; gap: .35em; padding: .2em .8em .25em; background: rgba(27,18,64,.82); border: .16em solid var(--bo-dark);
  border-radius: 1em 1em .6em .6em; box-shadow: 0 .22em 0 rgba(27,18,64,.6); }
#hud-speed .n { font-size: 2.1em; line-height: 1; min-width: 1.7em; text-align: right; font-variant-numeric: tabular-nums; color: #fff36a; text-shadow: var(--bo-outline-thin); }
#hud-speed .u { font-size: .85em; padding-bottom: .25em; opacity: .9; }
#hud-speed .gauge { width: 4.2em; height: .55em; margin-bottom: .45em; border-radius: .3em; background: rgba(255,255,255,.2); overflow: hidden; }
#hud-speed .gauge i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #56c93a, #ffd23f 70%, #ff4d5e); }
.hud-act { display: flex; flex-direction: column; gap: .6em; align-items: flex-end; }
.hud-act .bo-btn { font-size: 1em; min-height: 0; padding: .35em .6em .35em .4em; border-radius: 1em; flex-direction: row; gap: .35em; }
.hud-act .bo-btn img.i { width: 2em; height: 2em; }
.hud-act .bo-btn .tx { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.05; }
.hud-act .bo-btn .tx small { font-size: .62em; opacity: .95; display: flex; align-items: center; gap: .25em; }
.hud-act .bo-btn .tx small img { width: 1.25em; height: 1.25em; }
#hud-toast { font-family: var(--bo-font); position: fixed; left: 50%; top: calc(var(--hl-progress-y, 10px) + var(--hl-progress-h, 50px) + 14px); transform: translateX(-50%); text-align: center; pointer-events: none; z-index: 25; }
#hud-toast .t { font-size: clamp(26px, 5vw, 44px); letter-spacing: .02em; text-shadow: var(--bo-outline), 0 6px 0 var(--bo-dark), 0 8px 10px rgba(27,18,64,.35); color: #fff36a; animation: bo-pop .9s ease-out both; white-space: nowrap; }
#hud-toast .t.s { font-size: clamp(18px, 3.2vw, 26px); color: #fff; text-shadow: var(--bo-outline-thin), 0 3px 0 var(--bo-dark), 0 5px 8px rgba(27,18,64,.35); }
@keyframes bo-pop { 0% { transform: scale(.4); opacity: 0; } 18% { transform: scale(1.12); opacity: 1; } 30% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-14px); } }
#hud-flash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 26; transition: opacity .25s; }
/* ---- главное меню: зоны по краям, размеры от меньшей стороны экрана — помещается от 568×320 до 4K ---- */
#bo-menu { --u: min(1vh, 1.7vw); --pad: max(10px, calc(var(--u) * 2.2)); }
#bo-menu > * { pointer-events: auto; position: absolute; }
.menu-logo { left: calc(var(--pad) + env(safe-area-inset-left)); top: calc(var(--pad) + env(safe-area-inset-top)); display: flex; flex-direction: column; align-items: flex-start; transform: rotate(-3deg); transform-origin: left top; }
.menu-logo .a { font-size: clamp(26px, calc(var(--u) * 8.6), 84px); line-height: .92; color: var(--bo-yellow); text-shadow: var(--bo-outline), 0 6px 0 var(--bo-dark); letter-spacing: .02em; white-space: nowrap; }
.menu-logo .b { margin-top: calc(var(--u) * .8); padding: .12em .65em .2em; font-size: clamp(14px, calc(var(--u) * 3.6), 34px); background: var(--bo-red); border: 3px solid var(--bo-dark); border-radius: .45em; box-shadow: 0 4px 0 var(--bo-dark);
  text-shadow: var(--bo-outline-thin); transform: rotate(2deg) translateX(.9em); }
.menu-coins { right: calc(var(--pad) + env(safe-area-inset-right)); top: calc(var(--pad) + env(safe-area-inset-top)); font-size: clamp(13px, calc(var(--u) * 2.6), 20px); }
.menu-side { left: calc(var(--pad) + env(safe-area-inset-left)); top: calc(var(--pad) + env(safe-area-inset-top) + clamp(52px, calc(var(--u) * 17), 170px)); bottom: calc(var(--pad) + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; justify-content: center; gap: clamp(5px, calc(var(--u) * 1.3), 12px); }
.menu-side .bo-btn { --c: var(--bo-purple); font-size: clamp(11px, calc(var(--u) * 2.3), 16px); min-height: 0; height: clamp(32px, calc(var(--u) * 7.6), 54px); padding: 0 .9em 0 .25em; justify-content: flex-start;
  min-width: clamp(110px, calc(var(--u) * 24), 170px); border-radius: 14px; }
.menu-side .bo-btn img { width: clamp(24px, calc(var(--u) * 5.6), 40px); height: clamp(24px, calc(var(--u) * 5.6), 40px); }
.menu-side .bo-btn .dot { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: var(--bo-red); border: 3px solid var(--bo-dark); display: none; }
.menu-side .bo-btn.hot .dot { display: block; }
.menu-main { right: calc(var(--pad) + env(safe-area-inset-right)); bottom: calc(var(--pad) + env(safe-area-inset-bottom)); width: clamp(250px, calc(var(--u) * 54), 440px);
  display: flex; flex-direction: column; align-items: stretch; gap: clamp(8px, calc(var(--u) * 1.8), 16px); font-size: clamp(12px, calc(var(--u) * 2.3), 17px); }
.wsel { display: flex; align-items: stretch; gap: .4em; }
.wsel .arr { flex: none; width: 2.6em; padding: 0; min-height: 0; border-radius: .8em; --c: var(--bo-sky); font-size: 1em; }
.wsel .arr img { width: 1.4em; height: 1.4em; } .wsel .arr.l img { transform: scaleX(-1); }
.wsel .arr.is-off { visibility: hidden; }
.wcard.art { background: none; border: none; box-shadow: none; border-radius: 0; overflow: visible; aspect-ratio: 760 / 468; }
.wcard.art > .img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; filter: drop-shadow(0 5px 0 rgba(27,18,64,.85)); pointer-events: none; }
.wcard.art .info { position: absolute; left: 4.5%; right: 4.5%; bottom: 6.5%; display: flex; flex-direction: column; gap: .25em; padding: .3em .5em .4em; font-size: .9em;
  background: rgba(27,18,64,.78); border: 2px solid rgba(255,255,255,.35); border-radius: .8em; color: #fff; }
.wcard.art .info .row { display: flex; align-items: center; gap: .45em; }
.wcard.art .num { width: 1.6em; height: 1.6em; font-size: 1em; border-radius: .5em; border-width: 2px; }
.wcard.art .nm { font-size: 1.05em; text-shadow: var(--bo-outline-thin); color: #fff; }
.wcard.art .meta { margin-left: auto; padding: 0 0 0 .4em; font-size: .78em; opacity: .95; color: #fff; text-align: right; }
.wcard.art .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.wcard.art { container-type: inline-size; }
@container (max-width: 290px) { .wcard.art .meta { display: none; } }
.wcard.art .pbar { margin: .1em 0 0; height: .55em; border-color: rgba(255,255,255,.6); background: rgba(255,255,255,.25); }
.wcard.art .dots { top: 16%; right: 6%; }
.wcard.art .done { top: 15%; right: auto; left: 5%; width: 2em; height: 2em; filter: drop-shadow(0 2px 0 rgba(27,18,64,.8)); }
.wcard.art .lock { inset: 13% 2.6% 4.5% 2.6%; border-radius: 1em; flex-direction: column; background: rgba(27,18,64,.55); font-size: 1em; }
.wcard.art .lock img { width: 3em; height: 3em; }
.wcard.art.locked .info { filter: grayscale(.7); opacity: .8; }
.wcard.art.locked .img { filter: grayscale(.55) brightness(.8) drop-shadow(0 5px 0 rgba(27,18,64,.85)); }
.wcard { --c: var(--bo-purple); position: relative; flex: 1; min-width: 0; border: 3px solid var(--bo-dark); border-radius: 1em; background: #fff8ec; color: var(--bo-dark);
  box-shadow: 0 5px 0 var(--bo-dark); overflow: hidden; text-align: left; }
.wcard .band { height: .75em; border-bottom: 3px solid var(--bo-dark); }
.wcard .top { display: flex; align-items: center; gap: .5em; padding: .5em .6em .1em; }
.wcard .num { display: grid; place-items: center; width: 2em; height: 2em; border-radius: .55em; background: var(--c); color: #fff; border: 3px solid var(--bo-dark); font-size: 1.05em; text-shadow: var(--bo-outline-thin); flex: none; }
.wcard .nm { font-size: 1.05em; line-height: 1.05; }
.wcard .meta { padding: .25em .7em 0; font-size: .8em; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wcard .pbar { margin: .4em .7em .6em; height: .65em; border: 2px solid var(--bo-dark); border-radius: .4em; background: #e8e0f8; overflow: hidden; }
.wcard .pbar i { display: block; height: 100%; background: var(--c); }
.wcard .dots { position: absolute; right: .6em; top: 1.1em; display: flex; gap: .25em; }
.wcard .dots i { width: .5em; height: .5em; border-radius: 50%; background: #d8cff0; border: 2px solid var(--bo-dark); }
.wcard .dots i.on { background: var(--bo-yellow); }
.wcard.locked .top, .wcard.locked .meta, .wcard.locked .pbar { filter: grayscale(.8); opacity: .55; }
.wcard .lock { position: absolute; inset: .75em 0 0; display: none; align-items: center; justify-content: center; gap: .4em; color: #fff; text-shadow: var(--bo-outline-thin); background: rgba(27,18,64,.45); font-size: .95em; }
.wcard.locked .lock { display: flex; }
.wcard .lock img { width: 2em; height: 2em; }
.wcard .done { position: absolute; top: 1em; right: 3.6em; width: 1.7em; height: 1.7em; display: none; }
.wcard.finished .done { display: block; }
.menu-play { --c: var(--bo-green); font-size: 1.6em; min-height: 0; padding: .35em .8em; border-radius: .7em; }
.menu-play img { width: 1.2em; height: 1.2em; }
@media (orientation: portrait) {
  #bo-menu { --u: min(0.75vh, 1.45vw); }
  .menu-side { top: auto; left: 50%; transform: translateX(-50%); bottom: calc(var(--pad) + env(safe-area-inset-bottom) + min(92vw, 420px) * 0.616 + 5.4em);
    flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 8px; width: min(96vw, 520px); }
  .menu-side .bo-btn { min-width: 0; height: auto; flex-direction: column; justify-content: center; padding: .35em .3em .3em; gap: .15em; width: calc((100% - 32px) / 5); font-size: clamp(10px, 2.6vw, 14px); }
  .menu-main { left: 50%; right: auto; transform: translateX(-50%); width: min(92vw, 420px); }
}
/* ---- оверлеи: пауза, финиш ---- */
#bo-over { display: none; align-items: center; justify-content: center; background: rgba(20,12,48,.55); pointer-events: auto; padding: 14px; box-sizing: border-box; }
#bo-over.on { display: flex; }
.over-panel { width: min(420px, 94vw); max-height: 94vh; overflow: auto; padding: 0 0 18px; text-align: center; }
.over-panel .band { height: 18px; border-bottom: 4px solid var(--bo-dark); }
.over-panel h2 { margin: 12px 0 6px; font: 400 clamp(30px, 6vh, 46px)/1 var(--bo-font); color: var(--bo-yellow); text-shadow: var(--bo-outline), 0 5px 0 var(--bo-dark); }
.over-panel .sub { font-size: 15px; margin-bottom: 10px; color: var(--bo-dark); }
.over-btns { display: flex; flex-direction: column; gap: 12px; padding: 6px 26px 0; }
.over-btns .bo-btn { font-size: 20px; }
.over-btns .row { display: flex; gap: 10px; } .over-btns .row .bo-btn { flex: 1; font-size: 17px; padding: .5em .6em; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 4px 22px 12px; }
.stat { background: #fff; border: 3px solid var(--bo-dark); border-radius: 12px; padding: 6px 8px; box-shadow: 0 3px 0 var(--bo-dark); }
.stat b { display: block; font-weight: 400; font-size: 12px; opacity: .75; } .stat span { font-size: 21px; display: inline-flex; align-items: center; gap: 4px; }
.stat span img { width: 22px; height: 22px; }
.rec { display: inline-block; margin: 0 0 8px; padding: 4px 12px; background: var(--bo-red); color: #fff; border: 3px solid var(--bo-dark); border-radius: 10px; text-shadow: var(--bo-outline-thin); transform: rotate(-3deg); animation: bo-pop 1.6s both; animation-iteration-count: 1; }
@media (max-height: 430px) { .over-panel h2 { margin: 6px 0 2px; } .stats { gap: 5px; padding-bottom: 6px; } .stat span { font-size: 17px; } .over-btns { gap: 8px; } .over-btns .bo-btn { font-size: 16px; min-height: 38px; } }
/* предложение после падения */
.offer-item { position: relative; margin: 2px 26px 12px; padding: 10px 10px 8px; background: #fff; border: 3px solid var(--bo-dark); border-radius: 16px; box-shadow: 0 4px 0 var(--bo-dark); }
.offer-item.r-rare { background: linear-gradient(#eaf4ff, #fff); } .offer-item.r-epic { background: linear-gradient(#f3e8ff, #fff); }
.offer-item.r-legendary { background: linear-gradient(#fff3c4, #fff); box-shadow: 0 4px 0 var(--bo-dark), 0 0 0 4px var(--bo-yellow); }
.offer-img { width: clamp(90px, 22vh, 150px); height: clamp(90px, 22vh, 150px); object-fit: contain; display: block; margin: 0 auto; }
.offer-nm { font-size: 20px; color: var(--bo-dark); } .offer-rar { font-size: 13px; color: #6a5aa8; }
/* сенсорный джойстик и кнопка прыжка в стиле игры */
.lory-ctx { font-family: var(--bo-font) !important; font-weight: 400 !important; border: 4px solid var(--bo-dark) !important; background: var(--bo-green) !important;
  box-shadow: 0 5px 0 var(--bo-dark) !important; text-shadow: var(--bo-outline-thin); }
.lory-ctx-icon img { filter: drop-shadow(0 2px 0 rgba(27,18,64,.6)); }
.lory-stick { border: 4px solid rgba(27,18,64,.85) !important; background: radial-gradient(circle, rgba(255,255,255,.35) 0 40%, rgba(255,255,255,.18) 41%) !important; }
.lory-stick.idle { opacity: .55 !important; }
.lory-stick i { background: var(--bo-yellow) !important; border: 4px solid var(--bo-dark); box-sizing: border-box; opacity: 1 !important; }
`;

/** @satisfies {Record<string, any>} */
const Hud = {
    /** @type {Record<string, (...a: any[]) => void>} */ on: {},
    /** @type {Record<string, HTMLElement>} */ el: {},
    _cpTotal: 0,
    _speedShown: -1,
    _coinsShown: -1,
    _toastTimer: 0,

    init() {
        const st = document.createElement('style');
        st.id = 'bo-hud-css'; st.textContent = HUD_CSS;
        document.head.appendChild(st);
        const I = HUD_ICON;
        const hud = this._div('bo-hud', '', document.body);
        hud.className = 'off';
        hud.innerHTML = `
          <div id="hud-time" class="hud-plate hud-k"><div class="row"><img src="${I.timer}" alt=""><span class="t">00:00.00</span></div>
            <div class="row s"><img src="${I.skull}" alt=""><span class="d">0</span><span class="b"></span></div></div>
          <div id="hud-progress" class="hud-k"><div class="lbl"><span class="w"></span><span class="p"></span></div><div class="bar"><div class="fill"></div><div class="ticks"></div><div class="me"></div></div></div>
          <div id="hud-coins" class="hud-plate hud-k"><img src="${I.coin}" alt=""><span class="n">0</span></div>
          <button id="hud-pause" class="hud-k" type="button" aria-label="pause"><img src="${I.pause}" alt=""></button>
          <div id="hud-actions" class="hud-act hud-k">
            <button class="bo-btn" id="hud-skip" type="button" style="--c: var(--bo-sky)"><img class="i" src="${I.skip}" alt=""><span class="tx"><span data-t="hud.skip"></span><small><img src="${I.ad}" alt=""><span class="w"></span></small></span></button>
            <button class="bo-btn" id="hud-rocket" type="button" style="--c: var(--bo-orange)"><img class="i" src="${I.rocket}" alt=""><span class="tx"><span class="rl" data-t="hud.rocket"></span><small><img src="${I.ad}" alt=""><span class="w"></span></small></span></button>
          </div>
          <div id="hud-speed" class="hud-k"><span class="n">0</span><span class="u" data-t="hud.kmh"></span><span class="gauge"><i></i></span></div>`;
        this._div('hud-toast', '', document.body);
        this._div('hud-flash', '', document.body);
        const menu = this._div('bo-menu', '', document.body);
        menu.className = 'off';
        menu.innerHTML = `
          <div class="menu-logo"><span class="a" data-t="game.title1"></span><span class="b" data-t="game.title2"></span></div>
          <div class="menu-coins hud-plate"><img src="${I.coin}" alt=""><span class="n">0</span></div>
          <div class="menu-side">
            <button class="bo-btn" data-m="garage" type="button" style="--c: var(--bo-orange)"><img src="${I.shop}" alt=""><span data-t="menu.garage"></span><i class="dot"></i></button>
            <button class="bo-btn" data-m="daily" type="button" style="--c: var(--bo-pink)"><img src="${I.gift}" alt=""><span data-t="menu.daily"></span><i class="dot"></i></button>
            <button class="bo-btn" data-m="wheel" type="button" style="--c: var(--bo-sky)"><img src="${I.wheel}" alt=""><span data-t="menu.wheel"></span><i class="dot"></i></button>
            <button class="bo-btn" data-m="records" type="button" style="--c: var(--bo-yellow)"><img src="${I.trophy}" alt=""><span data-t="menu.records"></span><i class="dot"></i></button>
            <button class="bo-btn" data-m="settings" type="button" style="--c: var(--bo-purple)"><img src="${I.settings}" alt=""><span data-t="menu.settings"></span><i class="dot"></i></button>
          </div>
          <div class="menu-main"><div class="wsel"><button class="bo-btn arr l" type="button" aria-label="prev"><img src="${I.arrow}" alt=""></button><div class="wcard"></div><button class="bo-btn arr r" type="button" aria-label="next"><img src="${I.arrow}" alt=""></button></div>
            <button class="bo-btn menu-play" type="button"><img src="${I.play}" alt=""><span data-t="menu.play"></span></button></div>`;
        const over = this._div('bo-over', '', document.body);
        void over;
        for (const k of ['hud', 'menu', 'over']) this.el[k] = /** @type {HTMLElement} */ (document.getElementById('bo-' + k));
        this.el.toast = /** @type {HTMLElement} */ (document.getElementById('hud-toast'));
        this.el.flash = /** @type {HTMLElement} */ (document.getElementById('hud-flash'));
        Lang.apply();
        const click = (sel, fn) => { const e = document.querySelector(sel); if (e) e.addEventListener('click', (ev) => { ev.stopPropagation(); this._click(); fn(ev); }); };
        click('#hud-pause', () => this.on.pause && this.on.pause());
        click('#hud-skip', () => this.on.skip && this.on.skip());
        click('#hud-rocket', () => this.on.rocket && this.on.rocket());
        click('.menu-play', () => this.on.play && this.on.play());
        click('.wsel .arr.l', () => this.on.selectWorld && this.on.selectWorld(this._sel - 1));
        click('.wsel .arr.r', () => this.on.selectWorld && this.on.selectWorld(this._sel + 1));
        for (const b of Array.from(menu.querySelectorAll('[data-m]'))) b.addEventListener('click', (ev) => { ev.stopPropagation(); this._click(); if (this.on.meta) this.on.meta(/** @type {HTMLElement} */ (b).dataset.m); });
        // кнопки HUD не отдают нажатие игре и камере
        for (const id of ['hud-pause', 'hud-skip', 'hud-rocket']) {
            const e = document.getElementById(id);
            if (e) for (const t of ['pointerdown', 'pointerup', 'touchstart']) e.addEventListener(t, (ev) => ev.stopPropagation(), { passive: true });
        }
        HudLayout.block('time', { dock: 'tl', w: 168, h: 66, el: '#hud-time', order: 0 });
        HudLayout.block('pause', { dock: 'tr', w: 52, h: 52, el: '#hud-pause', order: -1, min: 44 });
        HudLayout.block('coins', { dock: 'tr', w: 128, h: 46, el: '#hud-coins', order: 0 });
        HudLayout.block('progress', { dock: 'tc', w: 420, h: 50, fill: true, maxW: 560, el: '#hud-progress' });
        HudLayout.block('actions', { dock: 'mr', w: 150, h: 128, el: '#hud-actions', visible: () => this._actionsVisible() });
        HudLayout.block('speed', { dock: 'bc', w: 190, h: 52, el: '#hud-speed' });
        if (typeof Ads !== 'undefined') Ads.on(() => this.refreshAds());
        this.refreshAds();
    },

    _actionsVisible() { return !this.el.hud.classList.contains('off') && (typeof Ads === 'undefined' || Ads.supported()); },

    _div(id, cls, parent) {
        const d = document.createElement('div');
        d.id = id; if (cls) d.className = cls;
        parent.appendChild(d);
        return d;
    },

    _click() { try { Sound.play('assets/sounds/click.ogg', { volume: 0.6 }); } catch (e) { /* звук не обязателен */ } },

    show(which) {
        this.el.hud.classList.toggle('off', which !== 'hud');
        this.el.menu.classList.toggle('off', which !== 'menu');
        HudLayout.refresh();
    },

    fmt(sec) {
        if (sec == null || !Number.isFinite(sec)) return '--:--';
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60), c = Math.floor((sec * 100) % 100);
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
    },

    setTime(sec, deaths, best) {
        const t = this.el.hud.querySelector('#hud-time .t'), d = this.el.hud.querySelector('#hud-time .d'), b = this.el.hud.querySelector('#hud-time .b');
        if (t) t.textContent = this.fmt(sec);
        if (d) d.textContent = String(deaths);
        if (b) b.textContent = best ? '  ★ ' + this.fmt(best) : '';
    },

    setCoins(n) {
        if (n === this._coinsShown) return;
        this._coinsShown = n;
        for (const e of Array.from(document.querySelectorAll('#hud-coins .n, .menu-coins .n'))) e.textContent = String(n);
    },

    setSpeed(pxs) {
        const kmh = Math.round(Math.abs(pxs) / 100 * 3.6);
        if (kmh !== this._speedShown) {
            this._speedShown = kmh;
            const n = this.el.hud.querySelector('#hud-speed .n'); if (n) n.textContent = String(kmh);
            const g = /** @type {HTMLElement} */ (this.el.hud.querySelector('#hud-speed .gauge i')); if (g) g.style.width = Math.min(100, kmh / 72 * 100) + '%';
        }
    },

    setWorld(n, total) {
        this._cpTotal = total;
        const w = this.el.hud.querySelector('#hud-progress .w'); if (w) w.textContent = Lang.t('world.n', { n }) + ' · ' + Lang.t('world.' + n);
        const ticks = this.el.hud.querySelector('#hud-progress .ticks');
        if (ticks) { ticks.innerHTML = ''; for (let i = 1; i < total; i++) { const t = document.createElement('i'); t.className = 'tick'; t.style.left = (i / total * 100) + '%'; ticks.appendChild(t); } }
    },

    setProgress(frac, cp) {
        const p = Math.max(0, Math.min(1, frac));
        const fill = /** @type {HTMLElement} */ (this.el.hud.querySelector('#hud-progress .fill')); if (fill) fill.style.width = (p * 100).toFixed(1) + '%';
        const me = /** @type {HTMLElement} */ (this.el.hud.querySelector('#hud-progress .me')); if (me) me.style.left = (p * 100).toFixed(1) + '%';
        const lbl = this.el.hud.querySelector('#hud-progress .p'); if (lbl) lbl.textContent = Lang.t('hud.progress', { p: Math.floor(p * 100) });
        const ticks = this.el.hud.querySelectorAll('#hud-progress .tick');
        ticks.forEach((t, i) => t.classList.toggle('on', i < cp));
    },

    toast(text, small) {
        const box = this.el.toast;
        const t = document.createElement('div');
        t.className = 't' + (small ? ' s' : '');
        t.textContent = text;
        box.appendChild(t);
        setTimeout(() => t.remove(), 950);
        while (box.children.length > 3) box.firstChild.remove();
    },

    flash(alpha, ms) {
        const f = this.el.flash;
        f.style.transition = 'none'; f.style.opacity = String(alpha || 0.7);
        requestAnimationFrame(() => { f.style.transition = 'opacity ' + ((ms || 400) / 1000) + 's'; f.style.opacity = '0'; });
    },

    /** Кнопки «за рекламу» в HUD: подпись, кулдаун, активная ракета. */
    refreshAds(rocketLeft) {
        if (rocketLeft != null) this._rocketLeft = rocketLeft;
        const left = typeof Ads !== 'undefined' ? Ads.cooldownLeft() : 0;
        const busy = typeof Ads !== 'undefined' && Ads.busy();
        for (const id of ['hud-skip', 'hud-rocket']) {
            const b = /** @type {HTMLButtonElement} */ (document.getElementById(id));
            if (!b) continue;
            const w = b.querySelector('small .w');
            const active = id === 'hud-rocket' && this._rocketLeft > 0;
            const off = left > 0 || busy || active;
            b.classList.toggle('is-off', off);
            if (w) w.textContent = active ? Lang.t('hud.wait', { n: Math.ceil(this._rocketLeft) }) : left > 0 ? Lang.t('hud.wait', { n: left }) : Lang.t('hud.ad');
        }
    },
    _rocketLeft: 0,

    /** Карточки миров в меню. worlds: [{ n, id, locked, needN, done, best, frac, cp, total }] */
    _sel: 1,
    /** Карточка выбранного мира и стрелки. worlds: [{ n, id, locked, needN, done, best, frac, cp, total }] */
    renderWorlds(worlds, selected) {
        const card = this.el.menu.querySelector('.wcard');
        if (!card) return;
        const w = worlds.find(x => x.n === selected) || worlds[0];
        if (!w) { card.innerHTML = ''; return; }
        this._sel = w.n;
        const colors = ['var(--bo-purple)', 'var(--bo-pink)', 'var(--bo-orange)'], bands = ['#7b4dff', '#ff7ac8', '#ff9f1c'];
        const art = HUD_WORLD_ART[w.n - 1];
        card.className = 'wcard' + (art ? ' art' : '') + (w.locked ? ' locked' : '') + (w.done ? ' finished' : '');
        card.style.setProperty('--c', colors[(w.n - 1) % 3]);
        const meta = w.cp > 0 && !w.done ? Lang.t('world.cp', { a: w.cp, b: w.total }) : w.best ? Lang.t('world.best', { t: this.fmt(w.best) }) : Lang.t('world.noBest');
        const dots = worlds.map(x => `<i class="${x.n === w.n ? 'on' : ''}"></i>`).join('');
        const pct = Math.round((w.done ? 1 : w.frac) * 100);
        card.innerHTML = art
            ? `<img class="img" src="${art}" alt="">
              <div class="info"><div class="row"><span class="num">${w.n}</span><span class="nm">${Lang.t('world.' + w.n)}</span><span class="meta">${meta}</span></div>
              <div class="pbar"><i style="width:${pct}%"></i></div></div>
              <div class="dots">${dots}</div><img class="done" src="${HUD_ICON.check}" alt="">
              <div class="lock"><img src="${HUD_ICON.lock}" alt=""><span>${Lang.t('world.locked', { n: w.needN })}</span></div>`
            : `<div class="band bo-checker" style="background-color:${bands[(w.n - 1) % 3]}"></div>
              <div class="top"><span class="num">${w.n}</span><span class="nm">${Lang.t('world.' + w.n)}</span></div>
              <div class="meta">${meta}</div><div class="pbar"><i style="width:${pct}%"></i></div>
              <div class="dots">${dots}</div><img class="done" src="${HUD_ICON.check}" alt="">
              <div class="lock"><img src="${HUD_ICON.lock}" alt=""><span>${Lang.t('world.locked', { n: w.needN })}</span></div>`;
        const idx = worlds.indexOf(w);
        const l = this.el.menu.querySelector('.wsel .arr.l'), r = this.el.menu.querySelector('.wsel .arr.r');
        if (l) l.classList.toggle('is-off', idx <= 0);
        if (r) r.classList.toggle('is-off', idx >= worlds.length - 1);
        const play = this.el.menu.querySelector('.menu-play');
        if (play) play.classList.toggle('is-off', !!w.locked);
    },

    setPlayLabel(key) { const s = this.el.menu.querySelector('.menu-play span'); if (s) s.textContent = Lang.t(key); },
    setHot(name, on) { const b = this.el.menu.querySelector('[data-m="' + name + '"]'); if (b) b.classList.toggle('hot', !!on); },

    // ---- оверлеи ----
    overlay(html, buttons) {
        const o = this.el.over;
        o.innerHTML = `<div class="over-panel bo-panel"><div class="band bo-checker"></div>${html}<div class="over-btns"></div></div>`;
        const box = o.querySelector('.over-btns');
        for (const row of buttons) {
            const holder = Array.isArray(row) ? Object.assign(document.createElement('div'), { className: 'row' }) : box;
            if (Array.isArray(row)) box.appendChild(holder);
            for (const b of Array.isArray(row) ? row : [row]) {
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'bo-btn';
                btn.style.setProperty('--c', b.color || 'var(--bo-green)');
                btn.innerHTML = (b.icon ? `<img class="bo-ico" src="${b.icon}" alt="">` : '') + `<span>${Lang.t(b.key, b.params)}</span>`;
                if (b.off) btn.classList.add('is-off');
                let done = false;
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (done || btn.classList.contains('is-off')) return;
                    if (!b.keep) done = true;
                    this._click(); b.fn();
                });
                holder.appendChild(btn);
            }
        }
        o.classList.add('on');
    },
    closeOverlay() { this.el.over.classList.remove('on'); this.el.over.innerHTML = ''; },
    overlayOpen() { return this.el.over.classList.contains('on'); },

    showPause(h) {
        this.overlay(`<h2>${Lang.t('pause.title')}</h2>`, [
            { key: 'pause.resume', icon: HUD_ICON.play, fn: h.resume },
            [{ key: 'menu.garage', icon: HUD_ICON.shop, color: 'var(--bo-orange)', fn: h.garage }, { key: 'menu.settings', icon: HUD_ICON.settings, color: 'var(--bo-purple)', fn: h.settings }],
            [{ key: 'pause.restart', icon: HUD_ICON.restart, color: 'var(--bo-sky)', fn: h.restart }, { key: 'pause.menu', icon: HUD_ICON.home, color: 'var(--bo-red)', fn: h.menu }],
        ]);
    },

    showFinish(d, h) {
        const rec = d.record ? `<div class="rec">${Lang.t('finish.record')}</div>` : '';
        const html = `<h2>${Lang.t('finish.title')}</h2><div class="sub">${Lang.t('world.n', { n: d.n })} · ${Lang.t('world.' + d.n)}</div>${rec}
          <div class="stats"><div class="stat"><b>${Lang.t('finish.time')}</b><span>${this.fmt(d.time)}</span></div>
          <div class="stat"><b>${Lang.t('finish.best')}</b><span>${this.fmt(d.best)}</span></div>
          <div class="stat"><b>${Lang.t('finish.coins')}</b><span><img src="${HUD_ICON.coin}" alt="">+${d.coins}</span></div>
          <div class="stat"><b>${Lang.t('finish.deaths')}</b><span><img src="${HUD_ICON.skull}" alt="">${d.deaths}</span></div></div>
          ${d.all ? `<div class="sub">${Lang.t('finish.all')}</div>` : ''}`;
        const btns = [];
        if (h.next) btns.push({ key: 'finish.next', icon: HUD_ICON.arrow, fn: h.next });
        btns.push([{ key: 'finish.again', icon: HUD_ICON.restart, color: 'var(--bo-sky)', fn: h.again }, { key: 'finish.menu', icon: HUD_ICON.home, color: 'var(--bo-purple)', fn: h.menu }]);
        this.overlay(html, btns);
    },
};

// Пикабу: название только по-русски — логотип меню на всех языках
if (String(GAME_PLATFORM) === 'pikabu' && typeof LANG_STRINGS !== 'undefined') for (const c of Object.keys(LANG_STRINGS)) Object.assign(LANG_STRINGS[c], { 'game.title1': 'Велосипед', 'game.title2': 'в небе' });
