document.addEventListener('DOMContentLoaded', () => {
    const track = document.getElementById('trackProjet');
    const prevBtn = document.getElementById('prevProjet');
    const nextBtn = document.getElementById('nextProjet');
    const items = track.querySelectorAll('.carousel-item');

    let currentIndex = 0;

    function getVisibleCount() {
        if (window.innerWidth <= 650) return 1;
        if (window.innerWidth <= 992) return 2;
        return 3;
    }

    function updateCarousel() {
        const visibleCount = getVisibleCount();
        const maxIndex = Math.max(0, items.length - visibleCount);

        // Borner l'index courant
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        if (currentIndex < 0) currentIndex = 0;

        const gap = 24; // Même valeur que 'gap' dans style.css
        const itemWidth = items[0].getBoundingClientRect().width;
        const offset = currentIndex * (itemWidth + gap);

        track.style.transform = `translateX(-${offset}px)`;

        // Mise à jour de l'état des boutons
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex >= maxIndex;
    }

    nextBtn.addEventListener('click', () => {
        const visibleCount = getVisibleCount();
        const maxIndex = items.length - visibleCount;
        if (currentIndex < maxIndex) {
            currentIndex += 1; // Glissement 1 par 1
            updateCarousel();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex -= 1; // Glissement 1 par 1
            updateCarousel();
        }
    });

    window.addEventListener('resize', updateCarousel);

    // Initialisation
    updateCarousel();
});