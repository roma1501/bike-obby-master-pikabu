// GameLook.js — как выглядит райдер на велосипеде: риги из Blender (assets/models/rider.glb, bikes/*.glb),
// косметика из Гаража (велосипед и цвет рамы, скин — цвета частей, причёска, лицо, аксессуары; шапка;
// колёса; след), анимация (кручение колёс и шатунов, руль, клипы райдера в такт педалям), вылет райдера
// при падении и превью предметов для карточек Гаража (рендер игровой модели в картинку, кэш).
// Нет файла модели — собирается запасная блочная модель кодом, игра не падает (инвариант 6).

const LOOK_RIDER = 'assets/models/rider.glb';
const LOOK_DEFAULT_BIKE = 'assets/models/bikes/city.glb';

// Следы за велосипедом: вид -> текстура и характер частиц.
const LOOK_TRAILS = {
    dust: { texture: 'assets/fx/dust-puff.webp', blend: 'standard', size: [26, 54], life: [0.5, 0.9], up: 60, alpha: 0.75 },
    sparkle: { texture: 'assets/fx/sparkle-4pt.webp', size: [16, 34], life: [0.35, 0.7], up: 90 },
    stars: { texture: 'assets/fx/rainbow-star.webp', blend: 'standard', size: [20, 34], life: [0.5, 0.9], up: 70, spin: [-3, 3], white: true },
    fire: { texture: 'assets/fx/flame.webp', size: [34, 62], life: [0.25, 0.5], up: 140 },
    smoke: { texture: 'assets/fx/smoke-puff.webp', blend: 'standard', size: [40, 80], life: [0.6, 1.1], up: 50, alpha: 0.7 },
    magic: { texture: 'assets/fx/plasma-orb.webp', size: [20, 40], life: [0.4, 0.8], up: 80 },
    bubbles: { texture: 'assets/fx/bubble.webp', blend: 'standard', size: [16, 36], life: [0.6, 1.2], up: 110, white: true },
    confetti: { texture: 'assets/fx/confetti-color.webp', blend: 'standard', size: [16, 28], life: [0.6, 1.1], up: 160, spin: [-6, 6], white: true },
    rainbow: { texture: 'assets/fx/soft-circle.webp', size: [26, 40], life: [0.5, 0.8], up: 20, rainbow: true },
    flare: { texture: 'assets/fx/flare-gold.webp', size: [26, 48], life: [0.3, 0.6], up: 60 },
    twirl: { texture: 'assets/fx/petal.webp', blend: 'standard', size: [16, 28], life: [0.7, 1.2], up: 90, spin: [-5, 5], white: true },
    snow: { texture: 'assets/fx/snowflake.webp', blend: 'standard', size: [16, 30], life: [0.7, 1.2], up: 40, spin: [-2, 2] },
};

/** Запасной «риг» из кубиков: тот же интерфейс, что у RigInstance (то, чем пользуется Look). */
class LookBlockRig {
    constructor(view, kind) {
        const scene = view.scene;
        this.view = view;
        this.root = new BABYLON.Mesh('block-' + kind, scene);
        /** @type {Map<string, any>} */ this.nodes = new Map();
        /** @type {Map<string, any>} */ this.parts = new Map();
        this._off = new Map();
        this.speed = 1; this.disposed = false; this._clip = '';
        /** @param {string} name @param {any} parent @param {number} x @param {number} y @param {number} z */
        const node = (name, parent, x, y, z) => {
            const tn = new BABYLON.TransformNode(kind + ':' + name, scene);
            tn.parent = parent || this.root; tn.position.set(x, y, z);
            tn.rotationQuaternion = new BABYLON.Quaternion();
            this.nodes.set(name, tn); return tn;
        };
        /** @param {string} name @param {any} parent @param {number} w @param {number} h @param {number} d @param {number} x @param {number} y @param {number} z @param {string} color */
        const box = (name, parent, w, h, d, x, y, z, color) => {
            const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
            const mat = new BABYLON.StandardMaterial(name + '-m', scene);
            mat.diffuseColor = BABYLON.Color3.FromHexString(color); mat.specularColor = new BABYLON.Color3(0, 0, 0);
            m.material = mat; m.parent = parent; m.position.set(x, y, z); m.isPickable = false;
            this.parts.set(name, m); return m;
        };
        if (kind === 'bike') {
            const frame = node('Frame', null, 0, 0, 0);
            box('Frame', frame, 120, 10, 10, 0, 70, 0, '#ffffff');
            box('FrameSeat', frame, 34, 8, 16, -24, 102, 0, '#222222');
            const fork = node('Fork', frame, 44, 0, 0);
            box('Fork', fork, 8, 80, 8, 6, 76, 0, '#999999');
            box('ForkBar', fork, 8, 8, 56, -4, 112, 0, '#333333');
            for (const [name, x] of /** @type {Array<[string, number]>} */ ([['WheelF', 58], ['WheelR', -58]])) {
                const w = node(name, name === 'WheelF' ? fork : frame, name === 'WheelF' ? 14 : x, 42, 0);
                const t = BABYLON.MeshBuilder.CreateTorus(name, { diameter: 76, thickness: 10, tessellation: 24 }, scene);
                t.rotation.x = Math.PI / 2; t.parent = w; t.isPickable = false;
                const mat = new BABYLON.StandardMaterial(name + '-m', scene); mat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12); t.material = mat;
                this.parts.set(name, t);
                box(name + 'Spoke', w, 70, 4, 4, 0, 0, 0, '#cccccc');
            }
            const crank = node('Crank', frame, -5, 40, 0);
            box('Crank', crank, 34, 6, 30, 0, 0, 0, '#444444');
        } else {
            // R15-lite: бедро/голень/стопа, плечо/предплечье/кисть — позу конечностей ставит IK игры
            const hips = node('Hips', null, -22, 104, 0);
            const torso = node('Torso', hips, 0, 4, 0);
            box('Torso', torso, 30, 60, 58, 0, 30, 0, '#ffffff');
            const head = node('Head', torso, 0, 62, 0);
            box('Head', head, 40, 40, 40, 0, 20, 0, '#ffffff');
            box('Face_smile', head, 4, 10, 24, 21, 22, 0, '#111111');
            node('Hat', head, 0, 40, 0);
            for (const [side, z] of /** @type {Array<[string, number]>} */ ([['L', -38], ['R', 38]])) {
                const up = node('UpperArm_' + side, torso, 0, 54, z);
                box('UpperArm_' + side, up, 16, 30, 16, 0, -15, 0, '#ffffff');
                const lo = node('LowerArm_' + side, up, 0, -30, 0);
                box('LowerArm_' + side, lo, 15, 28, 15, 0, -14, 0, '#ffffff');
                node('Hand_' + side, lo, 0, -28, 0);
                const hl = node('UpperLeg_' + side, hips, 0, 0, z * 0.38);
                box('UpperLeg_' + side, hl, 24, 38, 24, 0, -19, 0, '#ffffff');
                const ll = node('LowerLeg_' + side, hl, 0, -38, 0);
                box('LowerLeg_' + side, ll, 22, 36, 22, 0, -18, 0, '#ffffff');
                box('ShoeBlock_' + side, ll, 34, 12, 24, 6, -34, 0, '#222222');
                node('Foot_' + side, ll, 0, -38, 0);
            }
        }
        World3D.addObject(view, this.root, 'actor');
    }
    offset(name, rx, ry, rz) { this._off.set(name, [rx || 0, ry || 0, rz || 0]); }
    update() {
        for (const [name, r] of this._off) { const n = this.nodes.get(name); if (n) BABYLON.Quaternion.RotationYawPitchRollToRef(r[1], r[0], r[2], n.rotationQuaternion); }
        this._off.clear();
    }
    play(name) { this._clip = name; return true; }
    has() { return false; }
    current() { return this._clip; }
    phase() { return 0; }
    setPartVisible(prefix, on) { for (const [name, m] of this.parts) if (name.startsWith(prefix)) m.setEnabled(!!on); }
    attach(nodeName, mesh) { mesh.parent = this.nodes.get(nodeName) || this.root; return mesh; }
    dispose() { this.disposed = true; World3D.removeObject(this.view, this.root); }
}

/** @satisfies {Record<string, any>} */
const Look = {
    /** @type {any} */ view: null,
    /** @type {any} */ bike: null,
    /** @type {any} */ rider: null,
    /** @type {any} */ hat: null,
    /** @type {any[]} */ wheels: [],
    /** @type {any} */ trail: null,
    trailKind: '',
    /** @type {any[]} */ _mats: [],
    /** @type {Record<string, string | null>} */ cur: {},
    /** @type {Record<string, any>} */ _models: {},
    _queue: Promise.resolve(),
    crankVis: 0,
    clip: '',
    state: 'menu',
    rise: 0, bodyLean: 0,
    /** @type {any} */ _ikb: null,
    /** @type {'ride' | 'menu' | 'cheer' | 'crash'} */ pose: 'menu',
    flying: null,
    visible: true,

    init(app) {
        this.view = app.location.view;
        this.app = app;
    },

    item(id) { return id && typeof Shop !== 'undefined' && Shop.item ? Shop.item(id) : null; },

    async _model(url) {
        if (!url) return null;
        if (!(url in this._models)) this._models[url] = Rig.load(url).catch((e) => { console.warn('Look: нет модели ' + url + ' — запасная', e && e.message); return null; });
        return this._models[url];
    },

    /** Надеть набор: look — Shop.look() (слот -> id предмета или null). Последовательно, без гонок. */
    apply(look) {
        this._queue = this._queue.then(() => this._apply(look || {})).catch((e) => console.warn('Look.apply:', e));
        return this._queue;
    },

    async _apply(look) {
        const def = (slot) => {
            const id = look[slot];
            if (id) return id;
            if (typeof SHOP_ITEMS === 'undefined') return null;
            const d = SHOP_ITEMS.find(it => it.slot === slot && it.default);
            return d ? d.id : null;
        };
        const bikeId = def('bike'), skinId = def('skin'), hatId = look.hat || null, wheelsId = def('wheels'), trailId = look.trail || null;
        if (!this.bike || bikeId !== this.cur.bike) { await this._setBike(bikeId); this.cur.wheels = undefined; }
        if (!this.rider) await this._setRider();
        if (skinId !== this.cur.skin) this._setSkin(skinId);
        if (hatId !== this.cur.hat) await this._setHat(hatId);
        if (wheelsId !== this.cur.wheels) await this._setWheels(wheelsId);
        if (trailId !== this.cur.trail) this._setTrail(trailId);
    },

    async _setBike(id) {
        const it = this.item(id);
        const url = (it && it.model) || LOOK_DEFAULT_BIKE;
        const model = await this._model(url);
        const old = this.bike;
        const bike = model ? Rig.create(model, this.view, { name: 'bike' }) : new LookBlockRig(this.view, 'bike');
        bike.root.rotationQuaternion = new BABYLON.Quaternion();
        this.bike = bike;
        if (this.rider) this.rider.root.parent = bike.root;
        if (old) { this._detachWheels(); old.dispose(); }
        const frameColor = it && it.color != null ? it.color : 0x2f7fe0;
        this._tint(bike, 'Frame', frameColor);
        this._tint(bike, 'Fork', frameColor);
        this.cur.bike = id;
        this._bindIK();
        this.place();
    },

    async _setRider() {
        const model = await this._model(LOOK_RIDER);
        const rider = model ? Rig.create(model, this.view, { name: 'rider' }) : new LookBlockRig(this.view, 'rider');
        rider.root.parent = this.bike ? this.bike.root : null;
        this.rider = rider;
        this.clip = '';
    },

    // Перекрасить части рига по префиксу имени: свой клон материала (общие материалы не трогаем).
    _tint(rig, prefix, color, emissive) {
        if (!rig || color == null) return;
        const c = BABYLON.Color3.FromHexString('#' + Number(color).toString(16).padStart(6, '0'));
        for (const [name, mesh] of rig.parts) {
            if (!name.startsWith(prefix)) continue;
            this._tintMesh(mesh, c, emissive);
        }
    },

    _tintMesh(mesh, c, emissive) {
        const one = (m) => {
            const k = m.clone(m.name + '+tint');
            k.diffuseColor = c.clone();
            if (emissive) k.emissiveColor = c.scale(0.55);
            this._mats.push(k);
            return k;
        };
        const mat = mesh.material;
        if (!mat) return;
        if (mat.subMaterials) {
            const multi = new BABYLON.MultiMaterial(mat.name + '+tint', mesh.getScene());
            multi.subMaterials = mat.subMaterials.map(m => (m ? one(m) : m));
            mesh.material = multi;
            this._mats.push(multi);
        } else mesh.material = one(mat);
    },

    _setSkin(id) {
        const it = this.item(id);
        const L = (it && it.look) || { skin: 0xf6cfae, shirt: 0xe8463a, arms: 0xe8463a, pants: 0x2c3e66, hair: 'messy', hairColor: 0x5a3219, face: 'smile', acc: ['hood', 'phones'] };
        const r = this.rider;
        if (!r) return;
        this._tint(r, 'Head', L.skin);
        this._tint(r, 'Torso', L.shirt);
        for (const pre of ['Arm_', 'UpperArm_', 'LowerArm_']) this._tint(r, pre, L.arms != null ? L.arms : L.shirt);
        for (const pre of ['Leg_', 'UpperLeg_', 'LowerLeg_']) this._tint(r, pre, L.pants);
        this._tint(r, 'Hand_', L.skin);
        r.setPartVisible('Hair_', false);
        if (L.hair) { r.setPartVisible('Hair_' + L.hair, true); this._tint(r, 'Hair_' + L.hair, L.hairColor); }
        r.setPartVisible('Face_', false);
        r.setPartVisible('Face_' + (L.face || 'smile'), true);
        r.setPartVisible('Acc_', false);
        for (const a of L.acc || []) r.setPartVisible('Acc_' + a, true);
        this.cur.skin = id;
    },

    async _setHat(id) {
        if (this.hat) { try { World3D.removeObject(this.view, this.hat); } catch (e) { /* уже */ } this.hat = null; }
        this.cur.hat = id;
        const it = this.item(id);
        if (!it || !it.model || !this.rider) return;
        try {
            const model = await Model3D.load(it.model);
            if (this.cur.hat !== id) return;
            const mesh = Model3D.build(model, this.view.scene, { name: 'hat' });
            World3D.addObject(this.view, mesh, 'actor');
            this.rider.attach('Hat', mesh, {});
            this.hat = mesh;
        } catch (e) { console.warn('Look: шапка', it.model, e && e.message); }
    },

    _detachWheels() {
        for (const w of this.wheels) { try { World3D.removeObject(this.view, w); } catch (e) { /* уже */ } }
        this.wheels = [];
        this._clearWheelFx();
    },

    // ---- особые эффекты колёс по редкости: rare — свечение обода и искорки; epic — + светящееся кольцо
    // и сноп искр из-под шины; legendary — + огненные вихри, бегущие по ободу (точки обода крутятся с колесом)
    /** @type {any} */ _wfx: null,

    _clearWheelFx() {
        const w = this._wfx;
        if (!w) return;
        for (const e of w.emitters) { try { e.h.stop(); } catch (er) { /* уже */ } }
        for (const m of w.halos) { try { m.dispose(false, true); } catch (e) { /* уже */ } }
        this._wfx = null;
    },

    _wheelFx(it) {
        this._clearWheelFx();
        const tier = { rare: 1, epic: 2, legendary: 3 }[it && it.rarity] || 0;
        const b = this.bike, app = this.app;
        if (!tier || !b) return;
        const hex = '#' + Number(it.color != null ? it.color : 0xffd23f).toString(16).padStart(6, '0');
        const col = BABYLON.Color3.FromHexString(hex);
        const scene = this.view.scene;
        const w = this._wfx = { tier, halos: [], emitters: [], col, t: 0 };
        const V = BABYLON.Vector3;
        for (const name of ['WheelF', 'WheelR']) {
            const node = b.nodes.get(name);
            if (!node) continue;
            {
                const halo = BABYLON.MeshBuilder.CreateTorus('wheel-halo', { diameter: 92, thickness: [0, 4, 6, 9][tier], tessellation: 40 }, scene);
                const mat = new BABYLON.StandardMaterial('wheel-halo-m', scene);
                mat.disableLighting = true; mat.emissiveColor = col.clone(); mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
                mat.alpha = 0.55; mat.alphaMode = BABYLON.Engine.ALPHA_ADD; mat.backFaceCulling = false; mat.metadata = { toon: false };
                halo.material = mat; halo.parent = node; halo.rotation.x = Math.PI / 2; halo.isPickable = false;
                halo.renderingGroupId = World3D.LAYER.OVERLAY;
                w.halos.push(halo);
            }
            if (!app || !app.fx) continue;
            const rimPt = (ang) => () => V.TransformCoordinates(new V(Math.cos(ang) * 40, Math.sin(ang) * 40, 0), node.getWorldMatrix());
            const ground = () => { const p = node.getAbsolutePosition(); return new V(p.x, p.y - 36, p.z); };
            // искорки с обода
            const sp = app.fx.create({ texture: 'assets/fx/sparkle-4pt.webp', rate: 0, capacity: 60, life: [0.25, 0.55], size: [10, 22], speed: [20, 80],
                follow: rimPt(Math.PI / 2), box: [[-10, -10, -10], [10, 10, 10]], colorGradient: [[0, '#ffffff', 1], [0.4, hex, 0.9], [1, hex, 0]] });
            if (sp) w.emitters.push({ h: sp, kind: 'spark' });
            if (tier >= 2) {
                const spray = app.fx.create({ texture: 'assets/fx/spark-streak.webp', rate: 0, capacity: 90, life: [0.18, 0.4], size: [14, 30], speed: [220, 520],
                    follow: ground, direction: [[-1, 0.4, -0.3], [-0.6, 1, 0.3]], gravity: [0, -900, 0], colorGradient: [[0, '#ffffff', 1], [0.3, hex, 1], [1, hex, 0]] });
                if (spray) w.emitters.push({ h: spray, kind: 'spray' });
            }
            if (tier >= 3) {
                for (const a of [0, Math.PI]) {
                    const fire = app.fx.create({ texture: 'assets/fx/flame.webp', rate: 0, capacity: 80, life: [0.18, 0.35], size: [18, 34], speed: [5, 30],
                        follow: rimPt(a), colorGradient: [[0, '#fff6c0', 1], [0.35, hex, 0.95], [1, hex, 0]], sizeGradient: [[0, 1], [1, 0.2]] });
                    if (fire) w.emitters.push({ h: fire, kind: 'fire' });
                }
            }
        }
    },

    _updateWheelFx(dt, riding) {
        const w = this._wfx;
        if (!w) return;
        w.t += dt;
        const B = Bike, sp = Math.min(1.6, Math.abs(B.vf) / 1300);
        const on = riding && this.visible;
        for (const h of w.halos) {
            h.material.alpha = (0.3 + 0.25 * Math.sin(w.t * (3 + w.tier))) * (0.55 + 0.45 * sp) * [0, 0.55, 0.8, 1][w.tier];
            const k = 1 + 0.06 * Math.sin(w.t * 7);
            h.scaling.set(k, k, k);
        }
        for (const e of w.emitters) {
            let rate = 0;
            if (e.kind === 'spark') rate = on ? 6 + 26 * sp : (this.state === 'menu' ? 4 : 0);
            else if (e.kind === 'spray') rate = on && B.grounded && sp > 0.35 ? 30 + 50 * sp : 0;
            else if (e.kind === 'fire') rate = on ? 18 + 40 * sp : (this.state === 'menu' ? 8 : 0);
            e.h.setRate(rate);
        }
    },

    async _setWheels(id) {
        this._detachWheels();
        this.cur.wheels = id;
        const it = this.item(id);
        const b = this.bike;
        if (!b) return;
        b.setPartVisible('WheelF', true); b.setPartVisible('WheelR', true);
        if (!it || !it.model) return;
        try {
            const model = await Model3D.load(it.model);
            if (this.cur.wheels !== id || this.bike !== b) return;
            for (const node of ['WheelF', 'WheelR']) {
                const mesh = Model3D.build(model, this.view.scene, { name: 'wheel' });
                const c = it.color != null ? BABYLON.Color3.FromHexString('#' + Number(it.color).toString(16).padStart(6, '0')) : null;
                if (c) for (const m of mesh.getChildMeshes(false)) this._tintMesh(m, c, !!it.glow);
                World3D.addObject(this.view, mesh, 'actor');
                b.attach(node, mesh, {});
                this.wheels.push(mesh);
            }
            b.setPartVisible('WheelF', false); b.setPartVisible('WheelR', false);
            this._wheelFx(it);
        } catch (e) { console.warn('Look: колёса', it.model, e && e.message); }
    },

    _setTrail(id) {
        if (this.trail) { this.trail.stop(); this.trail = null; }
        this.cur.trail = id;
        const it = this.item(id);
        const app = this.app;
        if (!it || !it.trail || !app || !app.fx) return;
        const T = LOOK_TRAILS[it.trail] || LOOK_TRAILS.sparkle;
        const hex = (h) => '#' + Number(h).toString(16).padStart(6, '0');
        const c1 = T.white ? '#ffffff' : hex(it.color != null ? it.color : 0xffffff), c2 = T.white ? '#ffffff' : hex(it.color2 != null ? it.color2 : it.color || 0xffffff);
        /** @type {any} */
        const opts = {
            texture: T.texture, rate: 0, capacity: 260, life: T.life, size: T.size, speed: [10, 40], blend: T.blend || 'additive',
            follow: () => this.trailPoint(), box: [[-14, 0, -14], [14, 10, 14]], direction: [[-0.3, 0.6, -0.3], [0.3, 1, 0.3]],
            gravity: [0, T.up || 40, 0], alpha: T.alpha || 1, spin: T.spin || [0, 0],
            colorGradient: T.rainbow
                ? [[0, '#ff4d5e', 1], [0.25, '#ffd23f', 1], [0.5, '#56c93a', 0.9], [0.75, '#3ec5ff', 0.7], [1, '#7b4dff', 0]]
                : [[0, c1, T.alpha || 1], [0.6, c2, (T.alpha || 1) * 0.8], [1, c2, 0]],
            sizeGradient: [[0, 0.6], [0.3, 1], [1, 0.4]],
        };
        this.trail = app.fx.create(opts);
        this.trailKind = it.trail;
    },

    /** Точка следа — у заднего колеса у земли. */
    trailPoint() {
        const b = Bike, f = Math.cos(b.yaw), s = Math.sin(b.yaw);
        return new BABYLON.Vector3(b.p[0] - f * 70, b.p[1] + 14, b.p[2] - s * 70);
    },

    // -----------------------------------------------------------------------------------------
    // Кадр
    // -----------------------------------------------------------------------------------------

    /** Поставить корень по физике велосипеда (и сразу, без сглаживания). */
    place() {
        const b = this.bike;
        if (!b) return;
        const B = Bike;
        b.root.position.set(B.p[0], B.p[1] - (B.visLift || 0), B.p[2]);
        const qy = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -B.yaw);
        const qp = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, B.pitch);
        const ql = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, B.lean);
        b.root.rotationQuaternion = qy.multiply(qp).multiply(ql);
    },

    update(dt, state) {
        const b = this.bike, r = this.rider;
        if (!b) return;
        const B = Bike;
        this.place();
        // амортизатор: сжатие поднимает колесо к раме (колесо стоит на полу, а не тонет в нём)
        const sag = (w) => (w.contact ? Math.max(0, Math.min(30, w.comp)) : 0);
        b.offset('WheelR', 0, 0, -B.wheelAngle, 0, sag(B.wheels[0]), 0);
        b.offset('WheelF', 0, 0, -B.wheelAngle, 0, sag(B.wheels[1]), 0);
        b.offset('Fork', 0, -B.steer, 0);
        // шатуны: крутятся от педалей; накатом мягко встают горизонтально (поза coast)
        const pedaling = B.crankRate > 0.5;
        if (pedaling) this.crankVis = B.crank;
        else {
            const tgt = Math.round(this.crankVis / (Math.PI * 2)) * Math.PI * 2;
            this.crankVis += (tgt - this.crankVis) * Math.min(1, 6 * dt);
        }
        b.offset('Crank', 0, 0, -this.crankVis);
        if (b instanceof LookBlockRig) b.update();
        this.state = state;
        if (r && !this.flying) {
            // клипы — только тело целиком (финиш, покачивание); руки и ноги ведёт IK (Look.ik)
            const clip = state === 'cheer' ? 'cheer' : 'idle';
            if (clip !== this.clip && r.has(clip)) { r.play(clip, { fade: 0.2 }); this.clip = clip; }
            r.speed = 1;
            // поза корпуса: наклон вперёд на скорости, привстать в прыжке и в полёте, качание в такт педалям
            const sp = Math.min(1, Math.abs(B.vf) / 1300);
            const air = !B.grounded && B.airTime > 0.08;
            const stand = air || B.jumpBuf > 0;
            this.rise += ((stand ? 14 : 0) - this.rise) * Math.min(1, 10 * dt);
            const lean = -(0.06 + 0.16 * sp + (stand ? 0.12 : 0));
            this.bodyLean += (lean - this.bodyLean) * Math.min(1, 6 * dt);
            const sway = pedaling ? Math.sin(this.crankVis) * 0.05 : 0;
            r.offset('Hips', 0, 0, 0, 0, this.rise, 0);
            r.offset('Torso', sway, B.steer * 0.25, this.bodyLean);
            if (r.nodes.has('Head')) r.offset('Head', 0, -B.steer * 0.6, -this.bodyLean * 0.5);
        }
        if (r instanceof LookBlockRig) r.update();
        // вылет райдера при падении: летит по инерции и кувыркается
        const fl = this.flying;
        if (fl && r) {
            fl.v[1] -= 3200 * dt;
            fl.p[0] += fl.v[0] * dt; fl.p[1] += fl.v[1] * dt; fl.p[2] += fl.v[2] * dt;
            fl.spin += dt * 7;
            r.root.position.set(fl.p[0], fl.p[1], fl.p[2]);
            r.root.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(-fl.yaw, fl.spin * 0.6, fl.spin);
        }
        this._updateWheelFx(dt, state === 'ride');
        if (this.trail) {
            const sp = Math.abs(B.vf);
            const on = state === 'ride' && this.visible && sp > 120 && (B.grounded || B.airTime < 0.6);
            this.trail.setRate(on ? Math.min(90, 12 + sp * 0.05) : 0);
        }
    },

    // -----------------------------------------------------------------------------------------
    // IK: ступни на педалях, ладони на грипсах (после Rig.updateAll — поверх клипов)
    // -----------------------------------------------------------------------------------------

    // Точки контакта велосипеда в пространстве своих костей (в покое): педали — на кости Crank, грипсы — на Fork.
    _bindIK() { this._ikb = this.ikBinding(this.bike); },

    /** Точки педалей и грипсов в пространстве костей велосипеда (для IK любого райдера на нём). */
    ikBinding(b) {
        if (!b) return null;
        const G = this.geom;
        const crank = b.nodes.get('Crank'), fork = b.nodes.get('Fork');
        if (!crank || !fork) return null;
        const root = b.root;
        const saveQ = root.rotationQuaternion ? root.rotationQuaternion.clone() : null, saveP = root.position.clone();
        root.position.set(0, 0, 0);
        if (root.rotationQuaternion) root.rotationQuaternion.set(0, 0, 0, 1);
        const cw = (n) => { if (n.parent) cw(n.parent); n.computeWorldMatrix(true); };
        cw(crank); cw(fork);
        const invC = crank.getWorldMatrix().clone().invert(), invF = fork.getWorldMatrix().clone().invert();
        const V = BABYLON.Vector3;
        const local = (pt, inv) => V.TransformCoordinates(new V(pt[0], pt[1], pt[2]), inv);
        const ikb = {
            pedalR: local([G.crank[0] + G.crankR, G.crank[1], G.pedalZ], invC),
            pedalL: local([G.crank[0] - G.crankR, G.crank[1], -G.pedalZ], invC),
            gripR: local([G.grip[0], G.grip[1], G.grip[2]], invF),
            gripL: local([G.grip[0], G.grip[1], -G.grip[2]], invF),
            crank, fork,
        };
        root.position.copyFrom(saveP);
        if (saveQ) root.rotationQuaternion = saveQ;
        cw(crank); cw(fork);
        return ikb;
    },

    // Стандартная геометрия велосипеда (px движка: x вперёд, y вверх, z вправо); geometry.json уточняет.
    geom: { crank: [-5, 40, 0], crankR: 17, pedalZ: 15.5, grip: [34, 116, 30] },

    async loadGeometry() {
        try {
            const res = await fetch('assets/models/bikes/geometry.json');
            if (!res.ok) return;
            const j = await res.json();
            const v = (a) => (Array.isArray(a) && a.length >= 3 ? [a[0] * 100, a[2] * 100, -a[1] * 100] : null);   // Blender, м -> px движка
            const crank = v(j.bottomBracket || j.crank);
            if (crank) this.geom.crank = crank;
            const cr = Number(j.crankLength);
            if (cr > 0) this.geom.crankR = cr * 100;
            const pz = Number(j.pedalAbsY || j.pedalY);
            if (pz > 0) this.geom.pedalZ = Math.abs(pz) * 100;
            const grip = v(j.grips && j.grips.R);
            if (grip) this.geom.grip = [grip[0], grip[1], Math.abs(grip[2])];
            this._bindIK();
        } catch (e) { /* стандартная геометрия */ }
    },

    ik() {
        if (this.flying || !this.bike) return;
        this.ikFor(this.rider, this._ikb, this.bike.root, this.state);
    },

    /** IK райдера r на велосипеде с привязкой B: ступни на педалях, ладони на грипсах. */
    ikFor(r, B, bikeRoot, state) {
        if (!r || !B || !bikeRoot) return;
        const V = BABYLON.Vector3, N = r.nodes;
        const cw = (n) => { if (n.parent) cw(n.parent); n.computeWorldMatrix(true); };
        cw(B.crank); cw(B.fork);
        const T = (pt, node) => V.TransformCoordinates(pt, node.getWorldMatrix());
        const bw = bikeRoot.getWorldMatrix();
        const fwd = V.TransformNormal(new V(1, 0, 0), bw).normalize(), up = V.TransformNormal(new V(0, 1, 0), bw).normalize(), right = V.TransformNormal(new V(0, 0, 1), bw).normalize();
        /** @type {Array<[string, any, number]>} */
        const legs = [['L', T(B.pedalL, B.crank), -1], ['R', T(B.pedalR, B.crank), 1]];
        for (const [s, target, side] of legs) {
            const pole = fwd.add(up.scale(0.15)).add(right.scale(0.1 * side));
            if (N.has('LowerLeg_' + s)) this._solve2(N.get('UpperLeg_' + s), N.get('LowerLeg_' + s), N.get('Foot_' + s), target, pole);
            else if (N.has('Leg_' + s)) this._aim1(N.get('Leg_' + s), target);
        }
        if (state === 'cheer' && r.has('cheer')) return;   // руки вверх — из клипа
        /** @type {Array<[string, any, number]>} */
        const arms = [['L', T(B.gripL, B.fork), -1], ['R', T(B.gripR, B.fork), 1]];
        for (const [s, target, side] of arms) {
            const pole = up.scale(-0.55).add(right.scale(1.0 * side)).add(fwd.scale(-0.2));
            if (N.has('LowerArm_' + s)) this._solve2(N.get('UpperArm_' + s), N.get('LowerArm_' + s), N.get('Hand_' + s), target, pole);
            else if (N.has('Arm_' + s)) this._aim1(N.get('Arm_' + s), target);
        }
    },

    _rest: new WeakMap(),

    // Повернуть кость так, чтобы направление на её ребёнка (в покое) смотрело в точку мира.
    _aim(node, childLocal, target) {
        const V = BABYLON.Vector3, Q = BABYLON.Quaternion;
        let rest = this._rest.get(node);
        if (!rest) { rest = node.rotationQuaternion ? node.rotationQuaternion.clone() : new Q(); this._rest.set(node, rest); }
        if (!node.rotationQuaternion) node.rotationQuaternion = new Q();
        node.rotationQuaternion.copyFrom(rest);
        const cw = (n) => { if (n.parent) cw(n.parent); n.computeWorldMatrix(true); };
        cw(node);
        const wm = node.getWorldMatrix();
        const origin = wm.getTranslation();
        const from = V.TransformNormal(childLocal, wm).normalize();
        const to = target.subtract(origin);
        if (to.lengthSquared() < 1e-6) return;
        to.normalize();
        const qw = new Q();
        Q.FromUnitVectorsToRef(from, to, qw);
        const pq = new Q();
        if (node.parent) node.parent.getWorldMatrix().decompose(undefined, pq);
        node.rotationQuaternion = Q.Inverse(pq).multiply(qw).multiply(pq).multiply(rest);
    },

    _aim1(node, target) {
        // R6: одна кость — к цели направлением «вниз» части
        this._aim(node, new BABYLON.Vector3(0, -60, 0), target);
    },

    // Двухзвенная IK: колено/локоть в плоскости цели и полюса.
    _solve2(upper, lower, end, target, pole) {
        if (!upper || !lower || !end) return;
        const V = BABYLON.Vector3;
        const a = lower.position.length(), b = end.position.length();
        const rq = this._rest.get(upper);
        if (rq && upper.rotationQuaternion) upper.rotationQuaternion.copyFrom(rq);
        const cw = (n) => { if (n.parent) cw(n.parent); n.computeWorldMatrix(true); };
        cw(upper);
        const H = upper.getWorldMatrix().getTranslation();
        let d = V.Distance(target, H);
        const dir = target.subtract(H).normalize();
        d = Math.max(Math.abs(a - b) + 0.5, Math.min(a + b - 0.3, d));
        let pl = pole.subtract(dir.scale(V.Dot(pole, dir)));
        if (pl.lengthSquared() < 1e-6) pl = new V(0, 1, 0);
        pl.normalize();
        const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
        const sinA = Math.sqrt(1 - cosA * cosA);
        const K = H.add(dir.scale(a * cosA)).add(pl.scale(a * sinA));
        this._aim(upper, lower.position, K);
        this._aim(lower, end.position, H.add(dir.scale(d)));
    },

    /** Райдер слетает с велосипеда (падение, лава, удар): вид, физика игры уже решила. */
    launchRider() {
        const r = this.rider;
        if (!r || this.flying) return;
        const wp = r.root.getAbsolutePosition().clone();
        r.root.parent = null;
        r.root.rotationQuaternion = r.root.rotationQuaternion || new BABYLON.Quaternion();
        const B = Bike;
        this.flying = { p: [wp.x, wp.y + 40, wp.z], v: [B.v[0] * 0.8, Math.max(600, B.v[1] + 700), B.v[2] * 0.8], spin: 0, yaw: B.yaw };
        r.play('crash', { fade: 0.1 });
        this.clip = 'crash';
    },

    /** Вернуть райдера на седло (респаун). */
    seatRider() {
        const r = this.rider;
        this.flying = null;
        if (!r || !this.bike) return;
        r.root.parent = this.bike.root;
        r.root.position.set(0, 0, 0);
        r.root.rotationQuaternion = new BABYLON.Quaternion();
        this.clip = '';
    },

    setVisible(on) {
        this.visible = !!on;
        if (this.bike) this.bike.root.setEnabled(!!on);
        if (this.rider) this.rider.root.setEnabled(!!on);
    },

    // -----------------------------------------------------------------------------------------
    // Превью предметов (карточки Гаража): своя маленькая сцена, рендер в картинку, кэш
    // -----------------------------------------------------------------------------------------

    /** @type {Record<string, Promise<string | null>>} */ _thumbs: {},
    /** @type {any} */ _ts: null,
    _thumbChain: Promise.resolve(),

    /** data URL превью предмета Гаража из игровой модели (null — не вышло). */
    thumb(id) {
        if (!(id in this._thumbs)) {
            this._thumbs[id] = new Promise((resolve) => {
                this._thumbChain = this._thumbChain.then(() => this._renderThumb(id)).then(resolve, (e) => { console.warn('Look.thumb', id, e && e.message); resolve(null); });
            });
        }
        return this._thumbs[id];
    },

    _thumbScene() {
        if (this._ts) return this._ts;
        const engine = World3D.engine;
        const scene = new BABYLON.Scene(engine);
        scene.useRightHandedSystem = true;
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        scene.autoClear = true;
        const hemi = new BABYLON.HemisphericLight('t-sky', new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.75; hemi.groundColor = new BABYLON.Color3(0.55, 0.5, 0.65);
        const sun = new BABYLON.DirectionalLight('t-sun', new BABYLON.Vector3(-0.4, -0.8, 0.5), scene);
        sun.intensity = 0.65;
        const cam = new BABYLON.TargetCamera('t-cam', new BABYLON.Vector3(0, 0, 0), scene);
        cam.fov = 0.5; cam.minZ = 1; cam.maxZ = 5000;
        this._ts = { scene, cam };
        return this._ts;
    },

    async _renderThumb(id) {
        const it = this.item(id);
        if (!it) return null;
        const { scene, cam } = this._thumbScene();
        /** @type {any[]} */
        const roots = [];
        const mats = [];
        const tint = (root, prefix, color, emissive) => {
            if (color == null) return;
            const c = BABYLON.Color3.FromHexString('#' + Number(color).toString(16).padStart(6, '0'));
            for (const m of root.getChildMeshes(false)) {
                const part = m.metadata && m.metadata.part ? String(m.metadata.part) : '';
                if (!part.startsWith(prefix) || !m.material) continue;
                const one = (x) => { const k = x.clone(x.name + '+t'); k.diffuseColor = c.clone(); if (emissive) k.emissiveColor = c.scale(0.5); mats.push(k); return k; };
                if (m.material.subMaterials) { const mm = new BABYLON.MultiMaterial('t', scene); mm.subMaterials = m.material.subMaterials.map(one); m.material = mm; mats.push(mm); }
                else m.material = one(m.material);
            }
        };
        const show = (root, prefix, on) => { for (const m of root.getChildMeshes(false)) { const part = m.metadata && m.metadata.part ? String(m.metadata.part) : ''; if (part.startsWith(prefix)) m.setEnabled(on); } };
        let view = 'side';
        const slot = it.slot || it.tab;
        if (slot === 'bike' || slot === 'skin') {
            const bikeItem = slot === 'bike' ? it : this.item(this.cur.bike);
            const bm = await Model3D.load((bikeItem && bikeItem.model) || LOOK_DEFAULT_BIKE);
            const bike = Model3D.build(bm, scene, { name: 't-bike' });
            roots.push(bike);
            tint(bike, 'Frame', bikeItem && bikeItem.color != null ? bikeItem.color : 0x2f7fe0);
            tint(bike, 'Fork', bikeItem && bikeItem.color != null ? bikeItem.color : 0x2f7fe0);
            if (slot === 'skin') {
                const rm = await Model3D.load(LOOK_RIDER);
                const rider = Model3D.build(rm, scene, { name: 't-rider' });
                roots.push(rider);
                const L = it.look || {};
                tint(rider, 'Head', L.skin); tint(rider, 'Torso', L.shirt); tint(rider, 'Hand_', L.skin);
                for (const pre of ['Arm_', 'UpperArm_', 'LowerArm_']) tint(rider, pre, L.arms != null ? L.arms : L.shirt);
                for (const pre of ['Leg_', 'UpperLeg_', 'LowerLeg_']) tint(rider, pre, L.pants);
                show(rider, 'Hair_', false); if (L.hair) { show(rider, 'Hair_' + L.hair, true); tint(rider, 'Hair_' + L.hair, L.hairColor); }
                show(rider, 'Face_', false); show(rider, 'Face_' + (L.face || 'smile'), true);
                show(rider, 'Acc_', false); for (const a of L.acc || []) show(rider, 'Acc_' + a, true);
                view = 'rider';
            }
        } else if (slot === 'hat' || slot === 'wheels') {
            if (!it.model) return null;
            const m = await Model3D.load(it.model);
            const root = Model3D.build(m, scene, { name: 't-item' });
            roots.push(root);
            if (slot === 'wheels') { tint(root, '', it.color, !!it.glow); view = 'wheel'; } else view = 'hat';
        } else return null;
        // кадр по габариту
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity), max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        for (const root of roots) for (const m of root.getChildMeshes(false)) {
            if (!m.isEnabled() || !m.getTotalVertices()) continue;
            m.computeWorldMatrix(true);
            const bb = m.getBoundingInfo().boundingBox;
            min = BABYLON.Vector3.Minimize(min, bb.minimumWorld); max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
        }
        if (!Number.isFinite(min.x)) { for (const r of roots) r.dispose(false, false); return null; }
        const center = min.add(max).scale(0.5);
        const radius = Math.max(1, max.subtract(min).length() / 2);
        const dist = radius / Math.sin(cam.fov / 2) * (view === 'rider' ? 0.92 : 1.0);
        const dir = view === 'wheel' ? new BABYLON.Vector3(0.25, 0.2, 1) : view === 'hat' ? new BABYLON.Vector3(0.9, 0.55, 0.75) : new BABYLON.Vector3(0.35, 0.28, 1);
        dir.normalize();
        cam.position = center.add(dir.scale(dist));
        cam.setTarget(center);
        await scene.whenReadyAsync();
        const url = await BABYLON.Tools.CreateScreenshotUsingRenderTargetAsync(World3D.engine, cam, { width: 192, height: 192 }, 'image/png', 1, true);
        for (const r of roots) r.dispose(false, false);
        for (const m of mats) m.dispose();
        return url || null;
    },
};
const GameLook = Look;
