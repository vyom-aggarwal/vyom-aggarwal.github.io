/* ═══════════════════════════════════════════════════════════
   work.js — discipline filter for the role deck.

   Every role's detail is on its tile already, so there is
   nothing to expand: filtering is the only interaction.
   ═══════════════════════════════════════════════════════════ */

export function initWork({ reducedMotion = false } = {}) {
  const deck = document.getElementById('jobs');
  if (!deck) return;

  const jobs = Array.from(deck.querySelectorAll('.tile--job'));
  const empty = document.getElementById('jobsEmpty');
  const buttons = Array.from(document.querySelectorAll('.filter'));

  const applyFilter = (key) => {
    let shown = 0;

    jobs.forEach((job) => {
      const tags = (job.dataset.tags || '').split(/\s+/);
      const match = key === 'all' || tags.includes(key);
      job.classList.toggle('is-hidden', !match);
      if (!match) return;

      if (!reducedMotion) {
        /* re-run the entrance so the filtered set feels dealt out */
        job.style.animation = 'none';
        void job.offsetWidth;
        job.style.animation = `job-in 0.5s var(--ease) ${shown * 45}ms both`;
      }
      shown++;
    });

    if (empty) empty.hidden = shown > 0;
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      applyFilter(btn.dataset.filter || 'all');
    });
  });
}
