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
// Architecture aware download
// The main download button used to always serve the universal APK (all ABIs,
// ~114 MB). Now the file is picked from the device architecture:
//   arm64  -> hena-arm64-v8a.apk   (~48 MB)
//   arm 32 -> hena-armeabi-v7a.apk (~43 MB)
//   x86_64 -> hena-x86_64.apk      (~50 MB)
// Anything else keeps the universal APK as a safe fallback.

// ---------------------------------------------------------------------------
// Architecture aware download
// The main download button used to always serve the universal APK (all ABIs,
// ~114 MB). Now the file is picked from the device architecture:
//   arm64  -> hena-arm64-v8a.apk   (~48 MB)
//   arm 32 -> hena-armeabi-v7a.apk (~43 MB)
//   x86_64 -> hena-x86_64.apk      (~50 MB)
// Anything else keeps the universal APK as a safe fallback.

// ---------------------------------------------------------------------------
// Architecture aware download
// The main download button used to always serve the universal APK (all ABIs,
// ~114 MB). Now the file is picked from the device architecture:
//   arm64  -> hena-arm64-v8a.apk   (~48 MB)
//   arm 32 -> hena-armeabi-v7a.apk (~43 MB)
//   x86_64 -> hena-x86_64.apk      (~50 MB)
// Anything else keeps the universal APK as a safe fallback.
// The site is for phones, so the main button always serves the ARM64 build
// (the one that matches almost every modern phone, ~48 MB instead of ~114 MB).
// The file is only swapped for a confirmed 32 bit ARM or x86 device.
const HENA_RELEASE_BASE =
    'https://github.com/ananbusiness88-hue/Hena-Downloads/releases/latest/download/';

const HENA_APK_BY_ARCH = {
    arm64: 'hena-arm64-v8a.apk',
    arm32: 'hena-armeabi-v7a.apk',
    x86: 'hena-x86_64.apk',
    universal: 'Hena.apk'
};

let henaApkPromise = null;

function detectHenaArchitectureFromUserAgent(ua) {
    if (/x86_64|x86-64|x86/i.test(ua)) return HENA_APK_BY_ARCH.x86;
    if (/i686|armeabi|armv7l/i.test(ua)) return HENA_APK_BY_ARCH.arm32;

    // Old Android versions shipped 32 bit binaries, newer ones are 64 bit.
    const versionMatch = /android\s+([0-9]+)/i.exec(ua);
    if (versionMatch && parseInt(versionMatch[1], 10) <= 6) {
        return HENA_APK_BY_ARCH.arm32;
    }
    return HENA_APK_BY_ARCH.arm64;
}

function detectHenaArchitecture() {
    const ua = navigator.userAgent || '';
    const uaData = navigator.userAgentData;
    const platform = (uaData && uaData.platform) || '';
    const isAndroid = /android/i.test(ua) || /android/i.test(platform);

    // Desktop / iOS visitors get the ARM64 build too: this page is for phones.
    if (!isAndroid) return Promise.resolve(HENA_APK_BY_ARCH.arm64);

    if (uaData && typeof uaData.getHighEntropyValues === 'function') {
        return uaData
            .getHighEntropyValues(['architecture', 'bitness'])
            .then((hints) => {
                const arch = (hints && hints.architecture) || '';
                const bitness = (hints && hints.bitness) || '';
                if (arch === 'x86' || arch === 'x86_64') return HENA_APK_BY_ARCH.x86;
                if (arch === 'arm') {
                    return bitness === '32'
                        ? HENA_APK_BY_ARCH.arm32
                        : HENA_APK_BY_ARCH.arm64;
                }
                return detectHenaArchitectureFromUserAgent(ua);
            })
            .catch(() => detectHenaArchitectureFromUserAgent(ua));
    }

    return Promise.resolve(detectHenaArchitectureFromUserAgent(ua));
}

function initHenaArchitecture() {
    if (!henaApkPromise) henaApkPromise = detectHenaArchitecture();
    return henaApkPromise;
}

function startHenaDownload(btn) {
    const fallback =
        btn.getAttribute('data-url') ||
        HENA_RELEASE_BASE + HENA_APK_BY_ARCH.arm64;

    initHenaArchitecture()
        .then((name) => {
            window.location.href = HENA_RELEASE_BASE + name;
        })
        .catch(() => {
            window.location.href = fallback;
        });
}

// The secondary link stays on the universal APK as a manual fallback for the
// rare device whose architecture was detected wrong.
function applyHenaArchitectureToLinks() {
    document.querySelectorAll('a.cta-backup').forEach((link) => {
        link.setAttribute('href', HENA_RELEASE_BASE + HENA_APK_BY_ARCH.universal);
        link.textContent = '\u062a\u062d\u0645\u064a\u0644 \u0646\u0633\u062e\u0629 \u0627\u062d\u062a\u064a\u0627\u0637\u064a\u0629 \u062a\u0639\u0645\u0644 \u0639\u0644\u0649 \u0643\u0644 \u0641\u0627\u0644\u0627\u062a\u062c\u0647\u0627\u0632\u0627\u062a';
    });
}
