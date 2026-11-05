// GameBike.js — физика велосипеда: «лучевой» велосипед на двух колёсах с амортизаторами.
// Каждое колесо ищет опору лучом вниз (Course.rayDown), пружина-демпфер давит вдоль нормали опоры:
// так велосипед сам наклоняется по рельефу, мягко садится после прыжка (с упором амортизатора),
// клюёт носом при торможении и задирает его при разгоне. Заднее колесо ведущее, переднее рулит
// (модель велосипеда: скорость рысканья = v · tan(руль) / база), боковое сцепление гасит занос (лёд —
// почти без сцепления). Корпус, колёса и голова — сферы против стен, столбов, молотов и балок.
// Состояние — в координатах Babylon (x, y вверх, z); числа — константы BIKE_* (Constants.js).

const BIKE_WHEEL_R = 42;        // px: радиус колеса (стандартная геометрия, DESIGN §6)
const BIKE_HALF_BASE = 58;      // px: от середины до оси колеса
const BIKE_COM_H = 50;          // px: плечо центра масс для клевка/подъёма носа
const BIKE_INERTIA = 3000;      // px²: момент инерции по тангажу (на единицу массы)
const BIKE_DROOP = 10;          // px: колесо ещё касается, если опора ниже покоя на столько
const BIKE_GEAR = 2.4;          // оборотов колеса на оборот шатунов

/** Новый велосипед со своим состоянием (игрок и боты едут на одной физике). */
function createBike() {
    return {
    p: [0, 0, 0], v: [0, 0, 0],
    yaw: 0, pitch: 0, pitchVel: 0, yawRate: 0, steer: 0, lean: 0,
    vf: 0,
    wheels: [
        { off: -BIKE_HALF_BASE, comp: 0, prevComp: 0, contact: false, gy: 0, n: [0, 1, 0], col: null, q: [0, 0, 0] },
        { off: BIKE_HALF_BASE, comp: 0, prevComp: 0, contact: false, gy: 0, n: [0, 1, 0], col: null, q: [0, 0, 0] },
    ],
    grounded: false, airTime: 0, groundTime: 0, coyote: 0, jumpBuf: 0, jumpLock: 0,
    lastGroundY: 0, landSpeed: 0,
    boost: 0, padBoost: 0, stun: 0, hitCool: 0, bonkCool: 0, climbCool: 0, climbT: 0, climbY: 0, visLift: 0, /** @type {any} */ climbCol: null,
    crank: 0, crankRate: 0, wheelAngle: 0, wheelRate: 0,
    ice: false, dead: false, frozen: false, isBot: false,
    /** @type {Record<string, (...a: any[]) => void>} */
    on: {},

    cfg() {
        const U = 'undefined';
        return {
            g: typeof BIKE_GRAVITY !== U ? BIKE_GRAVITY : 3200,
            vmax: typeof BIKE_MAX_SPEED !== U ? BIKE_MAX_SPEED : 1300,
            accel: typeof BIKE_ACCEL !== U ? BIKE_ACCEL : 1250,
            brake: typeof BIKE_BRAKE !== U ? BIKE_BRAKE : 2600,
            rev: typeof BIKE_REVERSE_SPEED !== U ? BIKE_REVERSE_SPEED : 350,
            roll: typeof BIKE_ROLL_DECEL !== U ? BIKE_ROLL_DECEL : 140,
            drag: typeof BIKE_AIR_DRAG !== U ? BIKE_AIR_DRAG : 0.12,
            jump: typeof BIKE_JUMP_SPEED !== U ? BIKE_JUMP_SPEED : 1300,
            steerLow: (typeof BIKE_STEER_LOW_DEG !== U ? BIKE_STEER_LOW_DEG : 32) * Math.PI / 180,
            steerHigh: (typeof BIKE_STEER_HIGH_DEG !== U ? BIKE_STEER_HIGH_DEG : 9) * Math.PI / 180,
            steerResp: typeof BIKE_STEER_RESPONSE !== U ? BIKE_STEER_RESPONSE : 7,
            grip: typeof BIKE_GRIP !== U ? BIKE_GRIP : 10,
            iceGrip: typeof BIKE_ICE_GRIP !== U ? BIKE_ICE_GRIP : 0.18,
            k: typeof BIKE_SUSP_STIFF !== U ? BIKE_SUSP_STIFF : 300,
            d: typeof BIKE_SUSP_DAMP !== U ? BIKE_SUSP_DAMP : 16,
            travel: typeof BIKE_SUSP_TRAVEL !== U ? BIKE_SUSP_TRAVEL : 18,
            step: typeof BIKE_STEP_UP !== U ? BIKE_STEP_UP : 24,
            airPitch: typeof BIKE_AIR_PITCH !== U ? BIKE_AIR_PITCH : 7,
            coyote: typeof BIKE_COYOTE_SEC !== U ? BIKE_COYOTE_SEC : 0.12,
            buffer: typeof BIKE_JUMP_BUFFER_SEC !== U ? BIKE_JUMP_BUFFER_SEC : 0.16,
            boostSpeed: typeof BIKE_BOOST_SPEED !== U ? BIKE_BOOST_SPEED : 2000,
            fallDepth: typeof BIKE_FALL_DEPTH !== U ? BIKE_FALL_DEPTH : 700,
            knock: typeof BIKE_KNOCKBACK !== U ? BIKE_KNOCKBACK : 1100,
        };
    },

    /** Поставить велосипед на точку (x, h, z) с курсом yaw (рад, курс карты) — старт и чекпоинт. */
    reset(x, h, z, yaw) {
        this.p = [x, h + 2, z];
        this.v = [0, 0, 0];
        this.yaw = yaw || 0; this.pitch = 0; this.pitchVel = 0; this.yawRate = 0; this.steer = 0; this.lean = 0; this.vf = 0;
        for (const w of this.wheels) { w.comp = w.prevComp = 0; w.contact = false; w.gy = h; w.col = null; }
        this.grounded = false; this.airTime = 0; this.groundTime = 0; this.coyote = 0; this.jumpBuf = 0; this.jumpLock = 0;
        this.lastGroundY = h; this.stun = 0; this.hitCool = 0; this.padBoost = 0; this.dead = false; this.ice = false;
        this.crankRate = 0; this.wheelRate = 0;
    },

    /** Напрямую из ввода: { throttle -1..1, steer -1..1, jump: нажат в этом кадре }. */
    /** hz — частота подшагов физики (боты вдали — реже). */
    step(dt, input, hz) {
        if (this.frozen || this.dead) return;
        const c = this.cfg();
        if (input.jump) this.jumpBuf = c.buffer;
        this.jumpBuf = Math.max(0, this.jumpBuf - dt);
        this.jumpLock = Math.max(0, this.jumpLock - dt);
        this.stun = Math.max(0, this.stun - dt);
        this.hitCool = Math.max(0, this.hitCool - dt);
        this.bonkCool = Math.max(0, this.bonkCool - dt);
        this.climbCool = Math.max(0, this.climbCool - dt);
        this.climbT = Math.max(0, this.climbT - dt);
        this.visLift *= Math.exp(-16 * dt);
        this.padBoost = Math.max(0, this.padBoost - dt);
        this.boost = Math.max(0, this.boost - dt);
        const ctl = this.stun > 0 ? 0.25 : 1;
        const thr = Math.max(-1, Math.min(1, input.throttle || 0)) * ctl;
        const str = Math.max(-1, Math.min(1, input.steer || 0)) * (this.stun > 0 ? 0.4 : 1);

        // Прыжок: с земли или сразу после края (коyote), нажатие чуть раньше — тоже.
        if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0) && this.jumpLock <= 0 && this.stun <= 0) {
            const vg = this._groundVel();
            this.v[1] = Math.max(this.v[1], vg[1]) + c.jump;
            this.pitchVel += 1.2;
            this.jumpBuf = 0; this.coyote = 0; this.jumpLock = 0.12;
            for (const w of this.wheels) w.contact = false;
            this.grounded = false;
            if (this.on.jump) this.on.jump();
        }

        const n = Math.min(8, Math.max(1, Math.ceil(dt * (hz || 240))));
        const h = dt / n;
        for (let i = 0; i < n; i++) { this._sub(h, c, thr, str); if (this.dead) return; }

        if (this.grounded) { this.coyote = c.coyote; this.airTime = 0; this.groundTime += dt; }
        else { this.coyote = Math.max(0, this.coyote - dt); this.airTime += dt; this.groundTime = 0; }

        // Падение с трассы: ниже последней опоры и под нами пусто.
        if (!this.grounded && this.v[1] < 0) {
            const below = this.p[1] < this.lastGroundY - c.fallDepth;
            if (below) {
                const hit = Course.rayDown(this.p[0], this.p[1], this.p[2], 1800, 0.3);
                if (!hit || this.p[1] < this.lastGroundY - 3200) this._die('fall');
            }
            if (this.p[1] < Course.minTop - 2200) this._die('fall');
        }
        if (Math.abs(this.pitch) > 1.75) this._die('crash');
    },

    _die(reason) {
        if (this.dead) return;
        this.dead = true;
        if (this.on.die) this.on.die(reason);
    },

    _groundVel() {
        let vx = 0, vy = 0, vz = 0, k = 0;
        for (const w of this.wheels) if (w.contact && w.col && w.col.dynamic) { const pv = Course.pointVel(w.col, w.q); vx += pv[0]; vy += pv[1]; vz += pv[2]; k++; }
        return k ? [vx / k, vy / k, vz / k] : [0, 0, 0];
    },

    _sub(h, c, thr, str) {
        const R = BIKE_WHEEL_R;
        const p = this.p, v = this.v;
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const f = [cy * cp, sp, sy * cp], u = [-cy * sp, cp, -sy * sp];

        // --- колёса: опора лучом вниз, пружина вдоль нормали ---
        let contacts = 0, nx = 0, ny = 0, nz = 0, ice = false, rear = false, front = false;
        let vgx = 0, vgy = 0, vgz = 0, vgk = 0, spin = 0;
        for (let i = 0; i < 2; i++) {
            const w = this.wheels[i];
            const ax = p[0] + f[0] * w.off + u[0] * R, ay = p[1] + f[1] * w.off + u[1] * R, az = p[2] + f[2] * w.off + u[2] * R;
            const bottom = ay - R;
            const top = w.contact ? Math.max(w.gy, bottom - c.travel * 2) + c.step : bottom + c.travel + c.step;
            w.prevComp = w.comp;
            let hit = null;
            if (this.jumpLock <= 0 || this.v[1] < 0) hit = Course.rayDown(ax, top, az, top - (bottom - BIKE_DROOP) + 2, 0.45);
            if (this.climbT > 0 && (!hit || hit.y < this.climbY - 2) && Math.abs(bottom - this.climbY) < 40) {
                hit = { y: this.climbY, n: [0, 1, 0], col: this.climbCol, t: 0 };
            }
            if (hit) {
                const comp = hit.y - bottom;
                if (comp > -BIKE_DROOP) {
                    w.contact = true; w.comp = comp; w.gy = hit.y; w.n = hit.n; w.col = hit.col;
                    w.q[0] = ax; w.q[1] = hit.y; w.q[2] = az;
                } else { w.contact = false; w.comp = 0; w.col = null; }
            } else { w.contact = false; w.comp = 0; w.col = null; }
            if (!w.contact) continue;
            contacts++;
            if (i === 0) rear = true; else front = true;
            const col = w.col;
            if (col.kill) { this._die('kill'); return; }
            if (col.ice) ice = true;
            if (col.piece && col.piece.prm.role === 'fall' && !this.isBot) Course.touch(col);   // плиты роняет только игрок
            if (col.dynamic) { const pv = Course.pointVel(col, w.q); vgx += pv[0]; vgy += pv[1]; vgz += pv[2]; vgk++; spin += Course.yawRate(col); }
            const cv = (w.comp - w.prevComp) / h;
            let F = c.k * Math.max(0, w.comp) + c.d * Math.max(-600, Math.min(600, cv));
            if (w.comp > c.travel) F += c.k * 8 * (w.comp - c.travel) + c.d * 4 * Math.max(0, Math.min(600, cv));
            F = Math.max(0, Math.min(F, c.g * 9));
            const nn = w.n;
            v[0] += nn[0] * F * h; v[1] += nn[1] * F * h; v[2] += nn[2] * F * h;
            this.pitchVel += F * (nn[0] * u[0] + nn[1] * u[1] + nn[2] * u[2]) * w.off / BIKE_INERTIA * h;
            if (w.comp > c.travel * 2.5) {   // жёсткий упор: не провалиться сквозь опору (по чуть-чуть, без выстрела)
                const over = Math.min(6, w.comp - c.travel * 2.5);
                p[1] += over;
                w.comp -= over;
                if (v[1] < 0) v[1] *= 0.3;
            }
            nx += nn[0]; ny += nn[1]; nz += nn[2];
            if (col.boost && thr >= -0.2) {
                const bx = col.ax[0], bz = col.ax[2], bl = Math.hypot(bx, bz) || 1;
                const along = v[0] * bx / bl + v[2] * bz / bl;
                if (along < col.boost) { v[0] += bx / bl * (col.boost - along); v[2] += bz / bl * (col.boost - along); }
                this.padBoost = 1.4;
                if (this.on.pad) this.on.pad('boost');
            }
            if (col.jump && this.jumpLock <= 0) {
                v[1] = Math.max(v[1], col.jump);
                this.jumpLock = 0.2; w.contact = false;
                if (this.on.pad) this.on.pad('jump');
            }
        }
        const wasGrounded = this.grounded;
        this.grounded = contacts > 0 && this.jumpLock <= 0;
        this.ice = ice;
        if (this.grounded && !wasGrounded) {
            this.landSpeed = -v[1];
            if (this.on.land) this.on.land(this.landSpeed);
        }

        const fh = [cy, 0, sy];
        const vmax = this.boost > 0 ? c.boostSpeed : c.vmax;
        if (this.grounded) {
            const nl = Math.hypot(nx, ny, nz) || 1;
            const N = [nx / nl, ny / nl, nz / nl];
            const vg = vgk ? [vgx / vgk, vgy / vgk, vgz / vgk] : [0, 0, 0];
            const fd = fh[0] * N[0] + fh[2] * N[2];
            let tf = [fh[0] - N[0] * fd, -N[1] * fd, fh[2] - N[2] * fd];
            const tl = Math.hypot(tf[0], tf[1], tf[2]) || 1;
            tf = [tf[0] / tl, tf[1] / tl, tf[2] / tl];
            const tr = [tf[1] * N[2] - tf[2] * N[1], tf[2] * N[0] - tf[0] * N[2], tf[0] * N[1] - tf[1] * N[0]];
            const rv = [v[0] - vg[0], v[1] - vg[1], v[2] - vg[2]];
            let vf = rv[0] * tf[0] + rv[1] * tf[1] + rv[2] * tf[2];
            let vl = rv[0] * tr[0] + rv[1] * tr[1] + rv[2] * tr[2];
            const vn = rv[0] * N[0] + rv[1] * N[1] + rv[2] * N[2];
            const grip = ice ? c.iceGrip : 1;
            const vf0 = vf;
            if (rear || front) {
                if (thr > 0.05 && rear) {
                    const target = vmax * thr;
                    if (vf < target) vf = Math.min(target, vf + c.accel * thr * grip * (1 - 0.45 * Math.max(0, vf) / vmax) * h);
                } else if (thr < -0.05) {
                    if (vf > 15) vf = Math.max(0, vf - c.brake * -thr * Math.max(0.35, grip) * h);
                    else if (rear) vf = Math.max(-c.rev * -thr, vf - c.accel * 0.6 * -thr * grip * h);
                } else {
                    const dec = c.roll * h * (ice ? 0.3 : 1);
                    vf = Math.abs(vf) <= dec ? 0 : vf - Math.sign(vf) * dec;
                }
                if (vf > vmax && this.padBoost <= 0) vf = Math.max(vmax, vf - 380 * h);
            }
            // боковое сцепление с пределом трения: на скорости и на льду велосипед может сносить
            const dl = vl * (1 - Math.exp(-c.grip * grip * h));
            const cap = (ice ? 900 : 6200) * h;
            vl -= Math.max(-cap, Math.min(cap, dl));
            v[0] = vg[0] + tf[0] * vf + tr[0] * vl + N[0] * vn;
            v[1] = vg[1] + tf[1] * vf + tr[1] * vl + N[1] * vn;
            v[2] = vg[2] + tf[2] * vf + tr[2] * vl + N[2] * vn;
            this.vf = vf;
            this.pitchVel += (vf - vf0) / h * BIKE_COM_H / BIKE_INERTIA * h * 0.6;
            // руль: угол по вводу, меньше на скорости; рысканье по модели велосипеда
            const sp01 = Math.min(1, Math.abs(vf) / c.vmax);
            const maxSteer = c.steerLow + (c.steerHigh - c.steerLow) * sp01;   // линейно: на малой скорости руль круче — тесные повороты проходимы
            this.steer += (str * maxSteer - this.steer) * Math.min(1, c.steerResp * h);
            const steerGrip = front ? 1 : 0.35;
            this.yawRate = vf * Math.tan(this.steer) / (BIKE_HALF_BASE * 2) * steerGrip * (ice ? 0.7 : 1) - spin;
            this.pitchVel *= Math.max(0, 1 - 2.5 * h);
            this.lastGroundY = Math.min(this.wheels[0].contact ? this.wheels[0].gy : Infinity, this.wheels[1].contact ? this.wheels[1].gy : Infinity);
        } else {
            // полёт: сопротивление воздуха, лёгкое управление рулём и наклоном (W/S)
            const k = Math.max(0, 1 - c.drag * h);
            v[0] *= k; v[2] *= k;
            this.vf = v[0] * fh[0] + v[2] * fh[2];
            this.steer += (str * c.steerLow * 0.5 - this.steer) * Math.min(1, c.steerResp * h);
            this.yawRate = str * 1.8;
            // выравнивание в полёте: нос плавно идёт по траектории (вверх на взлёте, чуть вниз к посадке)
            const flight = Math.atan2(v[1], Math.max(200, Math.hypot(v[0], v[2]))) * 0.35;
            const want = Math.max(-0.35, Math.min(0.35, flight));
            this.pitchVel += ((want - this.pitch) * c.airPitch * 2.2 - this.pitchVel * 3.2) * h;
        }

        v[1] -= c.g * h;
        p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h;
        this.pitch += this.pitchVel * h;
        if (this.pitch > 1.3 && this.grounded) { this.pitch = 1.3; this.pitchVel = Math.min(0, this.pitchVel); }
        if (this.pitch < -1.3 && this.grounded) { this.pitch = -1.3; this.pitchVel = Math.max(0, this.pitchVel); }
        this.yaw += this.yawRate * h;

        // крен в повороте (вид), шатуны и колёса
        const latAcc = this.vf * this.yawRate;
        const target = this.grounded ? Math.max(-0.55, Math.min(0.55, Math.atan2(latAcc, c.g))) : this.lean * 0.6;
        this.lean += (target - this.lean) * Math.min(1, 7 * h);
        if (this.grounded) this.wheelRate = this.vf / R;
        else this.wheelRate *= Math.max(0, 1 - 0.4 * h);
        this.wheelAngle = (this.wheelAngle + this.wheelRate * h) % (Math.PI * 200);
        const pedal = this.grounded && thr > 0.05 && this.vf > 10;
        const wantCrank = pedal ? Math.max(1.5, this.wheelRate / BIKE_GEAR) : (thr > 0.05 && !this.grounded ? 4 : 0);
        this.crankRate += (wantCrank - this.crankRate) * Math.min(1, 10 * h);
        this.crank = (this.crank + this.crankRate * h) % (Math.PI * 2);

        this._collide(c, f, u, thr);
    },

    // Сферы корпуса, колёс и головы против стен и препятствий.
    _collide(c, f, u, thr) {
        const p = this.p, v = this.v, R = BIKE_WHEEL_R;
        const spheres = [
            { o: [f[0] * -BIKE_HALF_BASE + u[0] * R, f[1] * -BIKE_HALF_BASE + u[1] * R, f[2] * -BIKE_HALF_BASE + u[2] * R], r: R - 4, wheel: true },
            { o: [f[0] * BIKE_HALF_BASE + u[0] * R, f[1] * BIKE_HALF_BASE + u[1] * R, f[2] * BIKE_HALF_BASE + u[2] * R], r: R - 4, wheel: true },
            { o: [u[0] * 100 - f[0] * 10, u[1] * 100 - f[1] * 10, u[2] * 100 - f[2] * 10], r: 40, wheel: false },
            { o: [u[0] * 182 + f[0] * 12, u[1] * 182 + f[1] * 12, u[2] * 182 + f[2] * 12], r: 30, wheel: false, head: true },
        ];
        for (const s of spheres) {
            const sx = p[0] + s.o[0], sy = p[1] + s.o[1], sz = p[2] + s.o[2];
            Course.sphere(sx, sy, sz, s.r, (hit) => {
                const col = hit.col, n = hit.n;
                if (col.kill) { this._die('kill'); return; }
                if (this.climbT > 0 && (col === this.climbCol || (this.climbCol && col.piece === this.climbCol.piece))) return;   // заезжаем на эту ступень
                if (s.wheel && !col.hazard && n[1] > 0.3 && hit.q[1] < sy - R + c.step + 6) return;   // опора — дело лучей
                if (!s.wheel && !col.hazard && n[1] > 0.7) {
                    // корпус лёг на опору: велосипед перевернулся
                    if (Math.abs(this.pitch) > 0.9 || s.head) { this._die('crash'); return; }
                }
                if (col.hazard) { this._hit(hit, c); return; }
                // аркадный автоподъём: колесо упёрлось в ступень плиты, игрок жмёт вперёд — велосипед сам подскакивает на неё
                if (s.wheel && !col.wall && (thr > 0.05 || this.vf > 150) && Math.abs(n[1]) < 0.6 && this.climbCool <= 0 && this._climb(sx, sy - R, sz, c, col)) return;
                if (this.dead) return;
                p[0] += n[0] * hit.depth; p[1] += n[1] * hit.depth; p[2] += n[2] * hit.depth;
                const cv = col.dynamic ? Course.pointVel(col, hit.q) : [0, 0, 0];
                const rel = (v[0] - cv[0]) * n[0] + (v[1] - cv[1]) * n[1] + (v[2] - cv[2]) * n[2];
                if (rel < 0) {
                    const e = 0.12;
                    v[0] -= n[0] * rel * (1 + e); v[1] -= n[1] * rel * (1 + e); v[2] -= n[2] * rel * (1 + e);
                    if (-rel > 620 && Math.abs(n[1]) < 0.6 && this.bonkCool <= 0) {
                        this.bonkCool = 0.4;
                        this.pitchVel += 1.5;
                        if (this.on.bonk) this.on.bonk(-rel);
                    }
                }
            });
            if (this.dead) return;
        }
    },

    // Ступень впереди колеса: верх опоры не выше BIKE_CLIMB_MAX над низом колеса — подскок ровно на неё.
    _climb(x, bottom, z, c, col) {
        const maxH = typeof BIKE_CLIMB_MAX !== 'undefined' ? BIKE_CLIMB_MAX : 130;
        const fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
        const hit = Course.rayDown(x + fx * 50, bottom + maxH + 20, z + fz * 50, maxH + 20, 0.7);
        if (!hit || hit.col.wall || hit.col.kill) return false;
        const rise = hit.y - bottom;
        if (rise < c.step * 0.5 || rise > maxH) return false;
        this.p[1] += rise + 1;               // физика — сразу на ступени
        this.visLift += rise + 1;            // вид — плавно (GameLook вычитает и гасит)
        if (this.v[1] < 0) this.v[1] = 0;
        const along = this.v[0] * fx + this.v[2] * fz;
        const need = Math.max(360, Math.min(700, along));
        if (along < need) { this.v[0] += fx * (need - along); this.v[2] += fz * (need - along); }
        this.climbY = hit.y;
        this.climbT = Math.min(0.6, (BIKE_HALF_BASE * 2 + 60) / need);
        this.climbCol = col;
        this.climbCool = 0.12;
        for (const w of this.wheels) { w.gy = hit.y; w.comp = 0; w.prevComp = 0; }
        if (this.on.climb) this.on.climb(rise);
        return true;
    },

    // Удар молотом или балкой: отброс по нормали удара + скорость препятствия, короткое оглушение.
    _hit(hit, c) {
        if (this.hitCool > 0) return;
        this.hitCool = 0.45;
        const vh = Course.pointVel(hit.col, hit.q);
        let hx = hit.n[0], hz = hit.n[2];
        let l = Math.hypot(hx, hz);
        if (l < 0.2) { hx = vh[0]; hz = vh[2]; l = Math.hypot(hx, hz); }
        if (l < 1e-3) { hx = -Math.cos(this.yaw); hz = -Math.sin(this.yaw); l = 1; }
        hx /= l; hz /= l;
        const sp = Math.hypot(vh[0], vh[2]);
        const k = c.knock + Math.min(900, sp * 0.5);
        this.v[0] = this.v[0] * 0.3 + hx * k + vh[0] * 0.25;
        this.v[2] = this.v[2] * 0.3 + hz * k + vh[2] * 0.25;
        this.v[1] = Math.max(this.v[1], 0) + 620;
        this.p[0] += hit.n[0] * hit.depth; this.p[1] += Math.max(0, hit.n[1]) * hit.depth; this.p[2] += hit.n[2] * hit.depth;
        this.stun = 0.6;
        this.jumpLock = 0.15;
        for (const w of this.wheels) w.contact = false;
        this.grounded = false;
        this.pitchVel += (Math.random() - 0.5) * 4;
        if (this.on.hit) this.on.hit(k);
    },

    /** Скорость по ходу, px/с. */
    speed() { return Math.hypot(this.v[0], this.v[2]); },
    };
}

/** Велосипед игрока. */
const Bike = createBike();
