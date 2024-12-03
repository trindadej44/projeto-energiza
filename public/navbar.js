// Initialize AOS
AOS.init();

// Scroll Progress Bar
window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    document.getElementById('scrollProgress').style.width = scrolled + '%';
});

// Navbar Background Change on Scroll
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 100) {
        navbar.classList.add('shadow-lg');
    } else {
        navbar.classList.remove('shadow-lg');
    }
});

// Animated Stats
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    const range = end - start;
    const minTimer = 50;
    const stepTime = Math.abs(Math.floor(duration / range));
    const startTime = new Date().getTime();
    const endTime = startTime + duration;
    let timer;

    function run() {
        const now = new Date().getTime();
        const remaining = Math.max((endTime - now) / duration, 0);
        const value = Math.round(end - (remaining * range));
        if (id === 'statsSaved') {
            obj.textContent = `R$ ${value.toLocaleString()}`;
        } else {
            obj.textContent = value.toLocaleString();
        }
        if (value === end) {
            clearInterval(timer);
        }
    }

    timer = setInterval(run, stepTime);
    run();
}

// Start animations when elements are in view
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateValue('statsUsers', 0, 50000, 2000);
            animateValue('statsEnergy', 0, 1000000, 2000);
            animateValue('statsCities', 0, 100, 2000);
            animateValue('statsSaved', 0, 1000000, 2000);
        }
    });
});

observer.observe(document.querySelector('#statsUsers'));
