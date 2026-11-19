(() => {
  'use strict';
  const filters = document.querySelector('[data-arena-filters]');
  const pins = [...document.querySelectorAll('.pin[data-conference]')];
  const count = document.querySelector('[data-arena-count]');
  if (!filters || !pins.length || !count) return;
  const buttons = [...filters.querySelectorAll('button[data-arena-filter]')];
  filters.hidden = false;
  buttons.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.arenaFilter;
    buttons.forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    let visible = 0;
    pins.forEach(pin => {
      pin.hidden = selected !== 'all' && pin.dataset.conference !== selected;
      if (!pin.hidden) visible += 1;
    });
    const group = selected === 'East' ? '東：' : selected === 'West' ? '西：' : '';
    count.textContent = `${group}${visible}チームを表示中`;
  }));
})();
