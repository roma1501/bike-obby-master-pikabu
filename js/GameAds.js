// GameAds.js — rewarded-реклама игры с паузой между просмотрами (AD_COOLDOWN_SEC, ~18 с).
// Все награды за рекламу (Гараж, подарок x2, колесо, ракета, пропуск этапа) идут через Ads.rewarded:
// награда — только по true от Platform.rewarded; после успешного просмотра следующий доступен через
// паузу. Кнопки показывают «Через N с» по Ads.cooldownLeft(); подписка Ads.on(fn) — раз в секунду,
// пока идёт пауза, и при смене состояния.
//
// Interstitial по кнопкам. Playables (просьба модерации): реклама на КАЖДОЙ кнопке перехода — «Заново»,
// «В меню», «Дальше», «Играть», окна меню (Гараж, Подарок, Колесо, Рекорды, Настройки) и «Нет, спасибо»
// в предложении после падения. Ads.button(go) — реклама, затем go; Ads.transition(go) — то же, а на других
// площадках правило двух раундов (Platform.ads.next). Пауза между ними — AD_INTER_GAP_SEC (0 — без паузы).
// ?eachads — включить на вебе для проверки (вместе с ?mockads).

/** @satisfies {Record<string, any>} */
const Ads = {
    _until: 0,
    _busy: false,
    /** @type {Array<() => void>} */
    _subs: [],
    _timer: 0,
    _interBusy: false,
    _interAt: 0,

    /** Площадка умеет rewarded (нет — кнопки «за рекламу» прячутся). */
    supported() {
        try { return typeof Platform === 'undefined' || typeof Platform.rewardedSupported !== 'function' || Platform.rewardedSupported() !== false; }
        catch (e) { return true; }
    },
    /** Реклама на каждой кнопке перехода (Playables; ?eachads — проверка на вебе). */
    eachButton() {
        return String(GAME_PLATFORM) === 'playables' || (typeof location !== 'undefined' && /[?&]eachads\b/.test(location.search));
    },

    /** Кнопка: на Playables — сначала interstitial, затем go(); на других площадках — сразу go(). */
    async button(go) {
        if (this._interBusy) return;
        if (this.eachButton()) await this._inter();
        if (go) await go();
    },

    /** Переход между раундами: Playables — interstitial на каждом; другие площадки — правило двух раундов. */
    transition(go) { return this.eachButton() ? this.button(go) : Platform.ads.next(go); },

    async _inter() {
        const gap = (typeof AD_INTER_GAP_SEC !== 'undefined' ? AD_INTER_GAP_SEC : 0) * 1000;
        if (gap > 0 && Date.now() - this._interAt < gap) return;
        try { if (!Platform.interstitialSupported()) return; } catch (e) { return; }
        this._interBusy = true;
        try { await Platform.interstitial(); this._interAt = Date.now(); } catch (e) { /* реклама не пришла — дальше без неё */ }
        finally { this._interBusy = false; }
    },

    /** Секунд до следующего просмотра (0 — можно). */
    cooldownLeft() { return Math.max(0, Math.ceil((this._until - Date.now()) / 1000)); },
    busy() { return this._busy; },
    /** Можно ли прямо сейчас просить рекламу. */
    ready() { return this.supported() && !this._busy && this.cooldownLeft() === 0; },

    /** Просмотр за награду: true — засчитан (награду выдаёт вызывающий, один раз). */
    async rewarded(id) {
        if (!this.ready()) return false;
        this._busy = true;
        this._emit();
        let ok = false;
        try { ok = (await Platform.rewarded(id)) === true; } catch (e) { ok = false; }
        this._busy = false;
        if (ok) {
            const sec = typeof AD_COOLDOWN_SEC !== 'undefined' ? AD_COOLDOWN_SEC : 18;
            this._until = Date.now() + sec * 1000;
            this._tick();
        }
        this._emit();
        return ok;
    },

    /** @param {() => void} fn @returns {() => void} */
    on(fn) {
        this._subs.push(fn);
        return () => { const i = this._subs.indexOf(fn); if (i >= 0) this._subs.splice(i, 1); };
    },
    _emit() { for (const fn of this._subs.slice()) { try { fn(); } catch (e) { console.warn('Ads:', e); } } },
    _tick() {
        if (this._timer) return;
        this._timer = setInterval(() => {
            this._emit();
            if (!this.cooldownLeft()) { clearInterval(this._timer); this._timer = 0; this._emit(); }
        }, 1000);
    },
};
