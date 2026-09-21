/* ============================================================
 * چت‌بات مشاوره دوره و منتور — Vanilla JS (بدون وابستگی)
 *
 * فرانت‌اند کاملاً مستقل از جنگو (بدون Django Template):
 *   نصب در هر صفحه HTML:
 *       <script src="مسیر/js/chatbot.js"></script>
 *   (CSS و فونت به‌صورت خودکار تزریق می‌شوند)
 *
 * تنظیمات اختیاری — قبل از تگ اسکریپت:
 *   <script>
 *     window.CHATBOT_CONFIG = {
 *       apiBase: '/chatbot/api',   // آدرس API بک‌اند جنگو
 *       position: 'left',          // 'left' یا 'right'
 *       botName: 'دستیار آموزش',
 *       botStatus: 'آنلاین — آماده پاسخ‌گویی',
 *       cssUrl: '/مسیر/css/chatbot.css',  // فقط اگر مسیر خودکار درست نبود
 *       disableCss: false          // اگر CSS را خودتان لینک کرده‌اید true
 *     };
 *   </script>
 * ============================================================ */
(function () {
    'use strict';

    /* ---------------------------------------------------------
     * ۱) تنظیمات کلی (پیش‌فرض‌ها + بازنویسی با window.CHATBOT_CONFIG)
     * --------------------------------------------------------- */
    var DEFAULTS = {
        API_BASE: '/chatbot/api',   // اگر مسیر include در urls.py اصلی را عوض کردید، این را هم عوض کنید
        POSITION: 'left',           // 'left' یا 'right' — محل ویجت در صفحه
        BOT_NAME: 'دستیار آموزش',
        BOT_STATUS: 'آنلاین — آماده پاسخ‌گویی',
        WELCOME: 'سلام! 👋 من <b>دستیار آموزش</b> هستم.<br>بگو چه کمکی از من می‌خواهی:',
        FLOW_INTRO: 'عالیه! 🙂 چند سؤال کوتاه ازت می‌پرسم.',
        SUMMARY_INTRO: 'لطفاً اطلاعات زیر را بررسی کن:',
        THANKS: '✅ اطلاعات با موفقیت ثبت شد!<br>کارشناسان ما به‌زودی برای هماهنگی با تو تماس می‌گیرند.',
        STORAGE_KEY: 'cb_chat_state_v1',
        TYPING_DELAY: 650,          // تأخیر «در حال تایپ...» (میلی‌ثانیه)
        CSS_URL: '',                // خالی = خودکار از کنار همین فایل js تشخیص داده می‌شود
        DISABLE_CSS: false          // اگر استایل را خودتان لینک کرده‌اید true بگذارید
    };

    var CONFIG = (function () {
        var merged = {};
        Object.keys(DEFAULTS).forEach(function (k) { merged[k] = DEFAULTS[k]; });
        var user = window.CHATBOT_CONFIG || {};
        var keyMap = {
            apiBase: 'API_BASE',
            position: 'POSITION',
            botName: 'BOT_NAME',
            botStatus: 'BOT_STATUS',
            cssUrl: 'CSS_URL',
            disableCss: 'DISABLE_CSS'
        };
        Object.keys(keyMap).forEach(function (k) {
            if (user[k] !== undefined) { merged[keyMap[k]] = user[k]; }
        });
        return merged;
    })();

    /* ---------------------------------------------------------
     * بوت‌استرپ: تزریق خودکار CSS (مسیر از محل خود فایل js)
     * --------------------------------------------------------- */
    function getScriptBase() {
        var script = document.currentScript;
        if (!script) {
            var all = document.querySelectorAll('script[src]');
            var i;
            for (i = all.length - 1; i >= 0; i--) {
                if (all[i].src.indexOf('chatbot') !== -1) { script = all[i]; break; }
            }
        }
        if (!script || !script.src) { return ''; }
        return script.src.replace(/js\/chatbot(\.min)?\.js.*$/, '');
    }

    function injectCss() {
        if (CONFIG.DISABLE_CSS) { return; }
        var existing = document.querySelector('link[data-cb-style]') ||
                       document.querySelector('link[href*="chatbot.css"]');
        if (existing) { return; }
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CONFIG.CSS_URL || (getScriptBase() + 'css/chatbot.css');
        link.setAttribute('data-cb-style', '1');
        document.head.appendChild(link);
    }

    injectCss();

    /* برچسب فارسی فیلدها — برای نمایش خطاهای سرور به کاربر */
    var FIELD_LABELS = {
        age: 'سن',
        phone_number: 'شماره موبایل',
        interest_field: 'زمینه مورد علاقه',
        monthly_budget: 'هزینه ماهیانه',
        free_time: 'زمان آزاد هفتگی',
        courses: 'دوره‌ها'
    };

    /* ---------------------------------------------------------
     * ۲) سناریوی گفتگو (برای تغییر سوالات فقط همین‌جا را ویرایش کنید)
     * --------------------------------------------------------- */
    var INTEREST_OPTIONS = [
        'برنامه‌نویسی و آی‌تی',
        'دیجیتال مارکتینگ',
        'طراحی گرافیک و UI/UX',
        'زبان‌های خارجی',
        'کسب‌وکار و مدیریت',
        'سایر'
    ];

    var FLOWS = {
        consultation: {
            endpoint: '/consultation/',
            steps: [
                {
                    key: 'age', type: 'text', inputmode: 'numeric', maxlength: '3',
                    summaryLabel: 'سن',
                    question: 'چند سالت هست؟ 🙂',
                    placeholder: 'مثلاً: ۲۲',
                    validate: validateAge
                },
                {
                    key: 'phone_number', type: 'text', inputmode: 'tel', maxlength: '20',
                    summaryLabel: 'شماره موبایل',
                    question: 'شماره موبایلت را وارد کن 📱',
                    placeholder: 'مثلاً: 09123456789',
                    validate: validatePhone
                },
                {
                    key: 'interest_field', type: 'options',
                    summaryLabel: 'زمینه مورد علاقه',
                    question: 'به کدام زمینه بیشتر علاقه داری؟ 🎯',
                    options: INTEREST_OPTIONS
                },
                {
                    key: 'monthly_budget', type: 'options',
                    summaryLabel: 'هزینه ماهیانه',
                    question: 'حاضری ماهانه چقدر برای آموزش هزینه کنی؟ 💰',
                    options: [
                        'زیر ۵۰۰ هزار تومان',
                        '۵۰۰ هزار تا ۱ میلیون تومان',
                        '۱ تا ۲ میلیون تومان',
                        'بیش از ۲ میلیون تومان',
                        'هنوز مطمئن نیستم'
                    ]
                },
                {
                    key: 'free_time', type: 'options',
                    summaryLabel: 'زمان آزاد هفتگی',
                    question: 'میزان زمان آزادت در هفته چقدر است؟ ⏰',
                    options: [
                        'کمتر از ۵ ساعت در هفته',
                        '۵ تا ۱۰ ساعت در هفته',
                        '۱۰ تا ۲۰ ساعت در هفته',
                        'بیش از ۲۰ ساعت در هفته'
                    ]
                }
            ]
        },
        mentor: {
            endpoint: '/mentor/',
            steps: [
                {
                    key: 'phone_number', type: 'text', inputmode: 'tel', maxlength: '20',
                    summaryLabel: 'شماره تماس',
                    question: 'شماره تماست را وارد کن 📱',
                    placeholder: 'مثلاً: 09123456789',
                    validate: validatePhone
                },
                {
                    key: 'interest_field', type: 'options',
                    summaryLabel: 'زمینه مورد علاقه',
                    question: 'در چه زمینه‌ای به منتور نیاز داری؟ 🎯',
                    options: INTEREST_OPTIONS
                },
                {
                    key: 'courses', type: 'text', inputmode: 'text', maxlength: '2000',
                    summaryLabel: 'دوره‌های من',
                    question: 'چه دوره‌هایی را داشته‌ای یا در حال گذراندن هستی؟ 📚<br><small>نام دوره‌ها را جدا از هم بنویس</small>',
                    placeholder: 'مثلاً: پایتون مقدماتی، جاوااسکریپت، ...',
                    validate: validateCourses
                }
            ]
        }
    };

    /* ---------------------------------------------------------
     * ۳) ابزارهای اعتبارسنجی سمت کاربر
     * --------------------------------------------------------- */
    function toEnglishDigits(str) {
        return String(str)
            .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
            .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    }

    function validateAge(raw) {
        var value = toEnglishDigits(raw).trim();
        if (!value) return { error: 'لطفاً سنت را وارد کن.' };
        var age = Number(value);
        if (!Number.isInteger(age) || age < 10 || age > 90) {
            return { error: 'سن باید عددی بین ۱۰ تا ۹۰ باشد.' };
        }
        return { value: age };
    }

    function validatePhone(raw) {
        var value = toEnglishDigits(raw).replace(/[\s\-()]/g, '');
        if (/^\+98/.test(value)) value = '0' + value.slice(3);
        else if (/^0098/.test(value)) value = '0' + value.slice(4);
        else if (/^98\d{10}$/.test(value)) value = '0' + value.slice(2);
        else if (/^9\d{9}$/.test(value)) value = '0' + value;
        if (!/^09\d{9}$/.test(value)) {
            return { error: 'شماره موبایل معتبر نیست. نمونه صحیح: 09123456789' };
        }
        return { value: value };
    }

    function validateCourses(raw) {
        var value = String(raw).trim();
        if (value.length < 3) return { error: 'لطفاً حداقل نام یک دوره را بنویس.' };
        return { value: value };
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /* ---------------------------------------------------------
     * ۴) وضعیت چت
     * --------------------------------------------------------- */
    var state = {
        stage: 'start',     // start | flow | summary | done
        flowKey: null,      // consultation | mentor
        stepIndex: 0,
        answers: {},
        messages: []        // {sender, html, cls}
    };

    var els = {};
    var busy = false;       // جلوگیری از ارسال همزمان
    var seq = 0;            // با هر ریستارت افزایش می‌یابد تا پاسخ‌های قدیمی نادیده گرفته شوند

    /* ---------------------------------------------------------
     * ۵) ساخت DOM ویجت
     * --------------------------------------------------------- */
    function buildWidget() {
        var root = document.getElementById('cb-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'cb-root';
            document.body.appendChild(root);
        }
        root.className = 'cb-root cb-pos-' + (CONFIG.POSITION === 'right' ? 'right' : 'left');
        root.setAttribute('dir', 'rtl');
        root.innerHTML =
            '<button type="button" class="cb-launcher" aria-label="باز کردن چت‌بات">' +
                '<span class="cb-launcher-icon">💬</span>' +
                '<span class="cb-launcher-close">✕</span>' +
                '<span class="cb-badge">۱</span>' +
            '</button>' +
            '<section class="cb-panel" role="dialog" aria-label="چت‌بات مشاوره">' +
                '<header class="cb-header">' +
                    '<div class="cb-header-info">' +
                        '<div class="cb-avatar">🤖</div>' +
                        '<div class="cb-header-text">' +
                            '<div class="cb-title">' + CONFIG.BOT_NAME + '</div>' +
                            '<div class="cb-status"><span class="cb-dot"></span>' + CONFIG.BOT_STATUS + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cb-header-actions">' +
                        '<button type="button" class="cb-btn-restart" title="شروع دوباره گفتگو">↺</button>' +
                        '<button type="button" class="cb-btn-close" title="بستن">✕</button>' +
                    '</div>' +
                '</header>' +
                '<div class="cb-messages"></div>' +
                '<div class="cb-inputbar">' +
                    '<input type="text" class="cb-input" autocomplete="off">' +
                    '<button type="button" class="cb-send">ارسال</button>' +
                '</div>' +
            '</section>';

        els.root = root;
        els.launcher = root.querySelector('.cb-launcher');
        els.messages = root.querySelector('.cb-messages');
        els.inputbar = root.querySelector('.cb-inputbar');
        els.input = root.querySelector('.cb-input');
        els.send = root.querySelector('.cb-send');
        els.restartBtn = root.querySelector('.cb-btn-restart');
        els.closeBtn = root.querySelector('.cb-btn-close');
    }

    function bindEvents() {
        els.launcher.addEventListener('click', togglePanel);
        els.closeBtn.addEventListener('click', closePanel);
        els.restartBtn.addEventListener('click', restartChat);
        els.send.addEventListener('click', handleTextSubmit);
        els.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit(); }
        });
    }

    function openPanel() {
        els.root.classList.add('open');
    }

    function closePanel() {
        els.root.classList.remove('open');
    }

    function togglePanel() {
        if (els.root.classList.contains('open')) closePanel();
        else openPanel();
    }

    /* ---------------------------------------------------------
     * ۶) مدیریت پیام‌ها
     * --------------------------------------------------------- */
    function scrollBottom() {
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function makeBubble(sender, html, extraClass) {
        var div = document.createElement('div');
        div.className = 'cb-msg cb-msg-' + sender + (extraClass ? ' ' + extraClass : '');
        div.innerHTML = html;
        return div;
    }

    function pushMessage(sender, html, extraClass) {
        state.messages.push({ sender: sender, html: html, cls: extraClass || '' });
        els.messages.appendChild(makeBubble(sender, html, extraClass));
        scrollBottom();
        saveState();
    }

    function pushBot(html) {
        pushMessage('bot', html);
    }

    function pushUser(text) {
        pushMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
    }

    function pushTyping() {
        var typing = document.createElement('div');
        typing.className = 'cb-msg cb-msg-bot cb-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        els.messages.appendChild(typing);
        scrollBottom();
        return typing;
    }

    /* پیام ربات با تأخیر تایپ + اجرای کار بعد از آن */
    function botSay(html, done) {
        var mySeq = seq;
        var typing = pushTyping();
        setTimeout(function () {
            if (mySeq !== seq) return;   // وسط راه ریستارت شده
            typing.remove();
            pushBot(html);
            if (done) done();
        }, CONFIG.TYPING_DELAY);
    }

    /* ---------------------------------------------------------
     * ۷) کنترل‌های گفتگو (دکمه‌های گزینه / ورودی متنی)
     * --------------------------------------------------------- */
    function clearControls() {
        if (els.controls) { els.controls.remove(); els.controls = null; }
        hideInputbar();
    }

    function attachControls(wrap) {
        els.controls = wrap;
        els.messages.appendChild(wrap);
        scrollBottom();
    }

    function showOptions(options, onPick) {
        clearControls();
        var wrap = document.createElement('div');
        wrap.className = 'cb-options';
        options.forEach(function (opt) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'cb-chip';
            b.textContent = opt;
            b.addEventListener('click', function () {
                if (els.controls !== wrap) return;   // جلوگیری از دوبار کلیک
                els.controls = null;
                wrap.remove();
                onPick(opt);
            });
            wrap.appendChild(b);
        });
        attachControls(wrap);
    }

    function showInputbar(step) {
        clearControls();
        els.input.value = '';
        els.input.placeholder = step.placeholder || '';
        els.input.setAttribute('inputmode', step.inputmode || 'text');
        els.input.setAttribute('maxlength', step.maxlength || '200');
        els.inputbar.classList.add('visible');
        // فوکوس خودکار فقط در دسکتاپ (در موبایل کیبورد ناگهانی باز نشود)
        if (window.innerWidth > 480) els.input.focus();
    }

    function hideInputbar() {
        els.inputbar.classList.remove('visible');
    }

    /* ---------------------------------------------------------
     * ۸) جریان گفتگو
     * --------------------------------------------------------- */
    function startConversation() {
        state.stage = 'start';
        saveState();
        botSay(CONFIG.WELCOME, function () { showStartOptions(); });
    }

    function showStartOptions() {
        clearControls();
        var wrap = document.createElement('div');
        wrap.className = 'cb-options';
        addStartChip(wrap, '🎓 مشاوره دوره می‌خوام', 'consultation');
        addStartChip(wrap, '🧑‍🏫 برای دوره‌ام منتور می‌خوام', 'mentor');
        attachControls(wrap);
    }

    function addStartChip(wrap, label, flowKey) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cb-chip cb-chip-start';
        b.textContent = label;
        b.addEventListener('click', function () {
            if (els.controls !== wrap || busy) return;
            els.controls = null;
            wrap.remove();
            pushUser(label);
            state.flowKey = flowKey;
            botSay(CONFIG.FLOW_INTRO, function () {
                askStep(0);
            });
        });
        wrap.appendChild(b);
    }

    function askStep(index) {
        state.stage = 'flow';
        state.stepIndex = index;
        var step = FLOWS[state.flowKey].steps[index];
        botSay(step.question, function () {
            saveState();   // سوال در لاگ ثبت شد؛ بعد از رفرش هم ادامه پیدا می‌کند
            if (step.type === 'options') {
                showOptions(step.options, function (opt) { handleOptionPick(step, opt); });
            } else {
                showInputbar(step);
            }
        });
    }

    function handleOptionPick(step, option) {
        pushUser(option);
        state.answers[step.key] = option;
        goNextStep();
    }

    function handleTextSubmit() {
        if (state.stage !== 'flow' || busy) return;
        var flow = FLOWS[state.flowKey];
        if (!flow) return;
        var step = flow.steps[state.stepIndex];
        if (!step || step.type !== 'text') return;

        var result = step.validate(els.input.value);
        if (result.error) {
            pushMessage('bot', '⚠️ ' + result.error, 'cb-msg-error');
            return;
        }
        hideInputbar();
        pushUser(result.value);
        state.answers[step.key] = result.value;
        goNextStep();
    }

    function goNextStep() {
        var flow = FLOWS[state.flowKey];
        if (state.stepIndex + 1 < flow.steps.length) {
            askStep(state.stepIndex + 1);
        } else {
            showSummary();
        }
    }

    function showSummary() {
        botSay(CONFIG.SUMMARY_INTRO, function () {
            state.stage = 'summary';
            pushMessage('bot', buildSummaryHtml(), 'cb-msg-summary');
            showConfirmButtons();
        });
    }

    function buildSummaryHtml() {
        var flow = FLOWS[state.flowKey];
        var rows = '';
        flow.steps.forEach(function (step) {
            var answer = state.answers[step.key];
            rows +=
                '<div class="cb-summary-row">' +
                    '<span class="cb-summary-q">' + step.summaryLabel + ':</span>' +
                    '<span class="cb-summary-a">' + escapeHtml(String(answer)) + '</span>' +
                '</div>';
        });
        return '<div class="cb-summary">' + rows + '</div>';
    }

    function showConfirmButtons() {
        clearControls();
        var wrap = document.createElement('div');
        wrap.className = 'cb-options';

        var ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'cb-chip cb-chip-primary';
        ok.textContent = '✅ ثبت اطلاعات';
        ok.addEventListener('click', function () {
            if (els.controls !== wrap) return;
            els.controls = null;
            wrap.remove();
            submitAnswers();
        });

        var no = document.createElement('button');
        no.type = 'button';
        no.className = 'cb-chip';
        no.textContent = '↺ شروع دوباره';
        no.addEventListener('click', function () {
            if (els.controls !== wrap) return;
            els.controls = null;
            wrap.remove();
            restartChat();
        });

        wrap.appendChild(ok);
        wrap.appendChild(no);
        attachControls(wrap);
    }

    function showNewChatButton() {
        clearControls();
        var wrap = document.createElement('div');
        wrap.className = 'cb-options';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cb-chip';
        b.textContent = '💬 شروع گفتگوی جدید';
        b.addEventListener('click', function () {
            if (els.controls !== wrap) return;
            els.controls = null;
            wrap.remove();
            restartChat();
        });
        wrap.appendChild(b);
        attachControls(wrap);
    }

    /* ---------------------------------------------------------
     * ۹) ارسال به سرور
     * --------------------------------------------------------- */
    function submitAnswers() {
        busy = true;
        var mySeq = seq;
        var typing = pushTyping();

        requestSubmit().then(function (result) {
            typing.remove();
            if (mySeq !== seq) return;   // کاربر وسط ارسال ریستارت کرده
            busy = false;
            if (result.ok) {
                state.stage = 'done';
                botSay(CONFIG.THANKS, function () { showNewChatButton(); });
            } else {
                pushMessage('bot', '❌ ' + result.message, 'cb-msg-error');
                showConfirmButtons();
            }
        });
    }

    function requestSubmit() {
        var flow = FLOWS[state.flowKey];
        var payload = {};
        Object.keys(state.answers).forEach(function (k) {
            payload[k] = state.answers[k];
        });
        payload.source_page = window.location.pathname;

        return fetch(CONFIG.API_BASE + flow.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        }).then(function (response) {
            if (response.status === 201) return { ok: true };
            if (response.status === 400) {
                return response.json().catch(function () { return null; }).then(function (data) {
                    return { ok: false, message: buildErrorMessage(data) };
                });
            }
            if (response.status === 429) {
                return {
                    ok: false,
                    message: 'تعداد درخواست‌های شما بیش از حد مجاز است؛ لطفاً کمی بعد دوباره تلاش کن.'
                };
            }
            return { ok: false, message: 'خطایی در سرور رخ داد؛ لطفاً دوباره تلاش کن.' };
        }).catch(function () {
            return { ok: false, message: 'ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کن.' };
        });
    }

    function buildErrorMessage(data) {
        if (!data || typeof data !== 'object') return 'اطلاعات ارسالی معتبر نیست.';
        var parts = [];
        Object.keys(data).forEach(function (field) {
            var errors = data[field];
            var text = escapeHtml(Array.isArray(errors) ? errors.join(' ') : String(errors));
            if (field === 'detail' || field === 'source_page') {
                parts.push(text);
            } else {
                parts.push(escapeHtml(FIELD_LABELS[field] || field) + ': ' + text);
            }
        });
        return parts.length ? parts.join('<br>') : 'اطلاعات ارسالی معتبر نیست.';
    }

    /* ---------------------------------------------------------
     * ۱۰) ذخیره/بازیابی وضعیت در sessionStorage (مقاوم به رفرش)
     * --------------------------------------------------------- */
    function saveState() {
        try {
            sessionStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
                stage: state.stage,
                flowKey: state.flowKey,
                stepIndex: state.stepIndex,
                answers: state.answers,
                messages: state.messages
            }));
        } catch (e) { /* حافظه در دسترس نیست؛ بی‌خطر */ }
    }

    function loadSavedState() {
        try {
            var raw = sessionStorage.getItem(CONFIG.STORAGE_KEY);
            if (!raw) return false;
            var data = JSON.parse(raw);
            if (!data || !Array.isArray(data.messages)) return false;
            state.stage = data.stage || 'start';
            state.flowKey = data.flowKey || null;
            state.stepIndex = data.stepIndex || 0;
            state.answers = data.answers || {};
            state.messages = data.messages;
            state.messages.forEach(function (m) {
                els.messages.appendChild(makeBubble(m.sender, m.html, m.cls));
            });
            scrollBottom();
            return true;
        } catch (e) {
            return false;
        }
    }

    /* بعد از رفرش صفحه، کنترل مرحله فعلی دوباره ساخته می‌شود */
    function renderResume() {
        var flow = state.flowKey ? FLOWS[state.flowKey] : null;
        var step;
        switch (state.stage) {
            case 'flow':
                if (!flow) { showStartOptions(); break; }
                step = flow.steps[state.stepIndex];
                if (!step) { showSummary(); break; }
                if (step.type === 'options') {
                    showOptions(step.options, function (opt) { handleOptionPick(step, opt); });
                } else {
                    showInputbar(step);
                }
                break;
            case 'summary':
                showConfirmButtons();
                break;
            case 'done':
                showNewChatButton();
                break;
            default:
                showStartOptions();
        }
    }

    /* ---------------------------------------------------------
     * ۱۱) ریستارت و راه‌اندازی
     * --------------------------------------------------------- */
    function restartChat() {
        seq++;   // پاسخ‌های در راهِ سرور و پیام‌های در حال تایپ باطل شوند
        try { sessionStorage.removeItem(CONFIG.STORAGE_KEY); } catch (e) { /* بی‌خطر */ }
        clearControls();
        state.stage = 'start';
        state.flowKey = null;
        state.stepIndex = 0;
        state.answers = {};
        state.messages = [];
        els.messages.innerHTML = '';
        busy = false;
        startConversation();
    }

    function init() {
        buildWidget();
        bindEvents();
        if (!loadSavedState()) {
            startConversation();
        } else {
            renderResume();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* API عمومی برای استفاده در صفحات دیگر:
       ChatbotWidget.open() / ChatbotWidget.close() / ChatbotWidget.restart() */
    window.ChatbotWidget = {
        open: openPanel,
        close: closePanel,
        restart: restartChat
    };
})();
