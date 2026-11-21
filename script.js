// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initDownloadCounters();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            initDownloadCounters();
        }
    });
    initDownloadTracking();
    initHenaArchitecture();
    applyHenaArchitectureToLinks();
    initImageLoading();
    initScrollAnimations();
    initMobileMenu();
});

// Navbar functionality
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    const window_height = window.innerHeight;

    window.addEventListener('scroll', () => {
        if (window.scrollY > window_height * 0.3) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Download button click handlers (architecture aware)
    const downloadButtons = document.querySelectorAll('.btn-download');
    downloadButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            startHenaDownload(btn);
        });
    });
}

// Mobile menu toggle
function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navbarMenu = document.getElementById('navbarMenu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navbarMenu.classList.toggle('active');
        });

        // Close menu when link is clicked
        navbarMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navbarMenu.classList.remove('active');
            });
        });
    }
}

// Download counter initialization
let henaCounterFetchInFlight = false;
let henaCounterLastFetchAt = 0;

// The count is the sum of the real download counts of the three Hena APK architectures
// release asset on GitHub. The API is public, so no token is needed.
const HENA_RELEASES_API =
    'https://api.github.com/repos/ananbusiness88-hue/Hena-Downloads/releases';

async function initDownloadCounters() {
    const counterElement = document.getElementById('download-count');
    if (!counterElement) return;

    const now = Date.now();
    if (henaCounterFetchInFlight || now - henaCounterLastFetchAt < 5000) return;

    henaCounterFetchInFlight = true;
    henaCounterLastFetchAt = now;

    counterElement.title = 'جارٍ تحديث عدد التنزيلات الفعلي';

    try {
        let totalDownloads = 0;
        let page = 1;

        while (true) {
            const response = await fetch(
                `${HENA_RELEASES_API}?per_page=100&page=${page}`,
                { cache: 'no-store' }
            );

            if (response.status === 403 || response.status === 429) {
                // GitHub rate limit for anonymous requests.
                throw new Error(`Rate limited by the GitHub API (HTTP ${response.status})`);
            }

            if (!response.ok) {
                throw new Error(`GitHub API returned HTTP ${response.status}`);
            }

            const releases = await response.json();

            for (const release of releases) {
                for (const asset of (release.assets || [])) {
                    if (['hena-arm64-v8a.apk','hena-armeabi-v7a.apk','hena-x86_64.apk'].includes(asset.name.toLowerCase())) {
                        totalDownloads += Number(asset.download_count) || 0;
                    }
                }
            }

            if (releases.length < 100) break;
            page += 1;
        }

        counterElement.textContent = totalDownloads.toLocaleString('ar-EG');
        counterElement.title = 'إجمالي تنزيلات نسخ هِنا الثلاث على GitHub';
        counterElement.setAttribute(
            'aria-label',
            `إجمالي تنزيلات التطبيق: ${totalDownloads}`
        );
        counterElement.setAttribute('data-count', String(totalDownloads));
    } catch (error) {
        console.error('تعذر تحميل عداد تنزيلات هِنا:', error);
        if (!counterElement.textContent || counterElement.textContent === '…') {
            counterElement.textContent = '—';
        }
        counterElement.title = 'تعذر تحديث عدد التنزيلات الفعلي حاليًا';
    } finally {
        henaCounterFetchInFlight = false;
    }
}

// Count the click itself, so the number reacts immediately even before
// GitHub refreshes its own download_count value.
function initDownloadTracking() {
    document.querySelectorAll('.btn-download, a.qr').forEach(el => {
        el.addEventListener('click', () => {
            const counterElement = document.getElementById('download-count');
            if (!counterElement) return;

            const current = Number(counterElement.getAttribute('data-count')) || 0;

            counterElement.setAttribute('data-count', String(current + 1));
            counterElement.textContent = (current + 1).toLocaleString('ar-EG');
        });
    });
}

// Image loading with error handling
function initImageLoading() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        img.addEventListener('load', () => {
            img.classList.add('loaded');
        });

        // Fallback if image is already cached
        if (img.complete) {
            img.classList.add('loaded');
        }

        // Error handling
        img.addEventListener('error', () => {
            // Gracefully handle missing images
            img.style.opacity = '0.3';
        });
    });
}

// Scroll-triggered animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-scroll').forEach(el => {
        observer.observe(el);
    });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offset = 100;
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const navbarMenu = document.getElementById('navbarMenu');
        if (navbarMenu) {
            navbarMenu.classList.remove('active');
        }
    }
});

// ---------------------------------------------------------------------------
// Hena Android architecture-aware download.
// Prefer Android Client Hints; use explicit UA architecture only when present.
// Unknown Android phones default to ARM64. Other platforms use universal APK.
const HENA_RELEASE_BASE = 'https://github.com/ananbusiness88-hue/Hena-Downloads/releases/latest/download/';
const HENA_APK_BY_ARCH = {
    arm64: 'hena-arm64-v8a.apk',
    arm32: 'hena-armeabi-v7a.apk',
    x86_64: 'hena-x86_64.apk',
    universal: 'Hena.apk'
};
let henaApkPromise = null;

function detectHenaArchitectureFromUserAgent(ua) {
    if (/(?:x86_64|x86-64|amd64|x64)/i.test(ua)) return { file: HENA_APK_BY_ARCH.x86_64, label: 'x86 64-bit' };
    if (/(?:i[3-6]86|i86pc)/i.test(ua)) return { file: HENA_APK_BY_ARCH.universal, label: 'النسخة الشاملة' };
    if (/(?:armeabi-v7a|armv7l|armv7)/i.test(ua)) return { file: HENA_APK_BY_ARCH.arm32, label: 'ARM 32-bit' };
    if (/(?:aarch64|arm64|armv8)/i.test(ua)) return { file: HENA_APK_BY_ARCH.arm64, label: 'ARM 64-bit' };
    return { file: HENA_APK_BY_ARCH.arm64, label: 'ARM 64-bit' };
}

async function detectHenaArchitecture() {
    const ua = (navigator && navigator.userAgent) || '';
    const uaData = navigator && navigator.userAgentData;
    const platform = (uaData && uaData.platform) || navigator.platform || '';
    const isAndroid = /android/i.test(ua) || /android/i.test(platform);
    if (!isAndroid) return { file: HENA_APK_BY_ARCH.universal, label: 'النسخة الشاملة' };

    if (uaData && typeof uaData.getHighEntropyValues === 'function') {
        try {
            const hints = await uaData.getHighEntropyValues(['architecture', 'bitness']);
            const arch = String((hints && hints.architecture) || '').toLowerCase();
            const bitness = String((hints && hints.bitness) || '');
            if (arch === 'arm' && bitness === '32') return { file: HENA_APK_BY_ARCH.arm32, label: 'ARM 32-bit' };
            if (arch === 'arm' && bitness === '64') return { file: HENA_APK_BY_ARCH.arm64, label: 'ARM 64-bit' };
            if (arch === 'arm64' || arch === 'aarch64') return { file: HENA_APK_BY_ARCH.arm64, label: 'ARM 64-bit' };
            if ((arch === 'x86' || arch === 'x86_64') && bitness === '64') return { file: HENA_APK_BY_ARCH.x86_64, label: 'x86 64-bit' };
            if (arch === 'x86' && bitness === '32') return { file: HENA_APK_BY_ARCH.universal, label: 'النسخة الشاملة' };
        } catch (_) {
            // Client Hints can be blocked; fall back to explicit UA tokens.
        }
    }
    return detectHenaArchitectureFromUserAgent(ua);
}

function initHenaArchitecture() {
    if (!henaApkPromise) henaApkPromise = detectHenaArchitecture();
    return henaApkPromise;
}

function startHenaDownload(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'جاري فحص نوع جهازك...';
    initHenaArchitecture().then((result) => {
        btn.textContent = 'تم تحديد ' + result.label + ' — جاري التحميل';
        window.setTimeout(() => { window.location.href = HENA_RELEASE_BASE + result.file; }, 300);
    }).catch(() => {
        btn.textContent = 'جاري تنزيل النسخة الشاملة...';
        window.setTimeout(() => { window.location.href = HENA_RELEASE_BASE + HENA_APK_BY_ARCH.universal; }, 300);
    });
}

function applyHenaArchitectureToLinks() {
    document.querySelectorAll('a.cta-backup').forEach((link) => {
        link.setAttribute('href', HENA_RELEASE_BASE + HENA_APK_BY_ARCH.universal);
        link.textContent = 'لو التحميل المناسب ما اشتغلش، نزّل النسخة الشاملة';
    });
}
