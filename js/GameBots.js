// GameBots.js — боты, похожие на живых игроков: едут на той же физике велосипеда (createBike), сами
// проходят трассу по маршруту карты (маркеры route-N: точка на линии езды, scale[0] — доля скорости,
// scale[1] — действие: 1 едем, 2 прыжок здесь, 3 приземление), ошибаются по своему умению, падают и
// возвращаются на свой чекпоинт, доезжают до финиша и радуются. У каждого — свой скин, велосипед, ник
// (на языке игры) и табличка над головой. Игрок сбивает бота, если наезжает на него быстрее
// BOT_KNOCK_SPEED; медленно — просто расталкиваются. Ботов держим рядом с игроком: отставший далеко
// бот «выходит», а рядом «заходит» новый (как в живом сервере). Дальних ботов не считаем.

const BOT_NAMES = {
    ru: ['Вжух', 'Колёсико', 'Педалька', 'Шустрик', 'Кексик', 'Молния', 'ДимаПро', 'Сашка_2013', 'Котлетка', 'Велоёжик',
        'Турбо', 'Пушистик', 'Драйвер', 'Рыжик', 'Бублик', 'Скорость', 'Ниндзя', 'Зайка', 'Гонщик77', 'Тимоха',
        'Ласточка', 'Кирюха', 'Пельмешка', 'Оладушек', 'Вася_Ракета', 'Супербайк', 'Колян', 'Мармеладка', 'Шторм', 'Пломбир'],
    en: ['Zoomer', 'Pedalz', 'SpeedyKid', 'Wheelie', 'Turbo', 'Biscuit', 'Flash', 'MaxPro', 'Rocket_Ray', 'Noodle',
        'Pickles', 'Nova', 'Bolt', 'Sprinkles', 'Ziggy', 'Comet', 'Pixel', 'Muffin', 'Blaze', 'Skippy'],
};

const BOTS_CSS = `
#bo-tags { position: fixed; inset: 0; pointer-events: none; z-index: 15; overflow: hidden; font-family: var(--bo-font); }
#bo-tags .tag { position: absolute; left: 0; top: 0; transform-origin: 50% 100%; white-space: nowrap; color: #fff; font-size: 15px;
  padding: 1px 8px 2px; border-radius: 9px; background: rgba(27,18,64,.55); text-shadow: var(--bo-outline-thin); will-change: transform; }
#bo-tags .tag.off { display: none; }
body.meta-open #bo-tags { display: none; }
`;

/** @satisfies {Record<string, any>} */
const Bots = {
    /** @type {any} */ app: null,
    /** @type {any[]} */ list: [],
    /** @type {any[]} */ route: [],
    /** @type {number[]} */ cpRoute: [],
    /** @type {HTMLElement | null} */ tags: null,
    _names: [],
    _gen: 0,

    init(app) {
        this.app = app;
        const st = document.createElement('style');
        st.id = 'bo-bots-css'; st.textContent = BOTS_CSS;
        document.head.appendChild(st);
        const box = document.createElement('div');
        box.id = 'bo-tags';
        document.body.appendChild(box);
        this.tags = box;
    },

    count() {
        const U = 'undefined';
        const n = IS_MOBILE ? (typeof BOT_COUNT_MOBILE !== U ? BOT_COUNT_MOBILE : 4) : (typeof BOT_COUNT !== U ? BOT_COUNT : 6);
        const q = typeof Quality !== 'undefined' && Quality.level != null ? Number(Quality.level) : 2;
        return Math.max(0, q <= 0 ? Math.min(n, 3) : n);
    },

    // ---------------------------------------------------------------------------------------------
    // Маршрут мира
    // ---------------------------------------------------------------------------------------------

    /** Под экраном загрузки мира: маршрут из маркеров, привязка чекпоинтов, новые боты. */
    async build(app, cps, spawn, finish) {
        this.clear();
        const loc = app.location;
        const num = (d) => { const m = /-(\d+)$/.exec(String(d.name)); return m ? Number(m[1]) : 0; };
        const pt = (d) => ({ x: Number(d.x) || 0, y: Number(d.h) || 0, z: Number(d.y) || 0,
            yaw: ((Array.isArray(d.rot) ? Number(d.rot[1]) : Number(d.rot)) || 0) * Math.PI / 180,
            s: Array.isArray(d.scale) ? Math.max(0.3, Math.min(1, Number(d.scale[0]) || 1)) : 1,
            f: Array.isArray(d.scale) ? Math.round(Number(d.scale[1]) || 1) : 1 });
        let route = loc.markers('route').slice().sort((a, b) => num(a) - num(b)).map(pt);
        if (route.length < 8) route = this._fallbackRoute([spawn].concat(cps, finish ? [finish] : []).filter(Boolean).map(pt));
        this.route = route;
        // какой точке маршрута соответствует каждый чекпоинт (ближайшая по порядку)
        this.cpRoute = [];
        let from = 0;
        for (const d of cps) {
            const p = pt(d);
            let best = from, bd = Infinity;
            for (let i = from; i < route.length; i++) {
                const dd = (route[i].x - p.x) ** 2 + (route[i].z - p.z) ** 2 + ((route[i].y - p.y) * 2) ** 2;
                if (dd < bd) { bd = dd; best = i; }
            }
            this.cpRoute.push(best);
            from = best;
        }
        this._mapHazards();
        const n = this.count();
        const jobs = [];
        for (let i = 0; i < n; i++) jobs.push(this._spawn(i));
        await Promise.all(jobs);
    },

    // Опасности у точек маршрута: высокие балки, молоты (выждать момент), движущиеся плиты (дождаться плиту).
    _mapHazards() {
        const R = this.route;
        this.haz = R.map(() => null);
        for (const p of Course.pieces) {
            if (!p.dynamic || !p.base) continue;
            const O = p.base.O;
            const isSpin = p.type === 'spinner' && p.sy > 55;          // низкую перепрыгивают
            const isHammer = p.type === 'hammer';
            const isMove = p.prm.role === 'move';
            if (!isSpin && !isHammer && !isMove) continue;
            const reach = isSpin ? p.sx / 2 + 90 : isHammer ? p.sy + p.sx / 2 + 110 : Math.max(p.sx, p.sz) / 2 + 40;
            for (let i = 0; i < R.length; i++) {
                const q = R[i];
                if (Math.hypot(q.x - O[0], q.z - O[2]) > reach || Math.abs(q.y - O[1]) > 600) continue;
                (this.haz[i] || (this.haz[i] = [])).push({ p, kind: isSpin ? 'spin' : isHammer ? 'hammer' : 'move' });
            }
        }
        // зоны балок и молотов: от первой до последней задетой точки маршрута (въезд — с запасом на 1 точку раньше)
        /** @type {any[]} */
        const zones = [];
        for (let i = 0; i < R.length; i++) for (const h of this.haz[i] || []) {
            if (h.kind === 'move') continue;
            const z = zones.find(q => q.p === h.p && i - q.i1 <= 2);
            if (z) z.i1 = i; else zones.push({ p: h.p, h, i0: i, i1: i });
        }
        this.zones = zones;
    },

    // Проскочит ли бот зону целиком, если поедет сейчас: прибытие к каждой точке зоны по разгону до vz.
    _zoneClear(b, z) {
        const R = this.route, B = b.bike;
        const a = typeof BIKE_ACCEL !== 'undefined' ? BIKE_ACCEL : 1600, vz = 1150;
        let v = Math.max(0, B.vf), dist = 0, prev = { x: B.p[0], z: B.p[2] }, t = 0;
        const t0 = Course.time;
        for (let j = b.ri; j <= z.i1 + 1 && j < R.length; j++) {
            const q = R[j];
            const d = Math.hypot(q.x - prev.x, q.z - prev.z);
            prev = q; dist += d;
            // время на отрезок с разгоном до vz
            const v2 = Math.min(vz, Math.sqrt(v * v + 2 * a * d));
            t += d / Math.max(120, (v + v2) / 2);
            v = v2;
            if (j < z.i0) continue;
            for (const dtw of [-0.22, 0, 0.22]) if (this._danger(z.h, q, t0 + t + dtw)) return false;
        }
        return true;
    },

    // Опасность h в точке q в момент времени трассы t (те же формулы, что у Course._pose).
    _danger(h, q, t) {
        const p = h.p, B = p.base;
        if (h.kind === 'spin') {
            const rpm = p.anim && Number(p.anim.speed) > 0 ? Number(p.anim.speed) : 12;
            const ang = rpm / 60 * Math.PI * 2 * (p.anim && p.anim.dir === 'cw' ? -1 : 1) * t;
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const dx = B.ax[0] * ca - B.az[0] * sa, dz = B.ax[2] * ca - B.az[2] * sa;   // направление балки
            const rx = q.x - B.O[0], rz = q.z - B.O[2];
            const along = rx * dx + rz * dz, across = Math.abs(rx * dz - rz * dx);
            return Math.abs(along) <= p.sx / 2 + 40 && across < Math.max(16, p.sz / 2) + 95;
        }
        if (h.kind === 'hammer') {
            const T = Math.max(0.5, p.prm.t || 2.6), A = (p.prm.a || 70) * Math.PI / 180;
            const phi = A * Math.sin(2 * Math.PI * (t / T + (p.prm.ph || 0)));
            const L = p.sy, lat = L * Math.sin(phi), low = L * (1 - Math.cos(phi));
            const hx = B.O[0] + B.az[0] * lat, hz = B.O[2] + B.az[2] * lat;
            return low < 160 && Math.hypot(q.x - hx, q.z - hz) < p.sx / 2 + 110;
        }
        // движущаяся плита: ехать на неё, когда она у базовой позы
        const T = Math.max(0.3, p.prm.t || 4), sv = Math.sin(2 * Math.PI * (t / T + (p.prm.ph || 0)));
        const off = Math.hypot((p.prm.x || 0) * sv, (p.prm.y || 0) * sv * 0.5, (p.prm.z || 0) * sv);
        return off > 120;
    },

    /** Впереди опасно в момент прибытия: вернуть true — притормозить и выждать. */
    _hazardAhead(b) {
        const R = this.route, B = b.bike;
        if (!this.haz) return false;
        const v = Math.max(350, Math.abs(B.vf));
        let dist = 0, prev = { x: B.p[0], z: B.p[2] };
        for (let j = b.ri; j < Math.min(R.length, b.ri + 8); j++) {
            const q = R[j];
            dist += Math.hypot(q.x - prev.x, q.z - prev.z);
            prev = q;
            if (dist > 900) break;
            const hs = this.haz[j];
            if (!hs) continue;
            if (dist < 70) return false;                               // уже в зоне — только вперёд
            const tau = dist / v, t = Course.time;
            for (const h of hs) {
                if (h.kind === 'move') {
                    // плиту ждём у точки перед ней: впрыгнуть, когда подъедет к базе
                    if (dist < 420 && (this._danger(h, q, t + tau) || this._danger(h, q, t + tau + 0.35))) return true;
                } else if (this._danger(h, q, t + tau - 0.15) || this._danger(h, q, t + tau) || this._danger(h, q, t + tau + 0.3)) return true;
            }
        }
        return false;
    },

    // Без маркеров маршрута: прямые между чекпоинтами, точки через ~300 px (боты будут чаще падать).
    _fallbackRoute(pts) {
        const out = [];
        for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i], b = pts[i + 1];
            const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 300));
            const yaw = Math.atan2(b.z - a.z, b.x - a.x);
            for (let k = 0; k < n; k++) { const t = k / n; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, yaw, s: 0.8, f: 1 }); }
        }
        if (pts.length) out.push(Object.assign({}, pts[pts.length - 1], { s: 0.6, f: 1 }));
        return out;
    },

    clear() {
        for (const b of this.list) this._dispose(b);
        this.list = [];
    },

    _dispose(b) {
        try { if (b.bikeRig) b.bikeRig.dispose(); } catch (e) { /* уже */ }
        try { if (b.riderRig) b.riderRig.dispose(); } catch (e) { /* уже */ }
        try { if (b.hat) World3D.removeObject(this.app.location.view, b.hat); } catch (e) { /* уже */ }
        if (b.tag) b.tag.remove();
    },

    // ---------------------------------------------------------------------------------------------
    // Боты: вид, имя, место
    // ---------------------------------------------------------------------------------------------

    _name() {
        const lang = typeof Lang !== 'undefined' && Lang.code === 'en' ? 'en' : 'ru';
        const list = BOT_NAMES[lang];
        if (!this._names.length) this._names = list.slice().sort(() => Math.random() - 0.5);
        return this._names.pop();
    },

    _pick(tab, filter) {
        if (typeof SHOP_ITEMS === 'undefined') return null;
        const pool = SHOP_ITEMS.filter(it => it.tab === tab && (!filter || filter(it)));
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    },

    async _spawn(i) {
        const view = this.app.location.view;
        const bikeItem = this._pick('bikes', it => !it.exclusive) || { model: LOOK_DEFAULT_BIKE, color: 0x2f7fe0 };
        const skin = this._pick('skins', it => !it.exclusive);
        const hatItem = Math.random() < 0.45 ? this._pick('hats', it => !it.exclusive && it.model) : null;
        const bm = await Look._model(bikeItem.model || LOOK_DEFAULT_BIKE), rm = await Look._model(LOOK_RIDER);
        if (!bm || !rm) return;
        const b = {
            bike: createBike(), name: this._name(), skill: 0, ri: 0, cpRi: 0, state: 'ride', deadT: 0, waitT: 0, wait: 0, crankVis: 0,
            jumpedAt: -1, far: 0, fly: null, cheerT: 0, noise: Math.random() * 10, gen: ++this._gen,
            bikeRig: Rig.create(bm, view, { name: 'bot-bike' }), riderRig: Rig.create(rm, view, { name: 'bot-rider' }), hat: null, ikb: null, tag: null,
        };
        b.bikeRig.root.rotationQuaternion = new BABYLON.Quaternion();
        b.riderRig.root.parent = b.bikeRig.root;
        Look._tint(b.bikeRig, 'Frame', bikeItem.color);
        Look._tint(b.bikeRig, 'Fork', bikeItem.color);
        const L = (skin && skin.look) || { skin: 0xf4d6b0, shirt: 0x3e7bfa, pants: 0x2a2f45, hair: 'spiky', hairColor: 0x3b2a1a, face: 'smile', acc: [] };
        const r = b.riderRig;
        Look._tint(r, 'Head', L.skin); Look._tint(r, 'Torso', L.shirt); Look._tint(r, 'Hand_', L.skin);
        for (const pre of ['Arm_', 'UpperArm_', 'LowerArm_']) Look._tint(r, pre, L.arms != null ? L.arms : L.shirt);
        for (const pre of ['Leg_', 'UpperLeg_', 'LowerLeg_']) Look._tint(r, pre, L.pants);
        r.setPartVisible('Hair_', false); if (L.hair) { r.setPartVisible('Hair_' + L.hair, true); Look._tint(r, 'Hair_' + L.hair, L.hairColor); }
        r.setPartVisible('Face_', false); r.setPartVisible('Face_' + (L.face || 'smile'), true);
        r.setPartVisible('Acc_', false); for (const a of L.acc || []) r.setPartVisible('Acc_' + a, true);
        if (hatItem) {
            try { const hm = await Model3D.load(hatItem.model); b.hat = Model3D.build(hm, view.scene, { name: 'bot-hat' }); World3D.addObject(view, b.hat, 'actor'); r.attach('Hat', b.hat, {}); } catch (e) { /* без шапки */ }
        }
        if (r.has('idle')) r.play('idle', { at: Math.random() });
        b.ikb = Look.ikBinding(b.bikeRig);
        const tag = document.createElement('div');
        tag.className = 'tag off';
        tag.textContent = b.name;
        if (this.tags) this.tags.appendChild(tag);
        b.tag = tag;
        b.bike.isBot = true;
        b.bike.on.die = (reason) => this._die(b, reason);
        this._place(b, this._nearIndex(i));
        this.list.push(b);
    },

    /** Точка маршрута рядом с игроком: свой чекпоинт игрока ±, ближние — с небольшой задержкой старта. */
    _nearIndex(i) {
        const cp = typeof Game !== 'undefined' ? Game.cp : 0;
        const pick = Math.max(0, Math.min(this.cpRoute.length, cp + Math.floor(Math.random() * 3) - 1));
        let ri = pick <= 0 ? 0 : this.cpRoute[pick - 1];
        // ботов на одной точке разводим по маршруту на пару десятков точек вперёд
        ri = Math.min(this.route.length - 2, ri + (i % 3) * 3 + Math.floor(Math.random() * 4));
        return Math.max(0, ri);
    },

    _place(b, ri) {
        const R = this.route;
        if (!R.length) return;
        ri = this._safeIndex(Math.max(0, Math.min(R.length - 1, ri)));
        const p = R[ri], nx = R[Math.min(R.length - 1, ri + 1)];
        const yaw = nx !== p ? Math.atan2(nx.z - p.z, nx.x - p.x) : p.yaw;
        b.bike.reset(p.x, p.y, p.z, yaw);
        b.ri = ri;
        b.cpRi = Math.max(ri, b.cpRi && this.cpRoute.includes(b.cpRi) && b.cpRi <= ri ? b.cpRi : ri);
        b.state = 'ride';
        b.fly = null;
        b.far = 0;
        b.skill = (typeof BOT_SKILL_MIN !== 'undefined' ? BOT_SKILL_MIN : 0.55) + Math.random() * ((typeof BOT_SKILL_MAX !== 'undefined' ? BOT_SKILL_MAX : 0.95) - (typeof BOT_SKILL_MIN !== 'undefined' ? BOT_SKILL_MIN : 0.55));
        b.waitT = 0.4 + Math.random() * 2.5;   // как живой игрок: стартует не сразу
        b.riderRig.root.parent = b.bikeRig.root;
        b.riderRig.root.position.set(0, 0, 0);
        b.riderRig.root.rotationQuaternion = new BABYLON.Quaternion();
        if (b.riderRig.has('idle')) b.riderRig.play('idle', { fade: 0.05, at: Math.random() });   // не кувырок: он — только в падении
        else b.riderRig.stop('base', 0);
        b.bikeRig.root.setEnabled(true);
        b.invT = typeof BOT_SPAWN_SHIELD !== 'undefined' ? BOT_SPAWN_SHIELD : 3;   // после появления сбить нельзя
        b.stuckT = 0; b.bestD = Infinity; b.turnT = 0; b.waited = 0; b.recklessT = 0; b.jumpedAt = -1;
        b.rash = Math.random() < (1 - b.skill) * 0.5;   // торопыга: не выжидает препятствия (как неопытный игрок)
        b.reckless = b.rash;
        this._pose(b);
    },

    // Точка маршрута, под которой есть опора (назад по маршруту до первой такой, иначе — старт).
    _safeIndex(ri) {
        const R = this.route;
        for (let i = ri; i >= 0; i--) {
            const p = R[i], hit = Course.rayDown(p.x, p.y + 60, p.z, 120);
            if (hit && Math.abs(hit.y - p.y) < 40 && !hit.col.kill && !hit.col.dynamic) return i;
        }
        return 0;
    },

    /** Бот «перезаходит» рядом с игроком под новым ником. */
    _rejoin(b) {
        b.name = this._name();
        if (b.tag) b.tag.textContent = b.name;
        this._place(b, this._nearIndex(Math.floor(Math.random() * 3)));
    },

    // ---------------------------------------------------------------------------------------------
    // Кадр
    // ---------------------------------------------------------------------------------------------

    update(dt, playerRiding) {
        const R = this.route;
        if (!R.length || !this.list.length) return;
        const P = Bike.p;
        for (const b of this.list) {
            const B = b.bike;
            const dx = B.p[0] - P[0], dz = B.p[2] - P[2], d2 = dx * dx + dz * dz;
            // далеко от игрока — «выходит», рядом заходит новый
            if (d2 > 15000 * 15000) { b.far += dt; if (b.far > 6) this._rejoin(b); }
            else b.far = 0;
            const near = d2 < 9000 * 9000;
            b.bikeRig.root.setEnabled(near);
            if (!near) { if (b.tag) b.tag.classList.add('off'); continue; }
            if (b.state === 'ride') this._drive(b, dt, d2 < 4000 * 4000 ? 180 : 100);
            else if (b.state === 'dead') {
                b.deadT -= dt;
                this._flyRider(b, dt);
                if (b.deadT <= 0) {
                    // как живой игрок: застрял на одном участке — «пропускает этап» до следующего чекпоинта
                    const tries = typeof BOT_SKIP_AFTER !== 'undefined' ? BOT_SKIP_AFTER : 5;
                    b.fails = b.lastCp === b.cpRi ? (b.fails || 0) + 1 : 1;
                    b.lastCp = b.cpRi;
                    if (b.fails >= tries) {
                        const next = this.cpRoute.find(ci => ci > b.cpRi);
                        b.fails = 0;
                        if (next != null) { b.cpRi = next; b.lastCp = next; }
                    }
                    this._place(b, b.cpRi);
                }
            } else if (b.state === 'finish') {
                b.cheerT -= dt;
                if (b.cheerT <= 0) this._rejoin(b);
            }
            if (b.invT > 0) {
                b.invT -= dt;
                const vis = b.invT > 0 ? (Math.floor(b.invT * 8) % 2 ? 0.35 : 0.85) : 1;
                for (const m of b.bikeRig.root.getChildMeshes(false)) m.visibility = vis;
                for (const m of b.riderRig.root.getChildMeshes(false)) m.visibility = vis;
            }
            if (playerRiding && b.state === 'ride') this._touchPlayer(b);
            this._pose(b, dt);
            this._tag(b, Math.sqrt(d2));
        }
    },

    // Автопилот: руль на точку впереди, скорость по точке маршрута и умению, прыжок у точек отрыва.
    _drive(b, dt, hz) {
        const R = this.route, B = b.bike;
        if (b.waitT > 0) { b.waitT -= dt; B.step(dt, { throttle: 0, steer: 0, jump: false }, hz); return; }
        const d2 = (i) => (R[i].x - B.p[0]) ** 2 + (R[i].z - B.p[2]) ** 2;
        const ri0 = b.ri;
        while (b.ri < R.length - 1 && (d2(b.ri + 1) < d2(b.ri) || d2(b.ri) < 90 * 90)) b.ri++;
        if (b.ri !== ri0) { b.bestD = Infinity; b.stuckT = 0; }
        // чекпоинт бота — последняя пройденная привязанная точка
        for (const ci of this.cpRoute) if (ci <= b.ri && ci > b.cpRi) b.cpRi = ci;
        if (b.ri >= R.length - 2 && d2(R.length - 1) < 400 * 400) {
            b.state = 'finish'; b.cheerT = 3.5;
            if (b.riderRig.has('cheer')) b.riderRig.play('cheer', { fade: 0.2 });
            return;
        }
        const dn = Math.sqrt(d2(Math.min(R.length - 1, b.ri + 1)));
        if (dn < b.bestD - 40) { b.bestD = dn; b.stuckT = 0; } else b.stuckT += dt;
        if (b.stuckT > 4) { b.bestD = Infinity; this._place(b, b.cpRi); return; }
        let ti = b.ri;
        const look = 170 + Math.max(0, B.vf) * 0.12;
        while (ti < R.length - 1 && d2(ti) < look * look) ti++;
        let T = R[ti];
        // на движущейся/вращающейся опоре перед прыжком — цель с поправкой на её скорость (снесёт в полёте)
        const vg = B.grounded && B.wheels.some(w => w.contact && w.col && w.col.dynamic) ? B._groundVel() : null;
        const jk = R.slice(b.ri, b.ri + 3).findIndex(q => q.f === 2);
        if (vg && jk >= 0) {
            const L = R[Math.min(R.length - 1, b.ri + jk + 1)], air = 0.8;
            T = { x: L.x - vg[0] * air, z: L.z - vg[2] * air, y: L.y, s: R[ti].s, f: 1, yaw: 0 };
        } else if (vg) {
            // едем по диску/плите: опора уносит — целимся с упреждением на время до точки
            const tt = Math.hypot(T.x - B.p[0], T.z - B.p[2]) / Math.max(300, Math.abs(B.vf));
            T = { x: T.x - vg[0] * tt, z: T.z - vg[2] * tt, y: T.y, s: Math.max(R[ti].s, 0.85), f: 1, yaw: 0 };
        }
        b.aim = T;
        const want = Math.atan2(T.z - B.p[2], T.x - B.p[0]);
        let a = want - B.yaw;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > 1.6) b.turnT += dt; else b.turnT = 0;
        if (b.turnT > 1.8) { this._place(b, b.cpRi); return; }   // цель позади — не кружить на месте
        b.noise += dt * 0.7;
        const wobble = Math.sin(b.noise * 2.3) * (1 - b.skill) * 0.25;
        const steer = Math.max(-1, Math.min(1, a * 2.6 + wobble));
        const vmax = typeof BIKE_MAX_SPEED !== 'undefined' ? BIKE_MAX_SPEED : 1300;
        const onMove = B.grounded && B.wheels.some(w => w.contact && w.col && w.col.dynamic);
        const target = Math.max(320, vmax * (onMove ? 0.85 : Math.min(R[b.ri].s, R[ti].s + 0.15)) * (0.7 + 0.3 * b.skill));
        // скорость под прыжок: долететь от точки отрыва до точки приземления, а не перелететь островок
        const g = typeof BIKE_GRAVITY !== 'undefined' ? BIKE_GRAVITY : 3200, vj = typeof BIKE_JUMP_SPEED !== 'undefined' ? BIKE_JUMP_SPEED : 1300;
        let tgt = target;
        for (let k = Math.max(0, b.ri - 1); k <= Math.min(R.length - 2, b.ri + 3); k++) {
            if (R[k].f !== 2 || b.jumpedAt === k) continue;
            const L = Math.hypot(R[k + 1].x - R[k].x, R[k + 1].z - R[k].z), dh = R[k + 1].y - R[k].y;
            const disc = vj * vj - 2 * g * Math.max(0, dh);
            const air = (vj + Math.sqrt(Math.max(0, disc))) / g;          // время полёта до высоты приземления
            const want = Math.max(300, Math.min(1500, (L + 70) / Math.max(0.3, air)));
            tgt = Math.min(tgt, want * (0.97 + 0.06 * Math.sin(b.noise + k)));
            break;
        }
        // поворот впереди: чем круче, тем медленнее (иначе вынесет с узкой дорожки)
        {
            let turn = 0, prevYaw = B.yaw, dist = 0, prev = { x: B.p[0], z: B.p[2] };
            for (let k = b.ri; k < Math.min(R.length - 1, b.ri + 6) && dist < 420; k++) {
                const q = R[k + 1], y = Math.atan2(q.z - R[k].z, q.x - R[k].x);
                dist += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q;
                let dy = y - prevYaw; dy = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy)));
                turn = Math.max(turn, dy);
            }
            const vc = vmax * Math.max(0.14, Math.min(1, 1.05 - turn / 1.5));
            tgt = Math.min(tgt, vc);
        }
        let throttle = B.vf < tgt - 120 ? 1 : (B.vf > tgt + 140 ? -0.7 : Math.max(0.15, Math.min(1, tgt / vmax)));
        if (Math.abs(a) > 0.9) throttle = Math.min(throttle, 0.25);
        b.hzT = (b.hzT || 0) - dt;
        const zone = (this.zones || []).find(z => z.i1 >= b.ri && z.i0 - b.ri <= 4);
        const inZone = zone && b.ri >= zone.i0;
        if (inZone) throttle = 1;                                   // в зоне балки — проскочить быстрее
        if (b.hzT <= 0) {
            b.hzT = 0.08;
            const near = zone && !inZone && d2(Math.max(0, zone.i0 - 1)) < 380 * 380;
            b.hzWait = !b.reckless && ((near && !this._zoneClear(b, zone)) || (!zone && this._hazardAhead(b)));
        }
        if (b.hzWait) {
            b.waited = (b.waited || 0) + dt;
            if (b.waited > 6) { b.reckless = true; b.recklessT = 2; }   // устал ждать — рискнёт
            throttle = B.vf > 120 ? -0.8 : 0; b.bestD = Infinity; b.stuckT = 0;
        } else b.waited = 0;
        if (b.recklessT > 0) { b.recklessT -= dt; if (b.recklessT <= 0) b.reckless = b.rash; }
        // прыжок у точки отрыва (с ошибкой по умению); и как у человека — прыгнуть, если впереди обрыв
        let jump = false;
        // точка отрыва: проверяем и только что пройденную (индекс переключается чуть раньше самой точки)
        for (let k = Math.max(0, b.ri - 2); k <= Math.min(R.length - 1, b.ri + 2); k++) {
            if (R[k].f !== 2 || b.jumpedAt === k) continue;
            const err = (1 - b.skill) * 45 * Math.sin(b.noise * 3.1 + k);
            const q = R[k], fx = Math.cos(B.yaw), fz = Math.sin(B.yaw);
            const ahead = (q.x - B.p[0]) * fx + (q.z - B.p[2]) * fz;          // >0 — точка ещё впереди
            const lead = 40 + Math.max(0, B.vf) * 0.03 + err;                   // прыгать чуть раньше края
            if (d2(k) < 260 * 260 && ahead < lead && B.grounded) {
                // прыгаем, только глядя на точку приземления; не довернул — тормозим у края и доворачиваем
                const L = b.aim && vg ? b.aim : (R[k + 1] || q), ly = Math.atan2(L.z - B.p[2], L.x - B.p[0]);
                let off = ly - B.yaw; off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
                const moving = !!vg;                                           // диск/движущаяся плита: стоять нельзя — снесёт
                if (off < (moving ? 0.5 : 0.22 + (1 - b.skill) * 0.12) || (moving && ahead < -30)) { jump = true; b.jumpedAt = k; }
                else if (!moving) b.alignBrake = 0.25;
                break;
            }
        }
        if (!jump && B.grounded && b.skill > 0.7 && Math.abs(a) < 0.25 && !R.slice(b.ri, b.ri + 3).some(q => q.f === 2)) {
            const fx = Math.cos(B.yaw), fz = Math.sin(B.yaw), ahead = 110 + Math.max(0, B.vf) * 0.12;
            const hit = Course.rayDown(B.p[0] + fx * ahead, B.p[1] + 120, B.p[2] + fz * ahead, 400);
            const nxt = R[Math.min(R.length - 1, b.ri + 1)];
            if (!hit && nxt.y > B.p[1] - 250) jump = true;
        }
        if (b.alignBrake > 0) { b.alignBrake -= dt; throttle = B.vf > 200 ? -1 : 0.2; }
        B.step(dt, { throttle, steer, jump }, hz);
    },

    _die(b, reason) {
        void reason;
        if (b.state !== 'ride') return;
        b.state = 'dead';
        b.deadT = 1.3 + Math.random() * 0.8;
        const r = b.riderRig, wp = r.root.getAbsolutePosition().clone();
        r.root.parent = null;
        r.root.rotationQuaternion = r.root.rotationQuaternion || new BABYLON.Quaternion();
        const B = b.bike;
        b.fly = { p: [wp.x, wp.y + 30, wp.z], v: [B.v[0] * 0.8 + (b.kick ? b.kick[0] : 0), Math.max(500, B.v[1] + 650), B.v[2] * 0.8 + (b.kick ? b.kick[2] : 0)], spin: 0, yaw: B.yaw };
        b.kick = null;
        if (r.has('crash')) r.play('crash', { fade: 0.1 });
    },

    _flyRider(b, dt) {
        const f = b.fly, r = b.riderRig;
        if (!f) return;
        f.v[1] -= 3200 * dt;
        f.p[0] += f.v[0] * dt; f.p[1] += f.v[1] * dt; f.p[2] += f.v[2] * dt;
        f.spin += dt * 7;
        r.root.position.set(f.p[0], f.p[1], f.p[2]);
        r.root.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(-f.yaw, f.spin * 0.6, f.spin);
        if (b.deadT < 0.4) b.bikeRig.root.setEnabled(false);
    },

    // Игрок наехал на бота: быстрее BOT_KNOCK_SPEED — бот слетает с велосипеда; медленнее — расталкиваемся.
    _touchPlayer(b) {
        const B = b.bike, P = Bike;
        const dx = B.p[0] - P.p[0], dz = B.p[2] - P.p[2], dy = B.p[1] - P.p[1];
        const d = Math.hypot(dx, dz);
        if (d > 120 || Math.abs(dy) > 170 || d < 1e-3) return;
        const nx = dx / d, nz = dz / d;
        const rel = (P.v[0] - B.v[0]) * nx + (P.v[2] - B.v[2]) * nz;
        const knock = typeof BOT_KNOCK_SPEED !== 'undefined' ? BOT_KNOCK_SPEED : 420;
        if (rel > knock && !(b.invT > 0)) {
            b.kick = [nx * rel * 0.6, 0, nz * rel * 0.6];
            B.v[0] += nx * rel * 0.9; B.v[2] += nz * rel * 0.9; B.v[1] += 500;
            B._die('hit');
            P.v[0] *= 0.82; P.v[2] *= 0.82;
            if (this.on.knock) this.on.knock(b);
            return;
        }
        // мягко развести, без потери управления
        const push = (120 - d) * 0.5;
        B.p[0] += nx * push; B.p[2] += nz * push;
        P.p[0] -= nx * push * 0.4; P.p[2] -= nz * push * 0.4;
        if (rel > 0) { B.v[0] += nx * rel * 0.6; B.v[2] += nz * rel * 0.6; }
    },
    /** @type {Record<string, (...a: any[]) => void>} */
    on: {},

    // Вид: корень по физике, колёса, шатуны, руль, наклон.
    _pose(b, dt) {
        const B = b.bike, rig = b.bikeRig;
        if (!rig) return;
        rig.root.position.set(B.p[0], B.p[1] - (B.visLift || 0), B.p[2]);
        const qy = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -B.yaw);
        const qp = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, B.pitch);
        const ql = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, B.lean);
        rig.root.rotationQuaternion = qy.multiply(qp).multiply(ql);
        const sag = (w) => (w.contact ? Math.max(0, Math.min(30, w.comp)) : 0);
        rig.offset('WheelR', 0, 0, -B.wheelAngle, 0, sag(B.wheels[0]), 0);
        rig.offset('WheelF', 0, 0, -B.wheelAngle, 0, sag(B.wheels[1]), 0);
        rig.offset('Fork', 0, -B.steer, 0);
        if (B.crankRate > 0.5) b.crankVis = B.crank;
        else if (dt) { const tgt = Math.round(b.crankVis / (Math.PI * 2)) * Math.PI * 2; b.crankVis += (tgt - b.crankVis) * Math.min(1, 6 * dt); }
        rig.offset('Crank', 0, 0, -b.crankVis);
        if (b.state === 'ride' && b.riderRig.root.parent === rig.root) {
            const sp = Math.min(1, Math.abs(B.vf) / 1300);
            const air = !B.grounded && B.airTime > 0.08;
            b.riderRig.offset('Hips', 0, 0, 0, 0, air ? 12 : 0, 0);
            b.riderRig.offset('Torso', B.crankRate > 0.5 ? Math.sin(b.crankVis) * 0.05 : 0, B.steer * 0.25, -(0.06 + 0.16 * sp + (air ? 0.12 : 0)));
        }
    },

    /** После Rig.updateAll: ступни и ладони на велосипеде. */
    ik() {
        for (const b of this.list) {
            if (b.state === 'dead' || !b.bikeRig.root.isEnabled()) continue;
            if (b.riderRig.root.parent !== b.bikeRig.root) continue;
            Look.ikFor(b.riderRig, b.ikb, b.bikeRig.root, b.state === 'finish' ? 'cheer' : 'ride');
        }
    },

    _tag(b, dist) {
        const tag = b.tag, view = this.app.location.view;
        if (!tag) return;
        if (typeof Game !== 'undefined' && Game.state !== 'ride' && Game.state !== 'dead') { tag.classList.add('off'); return; }   // в меню — без табличек
        const B = b.bike;
        const s = b.state === 'dead' && b.fly ? { x: b.fly.p[0], y: b.fly.p[2], h: b.fly.p[1] + 230 } : { x: B.p[0], y: B.p[2], h: B.p[1] + 250 };
        const pr = dist < 5500 ? view.projectToScreen(s.x, s.y, s.h) : null;
        if (!pr || !pr.visible || pr.behind) { tag.classList.add('off'); return; }
        tag.classList.remove('off');
        const k = Math.max(0.55, Math.min(1.15, 900 / Math.max(300, dist)));
        tag.style.transform = `translate(${pr.x.toFixed(1)}px, ${pr.y.toFixed(1)}px) translate(-50%, -100%) scale(${k.toFixed(3)})`;
    },
};
